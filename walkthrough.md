# 屏東縣霧臺國小校務系統 (wutpsdata) 第四輪外部審查修復竣工報告

本報告針對外部 AI（ChatGPT）第四輪查核所指出之 **3 項具體缺口**（邀請碼拒絕條件、GAS 業務成功判定、刪除工作持久化），提供完整之實裝與驗證成果。

---

## 1. 針對第四輪 3 大項目之修補與實裝細節

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           第四輪審核 3 大項目修補矩陣                         │
├───────────────────┬───────────────────────────────┬─────────────────────────┤
│ 審核項目          │ 第四輪判定 (acced33)          │ 本次加固成果            │
├───────────────────┼───────────────────────────────┼─────────────────────────┤
│ 1. 邀請碼強制模式 │ 未配置正確碼時填任意字串放行  │ 嚴格拒絕未配置或不符授權│
│ 2. GAS 業務失敗   │ HTTP 200 內含 error 誤判成功  │ 同時校驗 HTTP 與業務狀態│
│ 3. 刪除失敗留痕   │ Google 刪除失敗後本地活動已空 │ 狀態標註 failed_delete  │
└───────────────────┴───────────────────────────────┴─────────────────────────┘
```

### 項目一：邀請碼強制模式嚴格防冒領 (`api/bind.js`)
- **原問題**：在 `REQUIRE_INVITE_CODE=true` 但資料庫未配置邀請碼時，填寫任意非空字串仍能綁定。
- **修復邏輯**：
  ```javascript
  const providedCode = (req.body.invite_code || req.body.bind_code || '').trim();
  const expectedCode = (existingStaff.bind_code || existingStaff.details?.bind_code || process.env.STAFF_INVITE_CODE || '').trim();
  const isExplicitlyApproved = existingStaff.approved_for_binding === true || existingStaff.details?.approved_for_binding === true;
  const isMandatoryMode = process.env.REQUIRE_INVITE_CODE === 'true' || process.env.NODE_ENV === 'production';

  if (isMandatoryMode || expectedCode) {
    // 情況 A：系統要求查驗，但尚未設定有效授權碼且未獲管理員直接核准 -> 嚴格拒絕綁定 (403)
    if (!expectedCode && !isExplicitlyApproved) {
      return res.status(403).json({ error: '此教職員帳號尚未配置有效授權碼或核准紀錄，無法進行自主綁定，請向學校系統管理員索取邀請碼。' });
    }
    // 情況 B：有授權碼，但使用者未填或填寫不相符 -> 拒絕綁定 (403)
    if (expectedCode && (!providedCode || providedCode !== expectedCode)) {
      return res.status(403).json({ error: '首次綁定授權碼 (邀請碼) 不正確。為保障教職員帳號安全，請向學校系統管理員索取綁定驗證碼。' });
    }
  }
  ```
- **測試結果**：當 `REQUIRE_INVITE_CODE=true` 且未設定邀請碼時，提交任意猜測字串立即回傳 `403 Forbidden`，無法繞過。

### 項目二：Google Apps Script 業務失敗判定與永久錯誤識別 (`api/calendar.js`)
- **原問題**：GAS 回傳 HTTP 200 但 payload 內含 `{"status":"error","message":"permission denied"}` 時，曾被誤判為 `synced` 成功。
- **修復內容**：
  1. `sendGasWriteWithRetry` 同時查驗 HTTP 狀態碼與 JSON 業務狀態：
     - 若 `data.status === 'error'` 或 `data.success === false`，認定為失敗。
     - 區分**永久性權限/配置錯誤**（`permission denied`, `unauthorized`, `forbidden`, `not found`, `invalid_grant`），立即提早返回失敗，不再無謂重複嘗試。
     - 若為暫時性連線異常，繼續進行最多 3 次指數退避重試。
  2. 新增操作 (`create`) 嚴格查驗傳回之 `data.eventId` 或 `data.id` 是否有效。
  3. 若 Google 寫入失敗，資料庫紀錄將如實標註為 `sync_status: 'failed'` 並留存 `sync_error`，絕不標為 `synced`。

### 項目三：Google 刪除失敗持久化留存與防幽靈活動 (`api/calendar.js`)
- **原問題**：刪除活動時若 Google 刪除連線失敗，本地已被刪除，無法留下失敗紀錄，後續同步時活動可能復活。
- **修復內容**：
  1. **軟刪除準備狀態**：刪除前先更新活動狀態為 `sync_status: 'pending_delete'`。
  2. **等待 Google 刪除確認**：`await sendGasWriteWithRetry` 等待 Google 日曆完成刪除。
     - 若 Google 刪除成功：執行資料庫硬刪除清理 (`Hard Delete`)。
     - 若 Google 刪除失敗（如 503）：**保留資料庫紀錄**，更新為 `sync_status: 'failed_delete'` 並記錄錯誤訊息，供後續重試機制補做。
  3. **防幽靈活動復活**：
     - `GET /api/calendar` 自動排除 `pending_delete` 與 `failed_delete` 活動，使用者在介面上立即感知活動已被移除。
     - `sync_from_gas` 在從 Google 拉取活動時，主動比對並跳過已標記為 `failed_delete` 或 `pending_delete` 的活動，防止被刪除的活動重新復活。

---

## 2. 全系統自動化測試驗證 (Node.js Test Runner)

測試套件擴充至 **73 項全方位測試，全數通過 (100%)**：

```text
> wutpsdata@0.0.0 test
> node --test tests/*.test.js

✔ api/students POST rejects request missing ID token with 401
✔ api/students POST rejects non-admin staff with 403
✔ api/students POST allows school admin to upsert student data
✔ api/brain GET rejects valid token user who is not in staff table with 403
✔ api/announcement_comments POST rejects valid token user who is not in staff table with 403
✔ api/bind POST rejects when invite code is required but invalid with 403
✔ api/bind POST rejects arbitrary string when REQUIRE_INVITE_CODE=true and no code configured
✔ api/calendar PUT marks sync_status as failed when GAS returns HTTP 200 with error status
✔ api/calendar DELETE preserves failed_delete status in database when GAS returns 503
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
ℹ tests 73
ℹ suites 0
ℹ pass 73
ℹ fail 0
ℹ duration_ms 1029.332
```

---

## 3. 前端打包驗證

```text
> vite build
✓ 2347 modules transformed.
dist/index.html    0.45 kB
dist/assets/index.js 1,744.63 kB
✓ built in 1.15s (Exit code 0)
```
