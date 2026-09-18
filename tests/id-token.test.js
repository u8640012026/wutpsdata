import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLineIdToken } from '../api/line_auth.js';

process.env.NODE_ENV = 'test';
process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
let moduleId = 0;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('verifyLineIdToken fails when token is empty', async () => {
  const result = await verifyLineIdToken(null);
  assert.equal(result.valid, false);
  assert.match(result.error, /缺少 LINE ID Token/);
});

test('verifyLineIdToken allows test tokens in test environment', async () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const result = await verifyLineIdToken('test-valid-jwt', 'U12345');
    assert.equal(result.valid, true);
    assert.equal(result.payload.sub, 'U12345');
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('verifyLineIdToken calls LINE verify endpoint and detects mismatch', async (t) => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    assert.equal(String(url), 'https://api.line.me/oauth2/v2.1/verify');
    return json({
      iss: 'https://access.line.me',
      sub: 'U_ACTUAL_USER',
      aud: '2011376584',
      exp: Math.floor(Date.now() / 1000) + 3600
    });
  };

  t.after(() => {
    process.env.NODE_ENV = prevEnv;
    globalThis.fetch = originalFetch;
  });

  // Mismatched expected UID
  const resultMismatch = await verifyLineIdToken('real-jwt-token', 'U_HACKER_SPOOFED');
  assert.equal(resultMismatch.valid, false);
  assert.match(resultMismatch.error, /不符/);

  // Matching expected UID
  const resultMatch = await verifyLineIdToken('real-jwt-token', 'U_ACTUAL_USER');
  assert.equal(resultMatch.valid, true);
  assert.equal(resultMatch.payload.sub, 'U_ACTUAL_USER');
});

test('api/auth rejects invalid ID token with 401', async (t) => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes('api.line.me')) {
      return json({ error: 'invalid_request', error_description: 'Invalid ID token' }, 400);
    }
    return json(null);
  };

  t.after(() => {
    process.env.NODE_ENV = prevEnv;
    globalThis.fetch = originalFetch;
  });

  const { default: authHandler } = await import(`../api/auth.js?test=${++moduleId}`);
  let statusCode, body;
  await authHandler(
    { method: 'POST', body: { line_uid: 'U12345', id_token: 'fake-invalid-token' } },
    {
      status(c) { statusCode = c; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 401);
  assert.match(body.error, /LINE 官方驗證失敗/);
});

test('api/bind rejects invalid ID token with 401', async (t) => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes('api.line.me')) {
      return json({ error: 'invalid_request', error_description: 'Token expired' }, 400);
    }
    return json(null);
  };

  t.after(() => {
    process.env.NODE_ENV = prevEnv;
    globalThis.fetch = originalFetch;
  });

  const { default: bindHandler } = await import(`../api/bind.js?test=${++moduleId}`);
  let statusCode, body;
  await bindHandler(
    { 
      method: 'POST', 
      body: { 
        email: 'teacher@school.edu.tw', 
        displayName: 'Test', 
        userId: 'U12345', 
        id_token: 'expired-token' 
      } 
    },
    {
      status(c) { statusCode = c; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 401);
  assert.match(body.error, /LINE 官方驗證失敗/);
});

test('api/staff rejects invalid x-line-id-token with 401', async (t) => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes('api.line.me')) {
      return json({ error: 'invalid_request', error_description: 'Signature invalid' }, 400);
    }
    return json(null);
  };

  t.after(() => {
    process.env.NODE_ENV = prevEnv;
    globalThis.fetch = originalFetch;
  });

  const { default: staffHandler } = await import(`../api/staff.js?test=${++moduleId}`);
  let statusCode, body;
  await staffHandler(
    { 
      method: 'GET', 
      headers: { 
        'x-line-uid': 'U_ADMIN', 
        'x-line-id-token': 'forged-token' 
      } 
    },
    {
      status(c) { statusCode = c; return this; },
      json(v) { body = v; return this; },
      send(v) { body = v; }
    }
  );

  assert.equal(statusCode, 401);
  assert.match(body.error, /LINE 官方驗證失敗/);
});

test('api/calendar prevents duplicate event creation on identical campus, title, and start_time', async (t) => {
  const originalFetch = globalThis.fetch;
  let queriedFilters = [];

  globalThis.fetch = async (url, opts) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      const table = address.pathname.split('/').pop();
      if (table === 'staff') return json({ id: 's1', line_uid: 'U_ADMIN', role_tags: '0' });
      queriedFilters.push(address.search);
      // Simulate existing duplicate record
      return json({
        id: 'existing-event-1',
        calendar_type: 'wutai',
        title: '晨會',
        start_time: '2026-09-18T08:00:00+08:00'
      });
    }
    throw new Error(`Unexpected call: ${url}`);
  };

  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: calendarHandler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await calendarHandler(
    {
      method: 'POST',
      headers: { 'x-line-uid': 'U_ADMIN', 'x-line-id-token': 'test-token' },
      body: {
        calendarType: 'wutai',
        title: '晨會',
        startTime: '2026-09-18T08:00:00+08:00'
      }
    },
    {
      setHeader() {},
      status(c) { statusCode = c; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(body.status, 'success');
  assert.match(body.message, /防止重複建立/);
  assert.equal(body.event.id, 'existing-event-1');
});
