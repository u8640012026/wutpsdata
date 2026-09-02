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
      const line_uid = req.headers['x-line-uid'];
      if (!line_uid) return res.status(401).json({ error: 'Missing LINE UID' });

      // 1. 驗證權限
      const { data: staffData } = await supabase.from('staff').select('*').eq('line_uid', line_uid).single();
      if (!staffData) return res.status(403).json({ error: 'Forbidden' });

      // TODO: 未來可根據 staffData.role_tags 來過濾能看到的學生 (例如導師只看自己班)
      // 目前 Admin 看全校
      let query = supabase.from('students').select('*').order('grade', { ascending: true }).order('class_name', { ascending: true });
      
      const { data, error } = await query;
      if (error) throw error;

      // 根據座號轉為數字排序
      const sortedData = data.sort((a, b) => parseInt(a.seat_number || '0') - parseInt(b.seat_number || '0'));
      return res.status(200).json(sortedData);
    } 
    
    if (req.method === 'POST') {
      const { line_uid, studentsData } = req.body;
      if (!line_uid || !studentsData || !Array.isArray(studentsData)) {
        return res.status(400).json({ error: 'Missing parameters or invalid data' });
      }

      // 1. 驗證是否為行政人員
      const { data: staffData } = await supabase.from('staff').select('*').eq('line_uid', line_uid).single();

      if (!staffData || (staffData.title !== '行政' && !staffData.email.includes('u864001'))) {
        return res.status(403).json({ error: 'Forbidden: 權限不足' });
      }

      // 2. 選擇性更新
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
        const mergedDetails = { ...oldDetails, ...s.details }; 
        return { ...s, details: mergedDetails };
      });

      // 3. 寫入學生資料
      const { error } = await supabase.from('students').upsert(finalData, { onConflict: 'student_id' });
      if (error) throw error;
      
      // 4. 寫入 Audit Log
      await supabase.from('audit_logs').insert({
        actor_uid: line_uid,
        actor_role: 'admin',
        action: 'IMPORT_STUDENTS',
        target_table: 'students',
        details: { count: studentsData.length, timestamp: new Date().toISOString() }
      });

      return res.status(200).json({ success: true, count: studentsData.length });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
