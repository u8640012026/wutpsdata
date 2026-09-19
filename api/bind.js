import { createClient } from '@supabase/supabase-js';
import { isSuperAdmin } from '../src/lib/staffAccess.js';
import { verifyLineIdToken } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING_SERVICE_ROLE_KEY'
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { email, displayName, userId, id_token } = req.body;
  if (!email || !userId) return res.status(400).json({ error: 'Missing parameters' });

  // 官方防偽憑證校驗：缺少 ID Token 一律拒絕綁定
  if (!id_token) {
    return res.status(401).json({ error: '缺少 LINE 官方 ID Token 憑證，拒絕綁定' });
  }
  const tokenResult = await verifyLineIdToken(id_token, userId);
  if (!tokenResult.valid) {
    return res.status(401).json({ error: tokenResult.error });
  }
  const verifiedUid = tokenResult.payload.sub;

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

    // 3. 邀請碼與身分核准查驗（防止任意持有 LINE 帳號者冒領尚未綁定之同仁公務信箱）
    const providedCode = (req.body.invite_code || req.body.bind_code || '').trim();
    const expectedCode = (existingStaff.bind_code || existingStaff.details?.bind_code || process.env.STAFF_INVITE_CODE || '').trim();
    const isExplicitlyApproved = existingStaff.approved_for_binding === true || existingStaff.details?.approved_for_binding === true;
    const isMandatoryMode = process.env.REQUIRE_INVITE_CODE === 'true' || process.env.NODE_ENV === 'production';

    // 若系統啟用了安全強制查核，或者該教職員帳號有設定預期邀請碼
    if (isMandatoryMode || expectedCode) {
      // 情況 A：系統要求查驗，但尚未設定有效授權碼且未獲管理員直接核准 -> 拒絕綁定
      if (!expectedCode && !isExplicitlyApproved) {
        return res.status(403).json({ error: '此教職員帳號尚未配置有效授權碼或核准紀錄，無法進行自主綁定，請向學校系統管理員索取邀請碼。' });
      }
      // 情況 B：有授權碼，但使用者未填或填寫不相符 -> 拒絕綁定
      if (expectedCode && (!providedCode || providedCode !== expectedCode)) {
        return res.status(403).json({ error: '首次綁定授權碼 (邀請碼) 不正確。為保障教職員帳號安全，請向學校系統管理員索取綁定驗證碼。' });
      }
    }

    // 4. 防覆蓋保護：若已綁定且 UID 不符，嚴禁直接搶佔覆蓋
    if (existingStaff.line_uid && existingStaff.line_uid !== verifiedUid) {
      return res.status(409).json({ error: '此信箱已綁定其他 LINE 帳號。為保障帳號安全，若需換綁請洽系統管理員重設。' });
    }

    // 5. 如果尚未綁定，或為原使用者重複綁定，才寫入 LINE UID
    const { error: updateError } = await supabase
      .from('staff')
      .update({ line_uid: verifiedUid })
      .eq('id', existingStaff.id);

    if (updateError) throw updateError;
    
    await supabase.from('audit_logs').insert({
      actor_uid: verifiedUid,
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
