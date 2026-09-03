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
      const { archived } = req.query;
      const isArchived = archived === 'true';
      
      // 自動檢查並將過期公告下架 (只有在查詢活動公告時執行)
      if (!isArchived) {
        await supabase
          .from('announcements')
          .update({ is_archived: true })
          .lt('expire_at', new Date().toISOString())
          .eq('is_archived', false);
      }
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_archived', isArchived)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    
    if (req.method === 'POST') {
      const { title, content, author_uid, author_name, expire_at, attachments } = req.body;
      
      const { data, error } = await supabase
        .from('announcements')
        .insert([{ 
          title, content, author_uid, author_name, 
          expire_at: expire_at || null, 
          attachments: attachments || [] 
        }])
        .select();
        
      if (error) throw error;
      return res.status(200).json(data[0]);
    }
    
    if (req.method === 'PUT') {
      const { id, is_archived } = req.body;
      const { data, error } = await supabase
        .from('announcements')
        .update({ is_archived })
        .eq('id', id)
        .select();
        
      if (error) throw error;
      return res.status(200).json(data[0]);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
