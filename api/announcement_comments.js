import { createClient } from '@supabase/supabase-js';
import { authenticateApiRequest } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING_SERVICE_ROLE_KEY'
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
      const auth = await authenticateApiRequest(req);
      if (!auth.valid) return res.status(401).json({ error: auth.error });
      const trustedUid = auth.uid;

      // 自教職員名冊查詢真實姓名，防止自訂偽造，並嚴格限制僅限在職教職員留言
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name')
        .eq('line_uid', trustedUid)
        .maybeSingle();

      if (!staffData) {
        return res.status(403).json({ error: 'Forbidden: 僅限已建檔之校內教職員發表公告留言' });
      }

      const trustedName = staffData.name;
      const { announcement_id, content } = req.body || {};
      if (!announcement_id || !content || !content.trim()) {
        return res.status(400).json({ error: '缺少公告 ID 或留言內容' });
      }

      const { data, error } = await supabase
        .from('announcement_comments')
        .insert([{ 
          announcement_id, 
          author_uid: trustedUid, 
          author_name: trustedName, 
          content: content.trim() 
        }])
        .select();
        
      if (error) throw error;
      return res.status(200).json(data[0]);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
