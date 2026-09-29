import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING_SERVICE_ROLE_KEY'
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();
  try {
    // 執行輕量讀取，以真實 SQL 查詢保活 Supabase 免費專案，防止 7 天閒置自動休眠
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .limit(1);

    const elapsedMs = Date.now() - startTime;

    if (error) {
      const isPaused = /fetch failed|ENOTFOUND|ECONNREFUSED|503/i.test(error.message || '');
      return res.status(isPaused ? 503 : 500).json({
        status: isPaused ? 'paused' : 'error',
        database: 'supabase',
        elapsedMs,
        error: error.message,
        hint: isPaused ? 'Supabase 專案處於休眠狀態，請至 Supabase 控制台點擊 Restore project 喚醒' : undefined,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      status: 'healthy',
      database: 'supabase_active',
      elapsedMs,
      message: 'Supabase database keepalive heartbeat successful.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    const isPaused = /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(err.message || '');
    return res.status(isPaused ? 503 : 500).json({
      status: isPaused ? 'paused' : 'error',
      database: 'supabase',
      elapsedMs,
      error: err.message,
      hint: isPaused ? 'Supabase 專案處於休眠狀態，請至 Supabase 控制台點擊 Restore project 喚醒' : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
