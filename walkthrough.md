# 屏東縣霧臺國小校務系統 (wutpsdata) 第三輪代碼審核全面加固竣工報告

本報告針對外部 AI（ChatGPT）對 Commit `51ca8a0`（包含 `9c48bd3`）進行第三輪隔離查核所提出之 **5 項未完全達標項目及「學生 POST」疑慮**，提供完整的架構說明、技術實現與測試數據。

---

## 1. 疑慮釐清：「學生 POST」是什麼？

> [!NOTE]
> **「本系統沒有學生要登入的地方，為什麼報告說『學生 POST』？」**
>
> 1. **全校學生從不需要、也無法登入本系統**：本系統為教職員校務行政與家長公開查詢之用，無學生帳號機制。
> 2. **ChatGPT 報告所指的「學生 POST」**：是指**後台管理員在匯入或更新學生名冊（AdminDashboard -> 學生名冊匯入）時，瀏覽器向後端發送的 HTTP 請求端點為 `POST /api/students`**。
> 3. **原先缺口**：先前的 `api/students.js` 中，查詢名冊（GET）強制驗證 Token，但匯入名冊（POST）卻保留了 `if (activeToken) { ... }` 判斷。這導致無 Token 者能藉由偽造 Header 繞過驗證寫入學生名冊。
> 4. **現已修復**：`POST /api/students` 現已強制要求 LINE 官方 ID Token，並透過 `isSchoolAdmin(staffData)` 確保僅限校長、主任、組長或超級管理員可執行匯入。

---

## 2. 針對第三輪審核 5 大項目之實裝清單

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           第三輪審核 5 大項目修補矩陣                         │
├───────────────────┬───────────────────────────────┬─────────────────────────┤
│ 審核項目          │ 第三輪判定 (51ca8a0)          │ 本次加固成果            │
├───────────────────┼───────────────────────────────┼─────────────────────────┤
│ 1. 學生匯入 Token │ 未完全完成：POST 仍可省略 Token│ 徹底拔除可選判斷，強制401│
│ 2. 教職員授權閉環 │ 有 Token 不等於有教職員資格   │ brain/留言/綁定全面授權 │
│ 3. 日曆併發與衝突 │ 重試換 UUID、23505可能回null  │ 表單ID持久化+23505防護   │
│ 4. Google寫入重試 │ 背景寫入僅試一次，無狀態回報  │ 3次Backoff+部分校區狀態 │
│ 5. 同步欄位與遷移 │ 缺少 sync_error 欄位 migration│ 補齊SQL遷移+降級容錯保護│
│ 6. Webhook 原始體 │ 未擷取 rawBody                │ 支援 Stream/Raw HMAC驗證│
└───────────────────┴───────────────────────────────┴─────────────────────────┘
```

### 項目一：學生匯入 API (`POST /api/students`) 強制 Token 與管理員查核
- **檔案**：`api/students.js`
- **修復**：
  - 徹底移除 `if (activeToken)` 可選邏輯，全面使用 `authenticateApiRequest(req)`。
  - 無 Token 立即阻斷並回傳 `401 Unauthorized: {"error": "Missing LINE ID Token"}`。
  - 驗證通過後，以解密出的 `auth.uid` 查詢教職員表，並呼叫 `isSchoolAdmin(staffData)`。非管理身分回傳 `403 Forbidden`。
  - 稽核紀錄 `audit_logs` 統一寫入真實 `auth.uid`。

### 項目二：LINE 身分不等於教職員資格（授權閉環）
- **校務大腦查閱 (`api/brain.js` GET)**：
  - 驗證 Token 成功後，額外查詢 `staff` 表；若為外部未建檔之 LINE 帳號，一律回傳 `403 Forbidden: 僅限已建檔之校內教職員查閱校務知識庫`。
- **公告留言發布 (`api/announcement_comments.js` POST)**：
  - 查無 `staff` 教職員身分者直接回傳 `403 Forbidden`，徹底禁止以「校務同仁」匿名或冒名發言。
- **身分首次綁定 (`api/bind.js`)**：
  - 加入授權碼/邀請碼查核機制（`invite_code` / `bind_code`）：若系統或同仁檔案配置了邀請碼，必須輸入相符驗證碼才能綁定，杜絕任意持有 LINE 帳號者冒領同仁公務信箱。
  - 前端 `src/components/LiffLogin.jsx` 增加「綁定授權碼」欄位。

### 項目三：日曆防重複完善與 23505 空指標保護
- **前端重試 Client Request ID 保持**：
  - `src/components/SchoolCalendar.jsx` 引入 `submissionIdRef`，表單開啟時生成唯一 UUID，在使用者重試或網路波動重新點擊時，**沿用同一個 `client_event_id`**，不重新產生新 ID。成功後自動重設。
- **23505 衝突檢索防護**：
  - `api/calendar.js` 在捕捉到 Postgres `23505` 唯一鍵衝突後，檢查二次查詢結果。若查詢發生錯誤或結果為 `null`，嚴格回傳 `500` 錯誤，**絕不回傳 `event: null` 假成功**。

### 項目四：Google 背景寫入（新增/修改/刪除）重試與部分校區狀態
- **檔案**：`api/calendar.js`
- **實裝**：
  - 建立 `sendGasWriteWithRetry(payload, maxAttempts = 3)`，背景向 Google Apps Script 發送新增、更新、刪除操作時，具備 6 秒逾時與最多 3 次指數退避重試（Backoff）。
  - 若寫入成功，回填 `gcal_event_id` 並更新 `sync_status: 'synced', sync_error: null`。
  - 若 3 次皆失敗，將 Supabase 資料表的 `sync_status` 標註為 `'failed'`，並記錄具體失敗原因至 `sync_error`。
  - 在 `sync_from_gas` 時，若部分校區失敗、部分校區成功，回傳 `status: 'partial'`，並列出成功校區（`successfulCampuses`）與失敗校區（`failedCampuses`）。

### 項目五：資料庫 SQL 遷移腳本與向下容錯
- **檔案**：`supabase_calendar_events.sql`
- **實裝**：
  - 結構定義中補齊 `sync_status TEXT DEFAULT 'synced'` 與 `sync_error TEXT DEFAULT NULL`。
  - 提供即用型 Migration 語法：
    ```sql
    ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
    ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS sync_error TEXT DEFAULT NULL;
    ```
  - `api/calendar.js` 寫入時具備向下相容保護：若正式庫尚未執行遷移腳本導致更新報錯，自動降級僅更新 `gcal_event_id`，確保 Google 日曆事件 ID 永不遺失。

### 項目六：Webhook 原始內容 (rawBody) 支援
- **檔案**：`api/line_webhook.js`
- **實裝**：
  - 導出 `export const config = { api: { bodyParser: false } };`。
  - 實作流讀取器 `getRawRequestBody(req)`，自原始串流中提取 byte-for-byte 原始位元組串流進行 HMAC-SHA256 簽名比對；同時無縫支援現有物件測試模式。

---

## 3. 全系統自動化測試驗證

本輪新增了專屬加固測試套件 `tests/round3-hardening.test.js`，將測試總量擴充至 **70 項**：

```text
> wutpsdata@0.0.0 test
> node --test tests/*.test.js

✔ api/students POST rejects request missing ID token with 401
✔ api/students POST rejects non-admin staff with 403
✔ api/students POST allows school admin to upsert student data
✔ api/brain GET rejects valid token user who is not in staff table with 403
✔ api/announcement_comments POST rejects valid token user who is not in staff table with 403
✔ api/bind POST rejects when invite code is required but invalid with 403
✔ api/calendar POST returns 500 when 23505 conflict fails to retrieve existing event
✔ api/calendar returns 500 on database insert failure instead of fake success
✔ api/calendar rejects mutating request without ID token with 401
✔ api/calendar rejects non-admin role (role 4) with 403
✔ api/calendar returns 502 when sync_from_gas encounters total connection failure
✔ api/calendar concurrent POSTs with same client_event_id deduplicate via mutex
✔ api/staff rejects dev-admin without valid database record
✔ api/staff forbids deleting a superadmin record (role 0)
✔ api/bind forbids public binding of role 0 superadmin
✔ api/line_webhook accepts POST with valid HMAC-SHA256 signature
...（其餘 54 項全部通過）
ℹ tests 70
ℹ suites 0
ℹ pass 70
ℹ fail 0
ℹ duration_ms 1004.6574
```

---

## 4. 前端打包驗證

```text
> vite build
✓ 2347 modules transformed.
dist/index.html    0.45 kB
dist/assets/index.js 1,744.63 kB
✓ built in 1.17s (Exit code 0)
```
