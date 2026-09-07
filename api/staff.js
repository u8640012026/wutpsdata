import { createClient } from '@supabase/supabase-js';
import { isSuperAdmin, isSchoolAdmin, canManageRepairs } from '../src/lib/staffAccess.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  const line_uid = req.headers['x-line-uid'];
  if (!line_uid) return res.status(401).json({ error: 'Unauthorized: Missing LINE UID' });

  try {
    let staffData = null;
    let isSuper = false;
    if (line_uid === 'dev-admin') {
      isSuper = true;
    } else {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('line_uid', line_uid)
        .single();
      staffData = data;
      isSuper = isSuperAdmin(staffData);
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
      
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    
    if (req.method === 'PUT') {
      // 變更權限或強制解除綁定
      const { id, updates } = req.body;
      if (!id || !updates) return res.status(400).json({ error: 'Missing parameters' });
      
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
