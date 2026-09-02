import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { line_uid, studentsData } = req.body;
  if (!line_uid || !studentsData || !Array.isArray(studentsData)) {
    return res.status(400).json({ error: 'Missing parameters or invalid data' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    // 1. 驗證是否為行政人員
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', line_uid)
      .single();

    if (!staffData || (staffData.title !== '行政' && !staffData.email.includes('u864001'))) {
      return res.status(403).json({ error: 'Forbidden: 權限不足' });
    }

    // 2. 寫入學生資料
    const { error } = await supabase
      .from('students')
      .upsert(studentsData, { onConflict: 'student_id' });

    if (error) throw error;
    
    // 3. 寫入 Audit Log
    await supabase.from('audit_logs').insert({
      actor_uid: line_uid,
      actor_role: 'admin',
      action: 'IMPORT_STUDENTS',
      target_table: 'students',
      details: { count: studentsData.length, timestamp: new Date().toISOString() }
    });

    return res.status(200).json({ success: true, count: studentsData.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
