import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { email, displayName, userId } = req.body;
  if (!email || !userId) return res.status(400).json({ error: 'Missing parameters' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    // 1. 嚴格檢查 Email 是否存在於教職員名冊中
    const { data: existingStaff, error: searchError } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .single();

    // 如果找不到，直接報錯，拒絕建立幽靈帳號
    if (searchError || !existingStaff) {
      return res.status(400).json({ error: '找不到此 Email。請確認您輸入的信箱是否與學校建檔的相符（可能遺漏了 .tw 等後綴）。' });
    }

    // 2. 如果存在，才將 LINE UID 寫入該筆資料完成綁定
    const { error: updateError } = await supabase
      .from('staff')
      .update({ line_uid: userId, name: displayName }) // 選擇性更新顯示名稱
      .eq('id', existingStaff.id);

    if (updateError) throw updateError;
    
    await supabase.from('audit_logs').insert({
      actor_uid: userId,
      actor_role: 'system',
      action: 'BIND_ACCOUNT',
      target_table: 'staff',
      details: { email, previous_uid: existingStaff.line_uid }
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
