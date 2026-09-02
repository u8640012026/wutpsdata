import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { line_uid } = req.body;
  if (!line_uid) return res.status(400).json({ error: 'Missing LINE UID' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    const { data: staffData, error } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', line_uid)
      .single();

    if (error || !staffData) {
      return res.status(401).json({ role: null, error: 'User not found' });
    }

    const role = (staffData.title === '行政' || staffData.email?.includes('u864001')) ? 'admin' : 'teacher';
    
    return res.status(200).json({ role, staffData });
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
