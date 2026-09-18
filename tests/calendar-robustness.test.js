import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
let moduleId = 0;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('api/calendar returns 500 on database insert failure instead of fake success', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      // Simulate Supabase insert error
      return json({ message: 'database write rejected' }, 400);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: {
        title: '晨會',
        startTime: '2026-09-18T09:00:00+08:00'
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
  assert.equal(body.status, 'error');
  assert.match(body.message, /資料庫寫入活動失敗/);
});

test('api/calendar returns 404 when updating a non-existent event', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      return json(null); // Not found
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'PUT',
      body: {
        eventId: 'non_existent_123',
        title: '更新活動',
        startTime: '2026-09-18T09:00:00+08:00'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 404);
  assert.equal(body.status, 'error');
  assert.match(body.message, /查無此活動記錄/);
});

test('api/calendar returns 404 when deleting a non-existent event', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    if (address.hostname === 'database.test') {
      return json(null); // Not found
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'DELETE',
      body: {
        eventId: 'non_existent_del_123'
      }
    },
    {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(v) { body = v; return this; },
      end() {}
    }
  );

  assert.equal(statusCode, 404);
  assert.equal(body.status, 'error');
  assert.match(body.message, /查無此活動記錄/);
});

test('api/calendar sync_from_gas separates events with same title and time across different campuses', async t => {
  const originalFetch = globalThis.fetch;
  const queriedFilters = [];

  globalThis.fetch = async (url) => {
    const address = new URL(String(url));
    if (address.hostname.includes('script.google.com')) {
      const type = address.searchParams.get('type');
      if (type === 'wutai') {
        return json({
          status: 'success',
          data: [{ id: 'w1', title: '全校晨會', start: '2026-09-22T08:00:00+08:00', calendarType: 'wutai' }]
        });
      }
      if (type === 'ligu') {
        return json({
          status: 'success',
          data: [{ id: 'l1', title: '全校晨會', start: '2026-09-22T08:00:00+08:00', calendarType: 'ligu' }]
        });
      }
      return json({ status: 'success', data: [] });
    }

    if (address.hostname === 'database.test') {
      const search = address.searchParams.toString();
      queriedFilters.push(search);
      // Not found by ID or time+calendar_type, so insert new
      return json(null);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { default: handler } = await import(`../api/calendar.js?test=${++moduleId}`);
  let statusCode, body;
  await handler(
    {
      method: 'POST',
      body: { action: 'sync_from_gas' }
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
  // Check that calendar_type was included in Supabase queries
  const hasCampusFilter = queriedFilters.some(q => q.includes('calendar_type=eq.wutai') || q.includes('calendar_type=eq.ligu'));
  assert.equal(hasCampusFilter, true);
});

test('Taipei timezone conversion converts UTC 01:00Z to Taipei 09:00 without 8-hour shift', () => {
  const utcString = '2026-09-18T01:00:00.000Z';
  const d = new Date(utcString);
  const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  assert.equal(dateStr, '2026-09-18');
  assert.equal(timeStr, '09:00');
});

test('Taipei timezone conversion handles midnight rollover across date boundary', () => {
  const utcString = '2026-09-18T16:30:00.000Z'; // 16:30 UTC = 00:30 next day in UTC+8
  const d = new Date(utcString);
  const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  assert.equal(dateStr, '2026-09-19');
  assert.equal(timeStr, '00:30');
});

test('calendarUtils parseToTaipeiParts correctly splits UTC ISO string', async () => {
  const { parseToTaipeiParts } = await import('../src/components/calendar/calendarUtils.js');
  const res1 = parseToTaipeiParts('2026-09-18T01:00:00.000Z');
  assert.equal(res1.date, '2026-09-18');
  assert.equal(res1.time, '09:00');

  const res2 = parseToTaipeiParts('2026-09-18T16:30:00.000Z');
  assert.equal(res2.date, '2026-09-19');
  assert.equal(res2.time, '00:30');

  const res3 = parseToTaipeiParts('2026-10-05', '08:30');
  assert.equal(res3.date, '2026-10-05');
  assert.equal(res3.time, '08:30');
});
