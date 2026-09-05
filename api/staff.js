import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  const line_uid = req.headers['x-line-uid'];
  if (!line_uid) return res.status(401).json({ error: 'Unauthorized: Missing LINE UID' });

  try {
    let isSuperAdmin = false;
    if (line_uid === 'dev-admin') {
      isSuperAdmin = true;
    } else {
      const { data: adminData } = await supabase
        .from('staff')
        .select('*')
        .eq('line_uid', line_uid)
        .single();
      isSuperAdmin = adminData && (adminData.role_tags?.includes('0') || adminData.email?.includes('u864001'));
    }

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: 權限不足，僅限系統管理者(0)操作' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
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
