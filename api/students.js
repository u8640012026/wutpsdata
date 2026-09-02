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

    // 2. 選擇性更新 (Selective Upsert) 邏輯：
    // 取出已存在的學生，確保老師們在 `details` 裡寫的自訂欄位(如特教筆記)不會被 Excel 覆蓋
    const studentIds = studentsData.map(s => s.student_id);
    const { data: existingStudents } = await supabase.from('students').select('student_id, details').in('student_id', studentIds);
    
    const existingMap = {};
    if (existingStudents) {
      existingStudents.forEach(s => {
        existingMap[s.student_id] = s.details || {};
      });
    }

    const finalData = studentsData.map(s => {
      const oldDetails = existingMap[s.student_id] || {};
      // Excel 的欄位會更新，但老師建立的自訂欄位 (Excel 中不存在的 key) 會被保留
      const mergedDetails = { ...oldDetails, ...s.details }; 
      return { ...s, details: mergedDetails };
    });

    // 3. 寫入學生資料
    const { error } = await supabase
      .from('students')
      .upsert(finalData, { onConflict: 'student_id' });

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
