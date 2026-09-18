# 屏東縣霧臺國小校務系統 (wutpsdata) 第五輪外部審查修復竣工報告

本報告針對外部 AI（ChatGPT）第五輪查核所指出之 **3 項日曆刪除資料一致性缺口**（未同步活動刪除死鎖、本地硬刪除失敗未攔截、狀態持久化寫入失敗未校驗），提供完整之實裝與驗證成果。

---

## 1. 針對第五輪 3 大一致性項目之修補細節 (`api/calendar.js`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           第五輪審核 3 大項目修補矩陣                         │
├───────────────────┬───────────────────────────────┬─────────────────────────┤
│ 審核項目          │ 第五輪缺口現象                │ 本次加固成果            │
├───────────────────┼───────────────────────────────┼─────────────────────────┤
│ 1. 未同步活動刪除 │ gcalId 降級為 UUID 導致死鎖   │ 嚴格採用 gcal_event_id  │
│                   │ 誤送 GAS 報錯變 failed_delete │ 無 Google ID 直接硬刪除 │
├───────────────────┼───────────────────────────────┼─────────────────────────┤
│ 2. 硬刪除錯誤處理 │ GAS 刪除成功後未檢查 DB 刪除  │ 嚴格檢查 delErr，       │
│                   │ 資料庫錯誤仍回傳 200 假成功   │ 失敗立即回傳 500        │
├───────────────────┼───────────────────────────────┼─────────────────────────┤
│ 3. 狀態持久化校驗 │ pending/failed 更新未查 error │ 檢查 pendingErr/failErr │
│                   │ 資料庫寫入失敗時仍假報告成功  │ 寫入失敗立即中斷回 500  │
└───────────────────┴───────────────────────────────┴─────────────────────────┘
```

### 項目一：修正未同步或純本地活動刪除死鎖 (`api/calendar.js:L355`)
- **問題根因**：原代碼使用 `gcalId = existing.gcal_event_id || eventId`。當活動尚未同步至 Google 日曆（`gcal_event_id` 為 `null`）時，因 fallback 至 Supabase 本地 UUID，將本地 UUID 當作 Google eventId 送至 Google Apps Script 執行刪除，GAS 必定因查無該 Google ID 而報錯，導致此本地活動被標記為 `failed_delete` 且永無法在資料庫中刪除。
- **修復實裝**：
  ```javascript
  const gcalId = existing.gcal_event_id;

  if (gcalId) {
    // 具有 Google event ID：走 Google 同步刪除流程
    ...
  } else {
    // 若無 Google ID（未同步或純本地活動）：直接由 Supabase 硬刪除清理
    const { error: delErr } = await supabase.from('calendar_events').delete().eq('id', existing.id);
    if (delErr) {
      return res.status(500).json({ status: 'error', message: '資料庫刪除活動失敗：' + delErr.message });
    }
    return res.status(200).json({ status: 'success', message: '活動已刪除' });
  }
  ```
- **同步防禦**：在活動更新 (`PUT`) 邏輯中亦同步修正為 `const gcalId = existing.gcal_event_id;`，杜絕將本地 UUID 誤送至 Google 的隱患。

### 項目二：Google 刪除成功後之 Supabase 硬刪除錯誤攔截 (`api/calendar.js:L375`)
- **問題根因**：原代碼在 GAS 刪除成功後執行 `await supabase.from('calendar_events').delete().eq('id', existing.id);`，但未解構 `{ error: delErr }`，若資料庫發生外鍵衝突、磁碟或連線問題，仍會向前端誤報 `200 成功`。
- **修復實裝**：
  ```javascript
  const isGoogleDeleted = gasResult.success || (gasResult.error && (gasResult.error.toLowerCase().includes('not found') || gasResult.error.includes('404')));

  if (isGoogleDeleted) {
    // Google 確認刪除（或 Google 端已不存在/404）後才完成清理 (Hard Delete)
    const { error: delErr } = await supabase.from('calendar_events').delete().eq('id', existing.id);
    if (delErr) {
      return res.status(500).json({ status: 'error', message: '資料庫刪除活動失敗：' + delErr.message });
    }
    return res.status(200).json({ status: 'success', message: '活動已刪除' });
  }
  ```

### 項目三：`pending_delete` 與 `failed_delete` 狀態持久化校驗 (`api/calendar.js:L357, L380`)
- **問題根因**：刪除前的待刪除標記，以及 GAS 刪除失敗時的待重試標記，若資料庫更新發生異常未做阻斷，將造成系統在未成功持久化失敗留痕的情況下回傳錯誤狀態。
- **修復實裝**：
  ```javascript
  // 1. 待刪除狀態寫入檢查
  const { error: pendingErr } = await supabase
    .from('calendar_events')
    .update({ sync_status: 'pending_delete', sync_error: null })
    .eq('id', existing.id);

  if (pendingErr) {
    return res.status(500).json({ status: 'error', message: '更新待刪除狀態失敗：' + pendingErr.message });
  }

  // 2. 失敗留痕狀態寫入檢查
  const { error: failErr } = await supabase
    .from('calendar_events')
    .update({
      sync_status: 'failed_delete',
      sync_error: gasResult.error || 'Google 日曆刪除失敗'
    })
    .eq('id', existing.id);

  if (failErr) {
    return res.status(500).json({ status: 'error', message: '儲存待重試刪除紀錄失敗：' + failErr.message });
  }
  ```

---

## 2. 全系統自動化測試驗證 (76 項全數通過)

測試套件由上一輪之 73 項擴增至 **76 項全方位測試，全數通過 (100%)**：

```text
> wutpsdata@0.0.0 test
> node --test tests/*.test.js

✔ api/calendar DELETE deletes locally without calling GAS when gcal_event_id is null (7.3ms)
✔ api/calendar DELETE returns 500 when GAS succeeds but Supabase hard delete fails (9.6ms)
✔ api/calendar DELETE returns 500 when persisting failed_delete state fails (479.3ms)
✔ api/calendar DELETE preserves failed_delete status in database when GAS returns 503 (487.1ms)
✔ api/calendar PUT marks sync_status as failed when GAS returns HTTP 200 with error status (70.8ms)
✔ api/bind POST rejects arbitrary string when REQUIRE_INVITE_CODE=true and no code configured (3.6ms)
✔ api/calendar POST returns 500 when 23505 conflict fails to retrieve existing event (11.0ms)
✔ api/students POST rejects request missing ID token with 401 (194.7ms)
✔ api/students POST rejects non-admin staff with 403 (23.9ms)
✔ api/students POST allows school admin to upsert student data (13.3ms)
✔ api/brain GET rejects valid token user who is not in staff table with 403 (5.1ms)
✔ api/announcement_comments POST rejects valid token user who is not in staff table with 403 (5.9ms)
✔ api/bind POST rejects when invite code is required but invalid with 403 (6.2ms)
✔ api/line_webhook accepts POST with valid HMAC-SHA256 signature (4.4ms)
✔ api/calendar prevents duplicate event creation on identical campus, title, and start_time (15.3ms)
...（其餘 61 項全部通過）
ℹ tests 76
ℹ suites 0
ℹ pass 76
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1527.95
```

---

## 3. 前端正式建置

```text
> vite build
✓ 2347 modules transformed.
dist/index.html    0.45 kB
dist/assets/index.js 1,744.63 kB
✓ built in 1.26s (Exit code 0)
```
