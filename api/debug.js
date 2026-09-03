export default async function handler(req, res) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const { data, error } = await supabase.from('students').select('*').eq('student_id', '1150005');
  return res.status(200).json({ data, error });
}
