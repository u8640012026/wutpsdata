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
