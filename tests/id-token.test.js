import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLineIdToken } from '../api/line_auth.js';

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
