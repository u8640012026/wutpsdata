// LINE ID Token 官方加密簽章與有效期限查核模組

/**
 * 向 LINE 官方伺服器驗證 LIFF 端發行的 ID Token
 * @param {string} idToken - LIFF 發行之 JWT Token
 * @param {string} [expectedUid] - 預期的使用者 LINE UID (sub)
 * @returns {Promise<{ valid: boolean, error?: string, payload?: object }>}
 */
export async function verifyLineIdToken(idToken, expectedUid = null) {
  if (!idToken) {
    return { valid: false, error: '缺少 LINE ID Token 憑證' };
  }

  // 測試環境專用 Mock 憑證快速放行
  if (process.env.NODE_ENV === 'test' && idToken.startsWith('test-')) {
    return { 
      valid: true, 
      payload: { sub: expectedUid || 'test-teacher', name: '測試使用者' } 
    };
  }

  const channelId = process.env.LINE_CHANNEL_ID || process.env.VITE_LIFF_ID?.split('-')[0] || '2011376584';

  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: channelId
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { valid: false, error: `LINE 官方驗證失敗: ${errText}` };
    }

    const payload = await res.json();

    // 核對 Token 內部的 sub 是否與請求身分相符
    if (expectedUid && payload.sub !== expectedUid) {
      return { valid: false, error: 'Token 使用者 UID 與請求不符，拒絕授權' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: `連線至 LINE 驗證中心失敗: ${err.message}` };
  }
}

/**
 * 統一檢驗 API Request Headers 中的身分標頭 (x-line-uid 與 x-line-id-token)
 * 嚴格要求：在正式環境 (NODE_ENV !== 'test' 或強制要求時) 缺少 ID Token 必須直接拒絕 401
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ valid: boolean, error?: string, uid?: string, payload?: object }>}
 */
export async function authenticateApiRequest(req) {
  const lineUid = req.headers?.['x-line-uid'];
  const idToken = req.headers?.['x-line-id-token'];

  // 1. 缺少 ID Token 查驗：一律拒絕存取，杜絕偽造 x-line-uid
  if (!idToken) {
    return { valid: false, error: 'Unauthorized: 缺少 LINE 官方 ID Token 憑證，拒絕存取' };
  }

  // 2. 驗證 ID Token 的加密真實性與有效期
  const result = await verifyLineIdToken(idToken, lineUid);
  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  // 3. 永遠以 LINE 官方解密出來的 sub (真實 UID) 為唯一受信身分！
  const trustedUid = result.payload.sub;
  return { valid: true, uid: trustedUid, payload: result.payload };
}
