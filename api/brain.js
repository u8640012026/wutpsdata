import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  const line_uid = req.headers['x-line-uid'] || 'dev-admin';

  try {
    if (req.method === 'GET') {
      const { dept_id } = req.query;
      let query = supabase.from('brain_documents').select('*').order('created_at', { ascending: false });
      if (dept_id) {
        query = query.eq('dept_id', dept_id);
      }
      const { data, error } = await query;
      if (error) {
        // 若資料表尚未建立，回傳空陣列而非報錯
        console.warn('brain_documents table query note:', error.message);
        return res.status(200).json([]);
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { dept_id, title, file_name, file_size, uploaded_by, extracted_text, summary } = req.body;
      if (!title || !dept_id) {
        return res.status(400).json({ error: '缺少標題或處室資訊' });
      }

      const newRecord = {
        dept_id,
        title: title.trim(),
        file_name: (file_name || title).trim(),
        file_size: file_size || '未知',
        uploaded_by: uploaded_by || '校務同仁',
        uploaded_by_uid: line_uid,
        extracted_text: extracted_text || '',
        summary: summary || '',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('brain_documents')
        .insert([newRecord])
        .select()
        .single();

      if (error) {
        console.warn('brain_documents insert note:', error.message);
        // 若尚未建表，仍回傳建立成功的 record 結構供前端使用
        return res.status(200).json({ ...newRecord, id: `local-${Date.now()}` });
      }

      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: '缺少文件 ID' });

      const { error } = await supabase.from('brain_documents').delete().eq('id', id);
      if (error) {
        console.warn('brain_documents delete note:', error.message);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (err) {
    console.error('Brain API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
