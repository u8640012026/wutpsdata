import { createClient } from '@supabase/supabase-js';
import { authenticateApiRequest } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING_SERVICE_ROLE_KEY'
);

const inFlightBrainUploads = new Set();

export default async function handler(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  let line_uid = req.headers['x-line-uid'];

  try {
    if (req.method === 'GET') {
      const auth = await authenticateApiRequest(req);
      if (!auth.valid) {
        return res.status(401).json({ error: auth.error });
      }

      // 嚴格校驗：僅限已建檔之在職教職員查閱校務大腦機敏文件
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, department, role_tags')
        .eq('line_uid', auth.uid)
        .maybeSingle();

      if (!staffData) {
        return res.status(403).json({ error: 'Forbidden: 僅限已建檔之校內教職員查閱校務知識庫' });
      }

      const { dept_id } = req.query;
      let query = supabase.from('brain_documents').select('*').order('created_at', { ascending: false });
      if (dept_id) {
        query = query.eq('dept_id', dept_id);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('brain_documents table query note:', error.message);
        return res.status(200).json([]);
      }
      return res.status(200).json(data || []);
    }

    // 寫入與刪除必須驗證教職員身分
    if (req.method === 'POST' || req.method === 'DELETE') {
      const auth = await authenticateApiRequest(req);
      if (!auth.valid) {
        return res.status(401).json({ error: auth.error });
      }
      line_uid = auth.uid;

      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, department, role_tags')
        .eq('line_uid', line_uid)
        .maybeSingle();

      if (!staffData) {
        return res.status(403).json({ error: 'Forbidden: 僅限已建檔之教職員上傳或維護校務知識庫' });
      }
    }

    if (req.method === 'POST') {
      const { dept_id, title, file_name, file_size, uploaded_by, extracted_text, summary } = req.body;
      if (!title || !dept_id) {
        return res.status(400).json({ error: '缺少標題或處室資訊' });
      }

      const targetFileName = (file_name || title).trim();
      const cleanTitle = title.trim();

      const uploadLockKey = `${dept_id}:${targetFileName}`;
      if (inFlightBrainUploads.has(uploadLockKey)) {
        return res.status(409).json({ error: '同處室同檔名文件正在處理中，請勿重複提交' });
      }
      inFlightBrainUploads.add(uploadLockKey);

      try {
        // 檢查同處室是否已存在相同檔名之文件，若存在則覆蓋更新，避免同檔案重複上傳浪費 AI Token
        const { data: existingDoc, error: findErr } = await supabase
          .from('brain_documents')
          .select('id')
          .eq('dept_id', dept_id)
          .eq('file_name', targetFileName)
          .maybeSingle();

        if (findErr) {
          console.error('brain_documents find duplicate check error:', findErr.message);
          return res.status(500).json({ error: '知識庫重複查核失敗：' + findErr.message });
        }

        if (existingDoc?.id) {
          // 覆蓋更新既有紀錄
          const { data, error } = await supabase
            .from('brain_documents')
            .update({
              title: cleanTitle,
              file_name: targetFileName,
              file_size: file_size || '未知',
              uploaded_by: uploaded_by || '校務同仁',
              uploaded_by_uid: line_uid,
              extracted_text: extracted_text || '',
              summary: summary || '',
              created_at: new Date().toISOString()
            })
            .eq('id', existingDoc.id)
            .select()
            .single();

          if (error) {
            console.error('brain_documents update error:', error.message);
            return res.status(500).json({ error: '知識庫文件更新失敗：' + error.message });
          }

          return res.status(200).json({ ...data, isUpdated: true });
        }

        const newRecord = {
          dept_id,
          title: cleanTitle,
          file_name: targetFileName,
          file_size: file_size || '未知',
          uploaded_by: uploaded_by || '校務同仁',
          uploaded_by_uid: line_uid,
          extracted_text: extracted_text || '',
          summary: summary || '',
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('brain_documents')
          .upsert([newRecord], { onConflict: 'dept_id,file_name' })
          .select()
          .single();

        if (error) {
          if (error.message?.includes('ON CONFLICT') || error.code === '42P10') {
            console.error('brain_documents missing unique constraint error:', error.message);
            return res.status(500).json({
              error: '資料庫尚未套用 (dept_id, file_name) 唯一索引約束，已拒絕非原子寫入以防止跨執行個體重複。請管理員於 Supabase 執行 supabase_brain_documents.sql 遷移腳本。'
            });
          }

          console.error('brain_documents upsert error:', error.message);
          return res.status(500).json({ error: '知識庫文件儲存失敗：' + error.message });
        }

        return res.status(201).json(data);
      } finally {
        inFlightBrainUploads.delete(uploadLockKey);
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: '缺少文件 ID' });

      const { error } = await supabase.from('brain_documents').delete().eq('id', id);
      if (error) {
        console.error('brain_documents delete error:', error.message);
        return res.status(500).json({ error: '知識庫文件刪除失敗：' + error.message });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (err) {
    console.error('Brain API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
