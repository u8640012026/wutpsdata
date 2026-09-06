import { createClient } from '@supabase/supabase-js';
import { canManageRepairs, isSuperAdmin } from '../src/lib/staffAccess.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  const { method, body } = req;
  const line_uid = req.headers['x-line-uid'];
  
  if (!line_uid) {
    return res.status(401).json({ error: 'Unauthorized: Missing LINE UID' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    // 檢查使用者權限
    const { data: staff } = await supabase.from('staff').select('*').eq('line_uid', line_uid).single();
    if (!staff) return res.status(403).json({ error: '請先完成教職員身分綁定。' });
    const isAdmin = canManageRepairs(staff);
    const isSuper = isSuperAdmin(staff);

    if (method === 'GET') {
      // 總務處或主任/校長(行政)看全部，一般教職員看自己的
      let query = supabase.from('repairs').select('*').order('created_at', { ascending: false });
      if (!isAdmin) {
        query = query.eq('reporter_uid', line_uid);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (method === 'POST') {
      // 新增報修/採購單
      const { type, target, location, description, urgency, media_urls } = body || {};
      if (!['repair', 'purchase'].includes(type) || !['yellow', 'red'].includes(urgency) ||
          ![target, location, description].every(value => typeof value === 'string' && value.trim())) {
        return res.status(400).json({ error: '請填寫案件類型、標的物、位置、狀況與緊急程度。' });
      }
      const insertData = { type, target: target.trim(), location: location.trim(), description: description.trim(), urgency,
        media_urls: Array.isArray(media_urls) ? media_urls : [], reporter_uid: line_uid, reporter_name: staff.name };
      const { data, error } = await supabase.from('repairs').insert([insertData]).select();
      if (error) throw error;
      
      await supabase.from('audit_logs').insert({ actor_uid: line_uid, actor_role: isAdmin ? 'admin' : 'staff', action: 'CREATE_REPAIR', target_table: 'repairs', details: { id: data[0].id } });
      return res.status(200).json(data[0]);
    }

    if (method === 'PATCH') {
      // 更新案件進度或結案
      const { id, updates } = body;
      const { data: existing, error: readError } = await supabase.from('repairs').select('*').eq('id', id).single();
      if (readError || !existing) return res.status(404).json({ error: '找不到案件。' });
      if (!isAdmin && existing.reporter_uid !== line_uid) return res.status(403).json({ error: '無權修改此案件。' });
      if (existing.status === 'closed' && !isSuper) return res.status(409).json({ error: '此案件已結案，無法再修改。' });
      const allowedFields = isAdmin ? ['progress_logs', 'status', 'urgency', 'assignee', 'completion_details'] : ['status', 'urgency'];
      if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).some(key => !allowedFields.includes(key))) {
        return res.status(403).json({ error: '包含無權修改的案件欄位。' });
      }
      if (updates.status === 'closed') {
        if (!isSuper && existing.reporter_uid !== line_uid) return res.status(403).json({ error: '須由原提報人確認結案。' });
        if (!isSuper && existing.status !== 'completed') return res.status(409).json({ error: '請待承辦人標記處理完成後，再確認結案。' });
        updates.urgency = 'blue';
      } else if (!isAdmin) {
        return res.status(403).json({ error: '僅承辦權限人員可更新處理進度。' });
      }
      if (updates.status && !['open', 'completed', 'closed'].includes(updates.status)) return res.status(400).json({ error: '無效的案件狀態。' });
      const { data, error } = await supabase.from('repairs').update(updates).eq('id', id).select();
      if (error) throw error;

      await supabase.from('audit_logs').insert({ actor_uid: line_uid, actor_role: isAdmin ? 'admin' : 'staff', action: 'UPDATE_REPAIR', target_table: 'repairs', details: { id } });
      return res.status(200).json(data[0]);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
