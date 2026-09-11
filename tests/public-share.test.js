import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';

const json = data => new Response(JSON.stringify(data), { 
  headers: { 
    'Content-Type': 'application/json',
    'Content-Range': '0-0/1'
  } 
});

let testModuleId = 0;

test('GET /api/repairs?public_id allows access without LINE UID and strictly desensitizes data', async (t) => {
  const originalFetch = globalThis.fetch;
  const sensitiveRepairRecord = {
    id: 'test-repair-uuid-123',
    type: 'repair',
    target: '三年級教室投影機故障',
    location: '[霧臺校區] 201 教室',
    description: '燈泡不亮，無法開機，需要廠商到校檢修',
    urgency: 'yellow',
    status: 'open',
    media_urls: ['https://example.com/projector.jpg'],
    created_at: '2026-09-11T10:00:00Z',
    // 敏感機密欄位：絕對不能洩漏給第三人/廠商
    reporter_name: '張組長',
    reporter_uid: 'U1234567890abcdef',
    assignee: '陳主任',
    completion_details: { cost: 15000, receipt_no: 'AB123456' },
    progress_logs: [{ timestamp: '2026-09-11T11:00:00Z', note: '內部討論：經費走總務設備維持費' }],
    acceptance_notes: '驗收通過'
  };

  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    assert.equal(address.hostname, 'database.test');
    assert.equal(address.pathname, '/rest/v1/repairs');
    return json(sensitiveRepairRecord);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/repairs.js?test=${++testModuleId}`);

  let status, body;
  const req = {
    method: 'GET',
    headers: {}, // 完全沒有 x-line-uid (第三人/廠商匿名讀取)
    query: { public_id: 'test-repair-uuid-123' }
  };
  const res = {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; }
  };

  await handler(req, res);

  assert.equal(status, 200);
  assert.equal(body.id, 'test-repair-uuid-123');
  assert.equal(body.type, 'repair');
  assert.equal(body.target, '三年級教室投影機故障');
  assert.equal(body.location, '[霧臺校區] 201 教室');
  assert.equal(body.description, '燈泡不亮，無法開機，需要廠商到校檢修');
  assert.equal(body.urgency, 'yellow');
  assert.equal(body.status, 'open');
  assert.deepEqual(body.media_urls, ['https://example.com/projector.jpg']);
  assert.equal(body.created_at, '2026-09-11T10:00:00Z');

  // 嚴格驗證資訊脫敏：不可包含任何個資、金額或內部簽核歷程
  assert.equal(body.reporter_name, undefined, 'reporter_name must be stripped');
  assert.equal(body.reporter_uid, undefined, 'reporter_uid must be stripped');
  assert.equal(body.assignee, undefined, 'assignee must be stripped');
  assert.equal(body.completion_details, undefined, 'completion_details/cost must be stripped');
  assert.equal(body.progress_logs, undefined, 'progress_logs must be stripped');
  assert.equal(body.acceptance_notes, undefined, 'acceptance_notes must be stripped');
});

test('GET /api/repairs?public_id returns 404 if record is not found', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'PGRST116', message: 'Not found' }), {
    status: 406,
    headers: { 'Content-Type': 'application/json' }
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/repairs.js?test=${++testModuleId}`);

  let status, body;
  const req = {
    method: 'GET',
    headers: {},
    query: { public_id: 'non-existent-id' }
  };
  const res = {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; }
  };

  await handler(req, res);
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/announcements?id allows public single announcement access and desensitizes author_uid', async (t) => {
  const originalFetch = globalThis.fetch;
  const announcementRecord = {
    id: 'ann-uuid-456',
    title: '114學年度全校親職教育日公告',
    content: '活動時間為本週六上午九點，敬請各處室做好準備。',
    author_name: '教導處',
    author_uid: 'U_INTERNAL_STAFF_SECRET_UID',
    expire_at: '2026-09-30T00:00:00Z',
    attachments: [{ name: '流程表.pdf', url: 'https://example.com/flow.pdf' }],
    is_archived: false,
    created_at: '2026-09-11T08:00:00Z'
  };

  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    assert.equal(address.hostname, 'database.test');
    assert.equal(address.pathname, '/rest/v1/announcements');
    return json(announcementRecord);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/announcements.js?test=${++testModuleId}`);

  let status, body;
  const req = {
    method: 'GET',
    headers: {}, // 匿名免登入查閱
    query: { id: 'ann-uuid-456' }
  };
  const res = {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; }
  };

  await handler(req, res);

  assert.equal(status, 200);
  assert.equal(body.id, 'ann-uuid-456');
  assert.equal(body.title, '114學年度全校親職教育日公告');
  assert.equal(body.author_name, '教導處');
  assert.equal(body.author_uid, undefined, 'author_uid must be omitted');
});
