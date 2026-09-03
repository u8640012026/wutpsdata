import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    if (req.method === 'GET') {
      const { announcement_id } = req.query;
      if (!announcement_id) return res.status(400).json({ error: 'Missing announcement_id' });

      const { data, error } = await supabase
        .from('announcement_comments')
        .select('*')
        .eq('announcement_id', announcement_id)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    
    if (req.method === 'POST') {
      const { announcement_id, author_uid, author_name, content } = req.body;
      if (!announcement_id || !content) return res.status(400).json({ error: 'Missing parameters' });

      const { data, error } = await supabase
        .from('announcement_comments')
        .insert([{ announcement_id, author_uid, author_name, content }])
        .select();
        
      if (error) throw error;
      return res.status(200).json(data[0]);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
