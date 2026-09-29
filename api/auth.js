import { createClient } from '@supabase/supabase-js';
import { isSchoolAdmin } from '../src/lib/staffAccess.js';
import { verifyLineIdToken } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING_SERVICE_ROLE_KEY'
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { line_uid, id_token } = req.body;
  if (!line_uid) return res.status(400).json({ error: 'Missing LINE UID' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  // 官方防偽憑證校驗：缺少 ID Token 一律拒絕授權
  if (!id_token) {
    return res.status(401).json({ role: null, error: '缺少 LINE ID Token 憑證，拒絕授權' });
  }
  const tokenResult = await verifyLineIdToken(id_token, line_uid);
  if (!tokenResult.valid) {
    return res.status(401).json({ role: null, error: tokenResult.error });
  }
  const verifiedUid = tokenResult.payload.sub;

  try {
    const { data: staffData, error } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', verifiedUid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(401).json({ role: null, error: 'User not found' });
      }
      const isConnectionError = /fetch failed|ENOTFOUND|ECONNREFUSED|timeout|503/i.test(error.message || '');
      if (isConnectionError) {
        return res.status(503).json({
          role: null,
          error: 'DATABASE_PAUSED',
          message: '校務雲端資料庫連線中斷或處於休眠狀態（Supabase 免費專案超過 7 天無活動），請由管理員登入 Supabase 主控台點擊「Restore project」喚醒。'
        });
      }
      return res.status(500).json({ role: null, error: `資料庫查詢失敗: ${error.message}` });
    }

    if (!staffData) {
      return res.status(401).json({ role: null, error: 'User not found' });
    }

    const role = isSchoolAdmin(staffData) ? 'admin' : 'teacher';
    
    return res.status(200).json({ role, staffData });
  } catch (err) {
    const isConnectionError = /fetch failed|ENOTFOUND|ECONNREFUSED|timeout|503/i.test(err.message || '');
    if (isConnectionError) {
      return res.status(503).json({
        role: null,
        error: 'DATABASE_PAUSED',
        message: '校務雲端資料庫連線中斷或處於休眠狀態（Supabase 免費專案超過 7 天無活動），請由管理員登入 Supabase 主控台點擊「Restore project」喚醒。'
      });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
