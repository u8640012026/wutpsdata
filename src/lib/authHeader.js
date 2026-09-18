import liff from '@line/liff';

/**
 * 產生向後端 API 請求時所需的身分驗證標頭 (包含 x-line-uid 與官方 x-line-id-token)
 * @param {string} [lineUid='']
 * @returns {Record<string, string>}
 */
export function getAuthHeaders(lineUid = '') {
  const headers = {};
  if (lineUid) {
    headers['x-line-uid'] = lineUid;
  }
  try {
    if (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) {
      const idToken = liff.getIDToken();
      if (idToken) {
        headers['x-line-id-token'] = idToken;
      }
    }
  } catch (e) {
    // 非 LIFF 環境或測試環境平滑降級
  }
  return headers;
}
