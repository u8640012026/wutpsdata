import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { filename, contentType, base64Data } = req.body;
    
    if (!filename || !base64Data) {
      return res.status(400).json({ error: '缺少檔案資料' });
    }

    // 將 Base64 還原成 Buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 上傳至 Supabase Storage
    const { data, error } = await supabase.storage
      .from('announcements')
      .upload(filename, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: false
      });
      
    if (error) throw error;
    
    // 取得公開下載網址
    const { data: { publicUrl } } = supabase.storage
      .from('announcements')
      .getPublicUrl(filename);
      
    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
