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
