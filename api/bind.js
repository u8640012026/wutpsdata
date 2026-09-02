import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { email, displayName, userId } = req.body;
  if (!email || !userId) return res.status(400).json({ error: 'Missing parameters' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    const { error } = await supabase.from('staff').upsert({
      email: email,
      name: displayName,
      title: email.includes('u864001') ? '行政' : '導師',
      line_uid: userId
    }, { onConflict: 'email' });

    if (error) throw error;
    
    await supabase.from('audit_logs').insert({
      actor_uid: userId,
      actor_role: 'system',
      action: 'BIND_ACCOUNT',
      target_table: 'staff',
      details: { email }
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
