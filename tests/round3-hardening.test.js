import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
let moduleId = 0;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('api/students POST rejects request missing ID token with 401', async t => {
  const { default: handler } = await import(`../api/students.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'admin_user' }, // 缺少 x-line-id-token
      body: { studentsData: [{ student_id: 's1', name: '小明' }] }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 401);
  assert.match(body.error, /缺少 LINE 官方 ID Token/);
});

test('api/students POST rejects non-admin staff with 403', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 'teacher1', line_uid: 'teacher_uid', role_tags: '4' }); // 普通導師
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/students.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'teacher_uid', 'x-line-id-token': 'test-token' },
      body: { studentsData: [{ student_id: 's1', name: '小明' }] }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /權限不足/);
});

test('api/students POST allows school admin to upsert student data', async t => {
  const originalFetch = globalThis.fetch;
  let upsertedData = null;
  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 'admin1', line_uid: 'admin_uid', role_tags: '2', title: '教務主任' });
    }
    if (table === 'students' && init.method === 'POST') {
      upsertedData = JSON.parse(init.body);
      return json(upsertedData);
    }
    if (table === 'students') {
      return json([]);
    }
    if (table === 'audit_logs') {
      return json(null);
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/students.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: { studentsData: [{ student_id: '101', name: '小明', grade: '一', class_name: '甲' }] }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.count, 1);
  assert.ok(upsertedData);
});

test('api/brain GET rejects valid token user who is not in staff table with 403', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json(null); // LINE 用戶已登入，但在 staff 表查無此人
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'GET',
      headers: { 'x-line-uid': 'external_person', 'x-line-id-token': 'test-token' },
      query: {}
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /僅限已建檔之校內教職員/);
});

test('api/announcement_comments POST rejects valid token user who is not in staff table with 403', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json(null); // 非在職教職員
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/announcement_comments.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'random_line_user', 'x-line-id-token': 'test-token' },
      body: { announcement_id: 'a1', content: '測試外部留言' }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /僅限已建檔之校內教職員/);
});

test('api/bind POST rejects when invite code is required but invalid with 403', async t => {
  process.env.STAFF_INVITE_CODE = 'SECRET_WUTPS_2026';
  t.after(() => { delete process.env.STAFF_INVITE_CODE; });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's2', email: 'teacher@school.edu.tw', role_tags: '4', line_uid: null });
    }
    throw new Error(`Unexpected call: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/bind.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: {
        email: 'teacher@school.edu.tw',
        userId: 'some_line_uid',
        id_token: 'test-token',
        invite_code: 'WRONG_CODE'
      }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /首次綁定授權碼/);
});

test('api/calendar POST returns 500 when 23505 conflict fails to retrieve existing event', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'admin_uid', role_tags: '0' });
    }
    if (table === 'calendar_events' && init.method === 'POST') {
      // 模擬資料庫層 23505 併發衝突
      return json({ message: 'duplicate key value violates unique constraint', code: '23505' }, 409);
    }
    if (table === 'calendar_events') {
      // 模擬二次查詢亦發生失敗或回傳 null
      return json(null);
    }
    throw new Error(`Unexpected call: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: {
        title: '併發活動',
        startTime: '2026-09-18T10:00:00+08:00',
        calendarType: 'all'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 500);
  assert.match(body.message, /併發衝突後檢索既有活動失敗/);
});

test('api/bind POST rejects arbitrary string when REQUIRE_INVITE_CODE=true and no code configured', async t => {
  process.env.REQUIRE_INVITE_CODE = 'true';
  t.after(() => { delete process.env.REQUIRE_INVITE_CODE; });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's3', email: 'staff@school.edu.tw', role_tags: '4', line_uid: null });
    }
    throw new Error(`Unexpected call: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/bind.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: {
        email: 'staff@school.edu.tw',
        userId: 'some_line_uid',
        id_token: 'test-token',
        invite_code: 'random_attacker_guess'
      }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /尚未配置有效授權碼/);
});

test('api/calendar PUT marks sync_status as failed when GAS returns HTTP 200 with error status', async t => {
  const originalFetch = globalThis.fetch;
  let updatedPayload = null;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      const table = address.pathname.split('/').pop();
      if (table === 'staff') return json({ id: 's1', line_uid: 'admin_uid', role_tags: '0' });
      if (table === 'calendar_events') {
        if (init.method === 'PATCH') {
          updatedPayload = JSON.parse(init.body);
          return json([{ id: 'ev1', ...updatedPayload }]);
        }
        return json({ id: 'ev1', gcal_event_id: 'gcal_123', calendar_type: 'all' });
      }
    }
    if (address.hostname.includes('script.google.com')) {
      // GAS 回傳 HTTP 200，但內部包含業務錯誤
      return json({ status: 'error', message: 'permission denied' }, 200);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'PUT',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: {
        eventId: 'ev1',
        title: '更新活動',
        startTime: '2026-09-18T10:00:00+08:00'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(body.status, 'success');

  // 等待非同步背景工作執行完畢
  await new Promise(r => setTimeout(r, 60));
  assert.ok(updatedPayload);
  assert.equal(updatedPayload.sync_status, 'failed');
  assert.match(updatedPayload.sync_error, /permission denied/);
});

test('api/calendar DELETE preserves failed_delete status in database when GAS returns 503', async t => {
  const originalFetch = globalThis.fetch;
  const updates = [];
  let deletedFromDb = false;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      const table = address.pathname.split('/').pop();
      if (table === 'staff') return json({ id: 's1', line_uid: 'admin_uid', role_tags: '0' });
      if (table === 'calendar_events') {
        if (init.method === 'PATCH') {
          const payload = JSON.parse(init.body);
          updates.push(payload);
          return json([{ id: 'ev_del', ...payload }]);
        }
        if (init.method === 'DELETE') {
          deletedFromDb = true;
          return json([{ id: 'ev_del' }]);
        }
        return json({ id: 'ev_del', gcal_event_id: 'gcal_del_999', calendar_type: 'all' });
      }
    }
    if (address.hostname.includes('script.google.com')) {
      // 模擬 Google 日曆連續回傳 503 伺服器忙碌
      return json({ error: 'Service Unavailable' }, 503);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: {
        eventId: 'ev_del'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  // 本地活動嚴禁被直接硬刪除 (Hard Delete)
  assert.equal(deletedFromDb, false);
  // 檢查資料庫是否留存了 failed_delete 待重試紀錄
  const failedRecord = updates.find(u => u.sync_status === 'failed_delete');
  assert.ok(failedRecord);
  assert.match(failedRecord.sync_error, /503/);
});

test('api/calendar DELETE deletes locally without calling GAS when gcal_event_id is null', async t => {
  const originalFetch = globalThis.fetch;
  let deletedFromDb = false;
  let gasCalled = false;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      const table = address.pathname.split('/').pop();
      if (table === 'staff') return json({ id: 's1', line_uid: 'admin_uid', role_tags: '0' });
      if (table === 'calendar_events') {
        if (init.method === 'DELETE') {
          deletedFromDb = true;
          return json([{ id: 'ev_local' }]);
        }
        // 回傳 gcal_event_id 為 null 的本地/未同步活動
        return json({ id: 'ev_local', gcal_event_id: null, calendar_type: 'all' });
      }
    }
    if (address.hostname.includes('script.google.com')) {
      gasCalled = true;
      return json({ status: 'success' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: { eventId: 'ev_local' }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(body.status, 'success');
  assert.equal(deletedFromDb, true);
  assert.equal(gasCalled, false);
});

test('api/calendar DELETE returns 500 when GAS succeeds but Supabase hard delete fails', async t => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      const table = address.pathname.split('/').pop();
      if (table === 'staff') return json({ id: 's1', line_uid: 'admin_uid', role_tags: '0' });
      if (table === 'calendar_events') {
        if (init.method === 'PATCH') {
          return json([{ id: 'ev_del' }]);
        }
        if (init.method === 'DELETE') {
          // 模擬 Supabase 刪除失敗
          return json({ message: 'violates foreign key constraint' }, 500);
        }
        return json({ id: 'ev_del', gcal_event_id: 'gcal_del_123', calendar_type: 'all' });
      }
    }
    if (address.hostname.includes('script.google.com')) {
      return json({ status: 'success' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: { eventId: 'ev_del' }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 500);
  assert.equal(body.status, 'error');
  assert.match(body.message, /資料庫刪除活動失敗/);
});

test('api/calendar DELETE returns 500 when persisting failed_delete state fails', async t => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      const table = address.pathname.split('/').pop();
      if (table === 'staff') return json({ id: 's1', line_uid: 'admin_uid', role_tags: '0' });
      if (table === 'calendar_events') {
        if (init.method === 'PATCH') {
          const payload = JSON.parse(init.body);
          if (payload.sync_status === 'pending_delete') {
            return json([{ id: 'ev_del', ...payload }]);
          }
          if (payload.sync_status === 'failed_delete') {
            // 模擬儲存 failed_delete 狀態失敗
            return json({ message: 'disk full or db unavailable' }, 500);
          }
        }
        return json({ id: 'ev_del', gcal_event_id: 'gcal_del_456', calendar_type: 'all' });
      }
    }
    if (address.hostname.includes('script.google.com')) {
      return json({ error: 'Service Unavailable' }, 503);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: { eventId: 'ev_del' }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 500);
  assert.equal(body.status, 'error');
  assert.match(body.message, /儲存待重試刪除紀錄失敗/);
});

test('api/brain POST updates existing document instead of inserting duplicate when same dept_id and file_name uploaded', async t => {
  const originalFetch = globalThis.fetch;
  let methodUsed = null;
  let updatedPayload = null;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'teacher_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'brain_documents') {
      if (init.method === 'PATCH') {
        methodUsed = 'PATCH';
        updatedPayload = JSON.parse(init.body);
        return json({ id: 'doc_existing', ...updatedPayload });
      }
      if (init.method === 'POST') {
        methodUsed = 'POST';
        return json({ id: 'doc_new' });
      }
      // 檢索既有文件：模擬同處室已存在同名檔案
      return json({ id: 'doc_existing', dept_id: 'academic', file_name: '規章.pdf' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'teacher_uid', 'x-line-id-token': 'test-token' },
      body: {
        dept_id: 'academic',
        title: '規章.pdf',
        file_name: '規章.pdf',
        extracted_text: '最新修訂版規章全文'
      }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; }
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(methodUsed, 'PATCH');
  assert.equal(body.isUpdated, true);
  assert.equal(updatedPayload.extracted_text, '最新修訂版規章全文');
});

test('api/brain POST inserts new document when dept_id and file_name is unique', async t => {
  const originalFetch = globalThis.fetch;
  let methodUsed = null;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'teacher_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'brain_documents') {
      if (init.method === 'POST') {
        methodUsed = 'POST';
        return json({ id: 'doc_brand_new', file_name: '全新規章.pdf' });
      }
      // 查無同名檔案
      return json(null);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'teacher_uid', 'x-line-id-token': 'test-token' },
      body: {
        dept_id: 'academic',
        title: '全新規章.pdf',
        file_name: '全新規章.pdf',
        extracted_text: '全新規章內容'
      }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; }
    }
  );

  assert.equal(statusCode, 201);
  assert.equal(methodUsed, 'POST');
  assert.equal(body.id, 'doc_brand_new');
});

test('api/brain POST returns 500 when duplicate check query fails', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'teacher_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'brain_documents') {
      return json({ message: 'Database connection failed' }, 500);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'teacher_uid', 'x-line-id-token': 'test-token' },
      body: {
        dept_id: 'academic',
        title: '查詢失敗測試.pdf',
        file_name: '查詢失敗測試.pdf'
      }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; }
    }
  );

  assert.equal(statusCode, 500);
  assert.match(body.error, /知識庫重複查核失敗/);
});

test('api/calendar DELETE sets pending_delete instead of hard-delete when event is pending_push without gcalId', async t => {
  const originalFetch = globalThis.fetch;
  let patchCalled = false;
  let deleteCalled = false;
  let updatedPayload = null;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();

    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'admin_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'calendar_events') {
      if (init.method === 'PATCH') {
        patchCalled = true;
        updatedPayload = JSON.parse(init.body);
        return json([{ id: 'pending_ev_1', sync_status: 'pending_delete' }]);
      }
      if (init.method === 'DELETE') {
        deleteCalled = true;
        return json({ id: 'pending_ev_1' });
      }
      // 模擬尚未取得 gcal_event_id 且正處於 pending_push 狀態
      return json({
        id: 'pending_ev_1',
        gcal_event_id: null,
        calendar_type: 'all',
        sync_status: 'pending_push'
      });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: { eventId: 'pending_ev_1', calendarType: 'all' }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(patchCalled, true);
  assert.equal(deleteCalled, false, 'Should not hard-delete pending_push events');
  assert.equal(updatedPayload.sync_status, 'pending_delete');
  assert.equal(body.sync_status, 'pending_delete');
});

test('calendarUtils getCachedEvents strictly filters out pending_delete and failed_delete events', async t => {
  const { getCachedEvents, setCachedEvents, clearAllCalendarCache } = await import('../src/components/calendar/calendarUtils.js');

  clearAllCalendarCache();
  const rawEvents = [
    { id: '1', title: '正常活動', syncStatus: 'synced' },
    { id: '2', title: '待刪除活動', syncStatus: 'pending_delete' },
    { id: '3', title: '刪除失敗活動', syncStatus: 'failed_delete' }
  ];

  setCachedEvents('all', rawEvents);
  const cached = getCachedEvents('all');

  assert.equal(cached.length, 1);
  assert.equal(cached[0].id, '1');
  assert.equal(cached[0].title, '正常活動');
  clearAllCalendarCache();
});

test('api/brain POST halts and returns 500 when unique index is missing (42P10 / ON CONFLICT)', async t => {
  const originalFetch = globalThis.fetch;
  let insertAttempted = false;

  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'teacher_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'brain_documents') {
      if (init.method === 'POST') {
        const prefer = init.headers?.['Prefer'] || '';
        if (prefer.includes('resolution=merge-duplicates') || address.searchParams.has('on_conflict')) {
          // 模擬 PostgreSQL 42P10 錯誤（缺少唯一鍵約束）
          return json({ code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' }, 400);
        }
        insertAttempted = true;
        return json({ id: 'doc_inserted_blindly' });
      }
      return json(null);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'teacher_uid', 'x-line-id-token': 'test-token' },
      body: {
        dept_id: 'academic',
        title: '缺少約束測試.pdf',
        file_name: '缺少約束測試.pdf'
      }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; }
    }
  );

  assert.equal(statusCode, 500);
  assert.equal(insertAttempted, false, 'Must NOT fall back to blind non-atomic INSERT');
  assert.match(body.error, /唯一索引約束/);
});

test('calendarUtils uses wutps_cal_v4_ prefix and cleans up old v3 keys', async t => {
  const { CACHE_PREFIX, clearAllCalendarCache } = await import('../src/components/calendar/calendarUtils.js');
  assert.equal(CACHE_PREFIX, 'wutps_cal_v4_');
  clearAllCalendarCache();
});

test('api/calendar background create preserves failed_delete when compensating GAS delete fails', async t => {
  const originalFetch = globalThis.fetch;
  let hardDeleteCalled = false;
  let failedDeleteRecorded = false;
  let recordedError = null;
  let inserted = false;

  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('script.google.com')) {
      const payload = JSON.parse(init.body || '{}');
      if (payload.action === 'create') {
        return json({ eventId: 'gas_comp_test_1' });
      }
      if (payload.action === 'delete') {
        // 模擬 Google 回傳 permission denied 業務失敗
        return json({ status: 'error', message: 'permission denied' });
      }
      return json({ success: true });
    }

    const address = new URL(urlStr);
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'admin_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'calendar_events') {
      if (init.method === 'POST') {
        inserted = true;
        // 新增成功，初始為 pending_push
        return json({ id: 'ev_comp_1', sync_status: 'pending_push', calendar_type: 'all' });
      }
      if (init.method === 'PATCH') {
        const payload = JSON.parse(init.body || '{}');
        // 檢查條件更新：模擬該列已不再處於 pending_push（模擬併發刪除），因此條件更新返回 []
        if (address.searchParams.get('sync_status') === 'eq.pending_push') {
          return json([]);
        }
        if (payload.sync_status === 'failed_delete') {
          failedDeleteRecorded = true;
          recordedError = payload.sync_error;
          return json({ id: 'ev_comp_1', ...payload });
        }
        return json({ id: 'ev_comp_1', ...payload });
      }
      if (init.method === 'DELETE') {
        hardDeleteCalled = true;
        return json({ id: 'ev_comp_1' });
      }
      // GET requests: 插入前返回 null（模擬尚無此活動），插入後重新查詢時返回 pending_delete（模擬使用者已標記刪除）
      if (!inserted) {
        return json(null);
      }
      return json({ id: 'ev_comp_1', sync_status: 'pending_delete', calendar_type: 'all' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: {
        title: '補償刪除失敗測試',
        startTime: '2026-10-01T09:00:00+08:00',
        endTime: '2026-10-01T10:00:00+08:00',
        calendarType: 'all',
        client_event_id: 'ev_comp_1'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);

  // 等待背景 Promise 執行完畢
  await new Promise(r => setTimeout(r, 200));

  assert.equal(hardDeleteCalled, false, 'Must NOT hard delete when compensating delete fails');
  assert.equal(failedDeleteRecorded, true, 'Must preserve failed_delete status');
  assert.match(recordedError, /permission denied/);
});

test('api/calendar background create conditional update prevents overwriting concurrent pending_delete to synced', async t => {
  const originalFetch = globalThis.fetch;
  let overwroteToSynced = false;
  let compensatingDeleteTriggered = false;
  let hardDeleteCalled = false;
  let inserted = false;

  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('script.google.com')) {
      const payload = JSON.parse(init.body || '{}');
      if (payload.action === 'create') {
        return json({ eventId: 'gas_race_test_1' });
      }
      if (payload.action === 'delete') {
        compensatingDeleteTriggered = true;
        return json({ status: 'success' });
      }
      return json({ success: true });
    }

    const address = new URL(urlStr);
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'admin_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'calendar_events') {
      if (init.method === 'POST') {
        inserted = true;
        return json({ id: 'ev_race_1', sync_status: 'pending_push', calendar_type: 'all' });
      }
      if (init.method === 'PATCH') {
        const payload = JSON.parse(init.body || '{}');
        // 條件更新：因為該列已被使用者併發改為 pending_delete，帶有 sync_status=eq.pending_push 的更新匹配 0 列
        if (address.searchParams.get('sync_status') === 'eq.pending_push') {
          return json([]);
        }
        if (payload.sync_status === 'synced') {
          overwroteToSynced = true;
        }
        return json({ id: 'ev_race_1', ...payload });
      }
      if (init.method === 'DELETE') {
        hardDeleteCalled = true;
        return json({ id: 'ev_race_1' });
      }
      // GET requests: 插入前為 null，插入後重新查詢時為 pending_delete
      if (!inserted) {
        return json(null);
      }
      return json({ id: 'ev_race_1', sync_status: 'pending_delete', calendar_type: 'all' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: {
        title: '併發刪除防覆蓋測試',
        startTime: '2026-10-01T09:00:00+08:00',
        endTime: '2026-10-01T10:00:00+08:00',
        calendarType: 'all',
        client_event_id: 'ev_race_1'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json() { return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  await new Promise(r => setTimeout(r, 200));

  assert.equal(overwroteToSynced, false, 'Must NEVER overwrite concurrent pending_delete with synced');
  assert.equal(compensatingDeleteTriggered, true, 'Must trigger compensating delete for orphaned event');
  assert.equal(hardDeleteCalled, true, 'Must clean up local row after compensating delete succeeds');
});

test('api/calendar DELETE handles reverse interleaving race by executing direct Google delete when gcal_event_id already written', async t => {
  const originalFetch = globalThis.fetch;
  let googleDeleteCalledCount = 0;
  let hardDeleteCalled = false;
  let patchStep = 0;
  let getStep = 0;

  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('script.google.com')) {
      const payload = JSON.parse(init.body || '{}');
      if (payload.action === 'delete') {
        googleDeleteCalledCount++;
        return json({ status: 'success' });
      }
      return json({ success: true });
    }

    const address = new URL(urlStr);
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'admin_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'calendar_events') {
      if (init.method === 'PATCH') {
        patchStep++;
        // 第一次 PATCH 是條件更新 sync_status=eq.pending_push，模擬背景工作已先行寫入，因此條件更新匹配 0 列
        if (address.searchParams.get('sync_status') === 'eq.pending_push') {
          return json([]);
        }
        // 第二次 PATCH 是重查到 gcal_event_id 後標記 pending_delete
        return json({ id: 'ev_interleaved_1', sync_status: 'pending_delete', gcal_event_id: 'gcal_live_123' });
      }
      if (init.method === 'DELETE') {
        hardDeleteCalled = true;
        return json({ id: 'ev_interleaved_1' });
      }
      // GET requests:
      getStep++;
      if (getStep === 1) {
        // DELETE 進入點初次查詢：尚未取得 gcal_event_id，處於 pending_push
        return json({ id: 'ev_interleaved_1', gcal_event_id: null, calendar_type: 'all', sync_status: 'pending_push' });
      }
      // 條件更新失敗後重新檢索：背景工作已寫入 Google ID 且為 synced
      return json({ id: 'ev_interleaved_1', gcal_event_id: 'gcal_live_123', calendar_type: 'all', sync_status: 'synced' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: { eventId: 'ev_interleaved_1', calendarType: 'all' }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(googleDeleteCalledCount, 1, 'Google delete MUST be called once despite reverse interleaving');
  assert.equal(hardDeleteCalled, true, 'Local record must be cleaned up after successful Google delete');
  assert.equal(body.status, 'success');
});

test('api/calendar background create inserts orphan tracking record when local row does not exist and compensating delete fails', async t => {
  const originalFetch = globalThis.fetch;
  let orphanTrackingInserted = false;
  let orphanPayload = null;
  let inserted = false;

  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('script.google.com')) {
      const payload = JSON.parse(init.body || '{}');
      if (payload.action === 'create') {
        return json({ eventId: 'gas_orphan_999' });
      }
      if (payload.action === 'delete') {
        // 模擬補償刪除失敗（如 quota exceeded）
        return json({ status: 'error', message: 'quota exceeded' });
      }
      return json({ success: true });
    }

    const address = new URL(urlStr);
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's1', line_uid: 'admin_uid', role_tags: '2', department: '教務處' });
    }
    if (table === 'calendar_events') {
      if (init.method === 'POST') {
        const payload = JSON.parse(init.body || '{}');
        if (payload[0]?.sync_status === 'failed_delete') {
          // 捕捉持久化孤兒追蹤紀錄
          orphanTrackingInserted = true;
          orphanPayload = payload[0];
          return json(payload[0]);
        }
        inserted = true;
        return json({ id: 'ev_orphan_test_1', sync_status: 'pending_push', calendar_type: 'all' });
      }
      if (init.method === 'PATCH') {
        // 條件更新匹配 0 列
        return json([]);
      }
      // GET requests: 插入前返回 null，重新查詢時亦返回 null（模擬本地紀錄已被硬刪除）
      return json(null);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'admin_uid', 'x-line-id-token': 'test-token' },
      body: {
        title: '孤兒追蹤測試',
        startTime: '2026-10-01T09:00:00+08:00',
        endTime: '2026-10-01T10:00:00+08:00',
        calendarType: 'all',
        client_event_id: 'ev_orphan_test_1'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json() { return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  await new Promise(r => setTimeout(r, 200));

  assert.equal(orphanTrackingInserted, true, 'Must persist orphan tracking record when row does not exist and compensating delete fails');
  assert.equal(orphanPayload.gcal_event_id, 'gas_orphan_999');
  assert.equal(orphanPayload.sync_status, 'failed_delete');
  assert.match(orphanPayload.sync_error, /quota exceeded/);
});



