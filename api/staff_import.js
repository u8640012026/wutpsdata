import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { line_uid, staffData } = req.body;
  if (!line_uid || !staffData || !Array.isArray(staffData)) {
    return res.status(400).json({ error: 'Missing parameters or invalid data' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    // 1. 驗證是否為系統管理員 (只有 Admin 能上傳教職員名單)
    const { data: adminData } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', line_uid)
      .single();

    if (!adminData || (adminData.title !== '行政' && !adminData.email.includes('u864001'))) {
      return res.status(403).json({ error: 'Forbidden: 權限不足' });
    }

    // 2. 選擇性更新策略 (Selective Upsert)：保留舊有的 line_uid (LINE 綁定資訊)
    const emails = staffData.map(s => s.email);
    const { data: existingStaff } = await supabase.from('staff').select('email, line_uid').in('email', emails);
    
    const lineUidMap = {};
    if (existingStaff) {
      existingStaff.forEach(s => {
        if (s.line_uid) lineUidMap[s.email] = s.line_uid;
      });
    }

    // 準備最終寫入的資料，確保保留 line_uid
    const finalData = staffData.map(s => {
      const existingLineUid = lineUidMap[s.email];
      if (existingLineUid) {
        return { ...s, line_uid: existingLineUid };
      }
      return s;
    });

    // 3. 寫入資料庫
    const { error } = await supabase
      .from('staff')
      .upsert(finalData, { onConflict: 'email' });

    if (error) throw error;
    
    // 4. 寫入稽核紀錄
    await supabase.from('audit_logs').insert({
      actor_uid: line_uid,
      actor_role: 'admin',
      action: 'IMPORT_STAFF',
      target_table: 'staff',
      details: { count: staffData.length, timestamp: new Date().toISOString() }
    });

    return res.status(200).json({ success: true, count: staffData.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
