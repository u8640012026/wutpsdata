import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('students').select('student_id, enroll_type, name, details').in('student_id', ['1150005', '1130015', '1120005']);
  console.log(data, error);
}
check();
