import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': '0-0/1'
    }
  });

let testModuleId = 0;

test('GET /api/keepalive returns 200 healthy when database responds', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    assert.equal(address.hostname, 'database.test');
    assert.equal(address.pathname, '/rest/v1/staff');
    return json([{ id: 'staff-1' }]);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/keepalive.js?test=${++testModuleId}`);
  let statusCode, body;
  await handler(
    { method: 'GET' },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(body.status, 'healthy');
  assert.equal(body.database, 'supabase_active');
});

test('GET /api/keepalive returns 503 paused status when database connection fails', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed: getaddrinfo ENOTFOUND kxedexdzlnyqkeemepyu.supabase.co');
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/keepalive.js?test=${++testModuleId}`);
  let statusCode, body;
  await handler(
    { method: 'GET' },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 503);
  assert.equal(body.status, 'paused');
  assert.match(body.hint, /Supabase 專案處於休眠狀態/);
});

test('POST /api/auth returns 503 DATABASE_PAUSED when database connection fails', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('rest/v1/staff')) {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND kxedexdzlnyqkeemepyu.supabase.co');
    }
    return json(null);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/auth.js?test=${++testModuleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: { line_uid: 'U_SUPER_ADMIN', id_token: 'test-admin-token' }
    },
    {
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; }
    }
  );

  assert.equal(statusCode, 503);
  assert.equal(body.error, 'DATABASE_PAUSED');
  assert.match(body.message, /休眠狀態/);
});
