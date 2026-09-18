import { createClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '../src/lib/staffAccess.js';
import { verifyLineIdToken } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { email, displayName, userId, id_token } = req.body;
  if (!email || !userId) return res.status(400).json({ error: 'Missing parameters' });

  // 若前端提供了 LINE ID Token，進行官方防偽憑證校驗
  if (id_token) {
    const tokenResult = await verifyLineIdToken(id_token, userId);
    if (!tokenResult.valid) {
      return res.status(401).json({ error: tokenResult.error });
    }
  }

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

    // 2. 超級管理者帳號防護：嚴禁由外部公開表單自主綁定
    if (isSuperAdmin(existingStaff)) {
      return res.status(403).json({ error: '超級管理者帳號為系統核心身分，嚴禁由公開表單自主綁定，請由管理後台或雲端主控台配置。' });
    }

    // 3. 防覆蓋保護：若已綁定且 UID 不符，嚴禁直接搶佔覆蓋
    if (existingStaff.line_uid && existingStaff.line_uid !== userId) {
      return res.status(409).json({ error: '此信箱已綁定其他 LINE 帳號。為保障帳號安全，若需換綁請洽系統管理員重設。' });
    }

    // 4. 如果尚未綁定，或為原使用者重複綁定，才寫入 LINE UID
    const { error: updateError } = await supabase
      .from('staff')
      .update({ line_uid: userId })
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
