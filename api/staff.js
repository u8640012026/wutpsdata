import { createClient } from '@supabase/supabase-js';
import { isSuperAdmin, isSchoolAdmin, canManageRepairs } from '../src/lib/staffAccess.js';
import { authenticateApiRequest } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  const auth = await authenticateApiRequest(req);
  if (!auth.valid) return res.status(401).json({ error: auth.error });
  const line_uid = auth.uid;

  try {
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', line_uid)
      .single();

    if (!staffData) {
      return res.status(403).json({ error: 'Forbidden: 查無此教職員身分' });
    }

    let isSuper = isSuperAdmin(staffData);
    if (isSuper && process.env.SUPER_ADMIN_LINE_UID) {
      isSuper = staffData.line_uid === process.env.SUPER_ADMIN_LINE_UID;
    }

    if (req.method === 'GET') {
      const canRead = isSuper || isSchoolAdmin(staffData) || canManageRepairs(staffData);
      if (!canRead) {
        return res.status(403).json({ error: 'Forbidden: 僅限行政與修繕管理人員檢視教職員名單' });
      }

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (!isSuper) {
      return res.status(403).json({ error: 'Forbidden: 權限不足，僅限系統管理者(0)操作' });
    }
    
    if (req.method === 'DELETE') {
      // 刪除錯誤建立的帳號
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing ID' });

      // 嚴禁刪除超級管理者
      const { data: targetStaff } = await supabase.from('staff').select('role_tags').eq('id', id).single();
      if (targetStaff && isSuperAdmin(targetStaff)) {
        return res.status(403).json({ error: 'Forbidden: 超級管理者帳號為系統核心保護對象，無法於介面刪除' });
      }
      
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    
    if (req.method === 'PUT') {
      // 變更權限或強制解除綁定
      const { id, updates } = req.body;
      if (!id || !updates) return res.status(400).json({ error: 'Missing parameters' });

      // 嚴禁將超級管理者降權或篡改其綁定
      const { data: targetStaff } = await supabase.from('staff').select('role_tags, line_uid').eq('id', id).single();
      if (targetStaff && isSuperAdmin(targetStaff)) {
        if (updates.role_tags !== undefined && !isSuperAdmin({ role_tags: updates.role_tags })) {
          return res.status(403).json({ error: 'Forbidden: 無法將超級管理者降權' });
        }
        if (updates.line_uid !== undefined && updates.line_uid !== targetStaff.line_uid) {
          return res.status(403).json({ error: 'Forbidden: 超級管理者的 LINE 綁定不可於此介面修改' });
        }
      }
      
      const { error } = await supabase.from('staff').update(updates).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST') {
      // 支援批次匯入 (Batch Import)
      if (req.query?.action === 'import' || Array.isArray(req.body?.staffData)) {
        const { staffData } = req.body;
        if (!staffData || !Array.isArray(staffData)) {
          return res.status(400).json({ error: 'Missing parameters or invalid data' });
        }

        // 選擇性更新策略 (Selective Upsert)：保留舊有的 line_uid (LINE 綁定資訊)
        const emails = staffData.map(s => s.email);
        const { data: existingStaff } = await supabase.from('staff').select('email, line_uid').in('email', emails);
        
        const lineUidMap = {};
        if (existingStaff) {
          existingStaff.forEach(s => {
            if (s.line_uid) lineUidMap[s.email] = s.line_uid;
          });
        }

        const finalData = staffData.map(s => {
          const existingLineUid = lineUidMap[s.email];
          if (existingLineUid) {
            return { ...s, line_uid: existingLineUid };
          }
          return s;
        });

        const { error } = await supabase
          .from('staff')
          .upsert(finalData, { onConflict: 'email' });

        if (error) throw error;
        
        await supabase.from('audit_logs').insert({
          actor_uid: line_uid,
          actor_role: 'admin',
          action: 'IMPORT_STAFF',
          target_table: 'staff',
          details: { count: staffData.length, timestamp: new Date().toISOString() }
        });

        return res.status(200).json({ success: true, count: staffData.length });
      }

      // 單筆手動新增
      const { name, email, department, title, class_assigned, role_tags } = req.body;
      if (!name || !email) return res.status(400).json({ error: '姓名與電子信箱為必填欄位' });

      const { data, error } = await supabase
        .from('staff')
        .insert([{
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department: department?.trim() || '',
          title: title?.trim() || '',
          class_assigned: class_assigned?.trim() || '',
          role_tags: role_tags?.trim() || '',
          line_uid: null
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).send('Method Not Allowed');
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
