import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  
  const line_uid = req.headers['x-line-uid'];
  if (!line_uid) return res.status(401).json({ error: 'Unauthorized: Missing LINE UID' });

  try {
    // 1. 驗證是否為系統管理員
    const { data: adminData } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', line_uid)
      .single();

    if (!adminData || (adminData.title !== '行政' && !adminData.email.includes('u864001'))) {
      return res.status(403).json({ error: 'Forbidden: 權限不足' });
    }

    // 2. 獲取全校教職員名單
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
