# 屏東縣霧臺國小校務系統 (wutpsdata) 第二輪代碼審核全面驗收報告

本報告針對外部 AI（ChatGPT）對 Commit `0bb0540` 進行第二輪隔離審核所提出之 **5 項未完全達標項目**，提供完整之重構實裝說明、架構設計、驗證數據與對應之 Git 提交紀錄。

---

## 1. 最新 Git 提交紀錄 (Commit on `origin/dev`)

| 項目 | 狀態 / 數值 |
| :--- | :--- |
| **遠端倉庫** | `https://github.com/u8640012026/wutpsdata.git` |
| **目標分支** | `dev` |
| **最新 Commit** | **`9c48bd3efdc8c11b7abd89dca77de7e497a88267`** (`9c48bd3`) |
| **提交訊息** | `feat(security): enforce mandatory LINE ID token, wire frontend auth headers, and implement true calendar deduplication and sync retry` |
| **變更統計** | 23 files changed, 539 insertions(+), 168 deletions(-) |
| **測試通過率** | **63 / 63 項測試全數通過 (100%)** |
| **前端建置** | **Vite build 通過 (0 錯誤)** |

---

## 2. 針對 ChatGPT 第二輪 5 大審核項目逐項實裝清單

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           外部審核 5 大項目修正矩陣                           │
├───────────────────┬───────────────────────────────┬─────────────────────────┤
│ 審核項目          │ 原先審核判定 (0bb0540)        │ 本次修復成果 (9c48bd3)  │
├───────────────────┼───────────────────────────────┼─────────────────────────┤
│ 1. 管理 API Token │ 未完成，缺 Token 仍放行       │ 嚴格強制 401，無任何旁路 │
│ 2. 前端傳送標頭   │ 工具已建立，但尚未接入使用    │ 全元件接入 getAuthHeaders│
│ 3. 日曆併發防重複 │ 未完成，已重現兩次新增        │ 4 層防護 (前端/互斥/DB) │
│ 4. 背景同步重試   │ 未完成，假成功 200 仍存在     │ 3次 Backoff + 失敗回傳502│
│ 5. 測試套件       │ 59 項測試                     │ 擴充至 63 項全數通過    │
└───────────────────┴───────────────────────────────┴─────────────────────────┘
```

### 項目一：管理 API 強制驗證 LINE ID Token（缺 Token 絕對拒絕）
- **原問題**：`api/line_auth.js` 中若缺少 Token 或在測試環境下，可能降級至信任 `x-line-uid`，導致無 Token 請求仍可能被放行。
- **修復內容**：
  1. **`api/line_auth.js` 核心重構**：
     - 徹底移除任何「缺 Token 則降級信任 raw UID」的後門。
     - 若請求標頭或參數中缺少 `x-line-id-token`，一律無條件回傳 `401 Unauthorized: {"error": "Missing LINE ID Token"}`。
     - 驗證成功後，一律使用 LINE 官方驗證傳回之 `payload.sub` 作為真實信任 UID，杜絕 Header 偽造。
  2. **全面涵蓋所有管理與異動端點**：
     - `api/staff.js`：查詢與異動嚴格查驗 Token。
     - `api/calendar.js`：`POST`、`PUT`、`DELETE`、`sync_from_gas` 必須驗證 Token，且限制管理角色（角色 0, 1, 2, 3）。
     - `api/repairs.js`：修繕管理與非公開查詢強制驗證。
     - `api/brain.js`：校務大腦知識庫寫入、刪除與機敏查詢強制驗證。
     - `api/students.js`：學生名冊維護強制驗證。
     - `api/announcements.js`：公告發布、編輯與下架強制驗證。
     - `api/announcement_comments.js`：留言強制驗證 Token，並將留言者強制鎖定為 Token 解析出之本人，防冒名發言。
     - `api/upload.js`：檔案上傳端點強制查驗 Token 與教職員在職資格（非教職員回傳 403）。
     - `api/auth.js` & `api/bind.js`：身分綁定流程強制要求前端提供 LINE 登入取得之 `id_token`，不符即回傳 401。

### 項目二：前端全面串接驗證標頭 (`getAuthHeaders`)
- **原問題**：雖然建立了 `src/lib/authHeader.js`，但前端各功能頁面依然直接使用 `x-line-uid` 發送 API 請求。
- **修復內容**：
  全面接入 `getAuthHeaders(currentUid)`：
  1. `src/components/SchoolCalendar.jsx`：活動建立、更新、刪除、教職員清單載入、GAS 同步請求。
  2. `src/components/StaffList.jsx`：教職員名冊載入、新增、修改、刪除、解除綁定。
  3. `src/components/StudentList.jsx`：學生名冊查詢。
  4. `src/components/BulletinBoard.jsx`：公告列表、附件上傳、公告發布/保存、留言發布。
  5. `src/components/SchoolBrain.jsx`：知識庫查詢、文件上傳、知識庫刪除。
  6. `src/pages/RepairDashboard.jsx`：報修清單、新增報修、維修狀態更新。
  7. `src/pages/AdminDashboard.jsx`：學生匯入、教職員名單匯入、資料庫備份下載。
  8. `src/App.jsx`：報修紅點角標輪詢 (`fetchRepairBadge`)。

### 項目三：日曆併發防重複（徹底根絕 TOCTOU 競態條件）
- **原問題**：原代碼僅在新增前進行 `SELECT` 查詢，高併發連點下會發生 TOCTOU（Time-of-Check to Time-of-Use）漏洞，造成重複插入多筆相同活動。
- **修復架構（四層防護網）**：
  1. **前端 Client Request ID**：前端每次提交表單時，透過 `crypto.randomUUID()` 產生唯一的 `client_event_id` 隨 Payload 送出。
  2. **記憶體動態互斥鎖 (In-flight Mutex)**：後端 Node.js 執行期維護 `inFlightCreations` Map，以 `client_event_id` 或 `${calendarType}_${title}_${startTime}` 為 Key。若相同操作已在進行中，後續併發請求直接掛載等待同一個 Promise，不重複觸發資料庫寫入。
  3. **資料庫查重查詢**：檢查資料庫中是否存在相同 `client_event_id` 或相同 `(calendar_type, title, start_time)` 的未刪除事件。
  4. **PostgreSQL 唯一約束與衝突捕捉**：
     - 在 SQL 定義了 `idx_calendar_events_unique_time ON public.calendar_events (calendar_type, title, start_time)`。
     - 若發生資料庫層併發衝突（Postgres Error Code `23505`），程式優雅捕捉錯誤，並自動讀取已存在的紀錄返回，標記 `deduplicated: true`，回傳 HTTP 200/201，杜絕 500 錯誤與重複資料。

### 項目四：背景同步重試 (Retry with Backoff) 與真實錯誤回報
- **原問題**：同步失敗時吞掉錯誤，返回 200 與 0 筆資料，形成「假成功」。
- **修復內容**：
  1. **逾時控制**：使用 `AbortController` 為每次 Google Apps Script (GAS) 請求設定 6 秒嚴格逾時。
  2. **指數退避重試 (Exponential Backoff)**：最多重試 3 次，每次間隔時間指數遞增（`1000ms * 2^attempt`）。
  3. **拒絕假成功**：若重試後依然失敗，後端**嚴禁回傳 HTTP 200**，改為回傳 **`HTTP 502 Bad Gateway`**，並附帶具體錯誤訊息：
     ```json
     {
       "error": "Failed to fetch events from Google Apps Script after 3 attempts",
       "details": "..."
     }
     ```

### 項目五：自動化測試覆蓋與驗證
- **測試套件全面擴充**：
  - 由 59 項擴充至 **63 項全方位整合測試**。
  - 新增：
    - `api/calendar rejects mutating request without ID token with 401`
    - `api/calendar rejects non-admin role (role 4) with 403`
    - `api/calendar returns 502 when sync_from_gas encounters total connection failure`
    - `api/calendar concurrent POSTs with same client_event_id deduplicate via mutex`
- **執行結果**：
  ```text
  > wutpsdata@0.0.0 test
  > node --test tests/*.test.js

  ℹ tests 63
  ℹ suites 0
  ℹ pass 63
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 967.2338
  ```

---

## 3. 正式資料庫 Supabase RLS 與索引套用指南

請至 [Supabase Dashboard](https://supabase.com/dashboard) 進入專案的 **SQL Editor**，執行下列 SQL：

```sql
-- 1. 建立日曆活動防重複唯一索引 (校區 + 標題 + 開始時間)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_time
ON public.calendar_events (calendar_type, title, start_time);

-- 2. 建立 Google 日曆外部 ID 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_gcal_unique 
ON public.calendar_events (gcal_event_id) 
WHERE gcal_event_id IS NOT NULL AND gcal_event_id != '';

-- 3. 啟用 Row-Level Security (RLS)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- 4. 允許公眾唯讀 (公開活動日曆)
DROP POLICY IF EXISTS "Allow public read calendar_events" ON public.calendar_events;
CREATE POLICY "Allow public read calendar_events" 
ON public.calendar_events FOR SELECT USING (true);

-- 5. 僅允許後端 Service Role 進行增刪查改 (所有寫入必須經由後端 API 驗證 Token)
DROP POLICY IF EXISTS "Allow service role all calendar_events" ON public.calendar_events;
CREATE POLICY "Allow service role all calendar_events" 
ON public.calendar_events FOR ALL TO service_role USING (true);

-- 6. 徹底禁止匿名金鑰直接修改資料庫
DROP POLICY IF EXISTS "Allow anon write calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow anon update calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow anon delete calendar_events" ON public.calendar_events;
```

---

## 4. 結論

本系統在 Commit **`9c48bd3`** 已達成：
1. **真憑證防偽**：全管理端點強制 LINE 官方 ID Token 驗證，無 Token 嚴格 401。
2. **前後端閉環**：前端所有向後端發出之機敏請求，全面搭載 `getAuthHeaders`。
3. **高併發防護**：前端 UUID + 記憶體 Mutex + 資料庫 Unique Constraint 四重併發防護。
4. **可靠性與真實性**：外部 GAS 串接具備逾時重試機制，連線失敗真實反應 502，絕無假成功。
5. **程式庫健康度**：63 項單元測試 100% 通過，Vite 生產環境打包 0 錯誤。
