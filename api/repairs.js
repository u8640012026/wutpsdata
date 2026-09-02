import { createClient } from '@supabase/supabase-js';

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
    const isAdmin = staff && (staff.title === '行政' || staff.email.includes('u864001'));

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
      const insertData = { ...body, reporter_uid: line_uid, reporter_name: staff ? staff.name : '未知' };
      const { data, error } = await supabase.from('repairs').insert([insertData]).select();
      if (error) throw error;
      
      await supabase.from('audit_logs').insert({ actor_uid: line_uid, actor_role: isAdmin ? 'admin' : 'staff', action: 'CREATE_REPAIR', target_table: 'repairs', details: { id: data[0].id } });
      return res.status(200).json(data[0]);
    }

    if (method === 'PATCH') {
      // 更新案件進度或結案
      const { id, updates } = body;
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
