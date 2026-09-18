import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
let moduleId = 0;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('api/staff rejects dev-admin without valid database record', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    assert.equal(address.hostname, 'database.test');
    return json(null);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/staff.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    { method: 'GET', headers: { 'x-line-uid': 'dev-admin', 'x-line-id-token': 'test-token' } },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /查無此教職員身分/);
});

test('api/staff forbids deleting a superadmin record (role 0)', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      if (address.searchParams.get('line_uid')?.includes('super_user')) {
        return json({ id: 's1', line_uid: 'super_user', role_tags: '0' });
      }
      return json({ id: 'target1', role_tags: '0' });
    }
    throw new Error(`Unexpected call to ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/staff.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    { method: 'DELETE', headers: { 'x-line-uid': 'super_user', 'x-line-id-token': 'test-token' }, body: { id: 'target1' } },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /超級管理者帳號為系統核心保護對象/);
});

test('api/staff forbids demoting superadmin role tags', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 'target1', line_uid: 'super_user', role_tags: '0' });
    }
    throw new Error(`Unexpected call to ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/staff.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'PUT',
      headers: { 'x-line-uid': 'super_user', 'x-line-id-token': 'test-token' },
      body: { id: 'target1', updates: { role_tags: '4' } }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /無法將超級管理者降權/);
});

test('api/bind forbids public binding of role 0 superadmin', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 's0', email: 'admin@school.edu.tw', role_tags: '0', line_uid: null });
    }
    throw new Error(`Unexpected call: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/bind.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: { email: 'admin@school.edu.tw', userId: 'attacker_uid', id_token: 'test-token' }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /超級管理者帳號為系統核心身分，嚴禁由公開表單自主綁定/);
});

test('api/bind rejects overriding an already-bound staff account (409 Conflict)', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') {
      return json({ id: 't1', email: 'teacher@school.edu.tw', role_tags: '4', line_uid: 'legit_teacher_uid' });
    }
    throw new Error(`Unexpected call: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/bind.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: { email: 'teacher@school.edu.tw', userId: 'new_impersonator_uid', id_token: 'test-token' }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 409);
  assert.match(body.error, /此信箱已綁定其他 LINE 帳號/);
});

test('api/line_webhook rejects POST when signature is missing', async t => {
  process.env.LINE_CHANNEL_SECRET = 'test-secret';
  t.after(() => { delete process.env.LINE_CHANNEL_SECRET; });

  const { default: handler } = await import(`../api/line_webhook.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: {},
      body: { events: [] }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /Missing LINE signature/);
});

test('api/line_webhook rejects POST when signature is invalid', async t => {
  process.env.LINE_CHANNEL_SECRET = 'test-secret';
  t.after(() => { delete process.env.LINE_CHANNEL_SECRET; });

  const { default: handler } = await import(`../api/line_webhook.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-signature': 'invalid-signature' },
      body: JSON.stringify({ events: [] })
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /Invalid LINE signature/);
});

test('api/line_webhook accepts POST with valid HMAC-SHA256 signature', async t => {
  const secret = 'test-channel-secret';
  process.env.LINE_CHANNEL_SECRET = secret;
  t.after(() => { delete process.env.LINE_CHANNEL_SECRET; });

  const bodyString = JSON.stringify({ events: [] });
  const validSignature = crypto.createHmac('SHA256', secret).update(bodyString).digest('base64');

  const { default: handler } = await import(`../api/line_webhook.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-signature': validSignature },
      body: bodyString
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 200);
});

test('api/brain rejects write/delete when x-line-uid is missing', async t => {
  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: {},
      body: { title: '測試文件', dept_id: 'acad' }
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

test('api/brain rejects write/delete for unregistered LINE UID', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    const table = address.pathname.split('/').pop();
    if (table === 'staff') return json(null);
    throw new Error(`Unexpected call: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/brain.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'unknown_stranger', 'x-line-id-token': 'test-token' },
      body: { title: '測試文件', dept_id: 'acad' }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 403);
  assert.match(body.error, /僅限已建檔之教職員/);
});
