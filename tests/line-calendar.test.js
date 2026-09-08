import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated fake services: no production data, messages, or paid model requests.
process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.CALENDAR_GAS_URL = 'https://calendar.test/exec?existing=1';
process.env.GEMINI_API_KEY = 'test-only';
process.env.GROQ_API_KEY = 'test-only';
let moduleId = 0;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const event = { id: 'meeting', title: '測試晨會', start: '2026-09-07T23:50:00Z', end: '2026-09-08T01:20:00Z', location: '測試教室' };

async function fixture(t, options = {}) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    requests.push({ address, body: init.body ? JSON.parse(init.body) : null });
    if (address.hostname === 'database.test') return json(options.brainDocs ?? []);
    if (address.hostname === 'calendar.test') {
      assert.equal(address.searchParams.get('existing'), '1');
      const type = address.searchParams.get('type');
      if (options.fail?.includes(type)) throw new Error('offline');
      if (options.malformed?.includes(type)) return json({ status: 'error', data: [] });
      return json({ status: 'success', data: options.events?.[type] ?? (type === 'all' ? [event] : []) });
    }
    if (address.hostname === 'generativelanguage.googleapis.com') {
      if (options.geminiFails) return json({ error: 'unavailable' }, 503);
      return json({ candidates: [{ content: { parts: [{ text: '測試回答' }] } }] });
    }
    if (address.hostname === 'api.groq.com') return json({ choices: [{ message: { content: '測試備援回答' } }] });
    throw new Error(`Unexpected network request: ${address.hostname}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { default: handler } = await import(`../api/line_webhook.js?test=${++moduleId}`);
  async function ask(engine) {
    let result;
    await handler({ method: 'GET', query: { q: '9月8日有什麼活動？', engine } }, {
      status(code) { assert.equal(code, 200); return this; },
      json(data) { result = data; }
    });
    return result;
  }
  const geminiPrompt = () => requests.find(r => r.address.hostname === 'generativelanguage.googleapis.com')?.body.contents[0].parts[0].text;
  const groqPrompt = () => requests.find(r => r.address.hostname === 'api.groq.com')?.body.messages[0].content;
  return { ask, requests, geminiPrompt, groqPrompt };
}

test('Gemini receives real calendar context with Taipei start/end and campus', async t => {
  const f = await fixture(t);
  const result = await f.ask();
  assert.match(result.provider, /Gemini/);
  const prompt = f.geminiPrompt();
  assert.match(prompt, /全校近期官方行事曆排程/);
  assert.match(prompt, /2026\/09\/08.*07:50.*09:20.*全校共通.*測試晨會/);
  assert.match(prompt, /目前臺灣時間/);
  assert.equal(f.requests.filter(r => r.address.hostname === 'calendar.test').length, 3);
});

test('automatic Groq fallback receives the identical calendar context', async t => {
  const f = await fixture(t, { geminiFails: true });
  const result = await f.ask();
  assert.match(result.provider, /自動備援/);
  assert.ok(f.geminiPrompt().includes(f.groqPrompt()));
  assert.match(f.groqPrompt(), /測試晨會/);
});

test('explicit Groq also receives calendar context', async t => {
  const f = await fixture(t);
  await f.ask('groq');
  assert.match(f.groqPrompt(), /測試晨會/);
  assert.equal(f.geminiPrompt(), undefined);
});

test('partial failures retain valid campus data, label missing campus, and retry', async t => {
  const f = await fixture(t, { fail: ['ligu'], events: { wutai: [{ ...event, id: 'campus', title: '本校活動' }] } });
  await f.ask();
  assert.match(f.geminiPrompt(), /勵古百合分校讀取失敗/);
  assert.match(f.geminiPrompt(), /霧臺校區.*本校活動/);
  await f.ask();
  assert.equal(f.requests.filter(r => r.address.hostname === 'calendar.test').length, 6);
});

test('total failure is not described as an empty calendar', async t => {
  const f = await fixture(t, { fail: ['all', 'wutai', 'ligu'] });
  await f.ask();
  assert.match(f.geminiPrompt(), /行事曆暫時無法取得/);
  assert.doesNotMatch(f.geminiPrompt(), /目前日曆中尚無已排定/);
});

test('malformed upstream payload is a failure rather than empty success', async t => {
  const f = await fixture(t, { malformed: ['all'] });
  await f.ask();
  assert.match(f.geminiPrompt(), /全校共通讀取失敗/);
});

test('successful empty responses are distinguished from unavailable sources', async t => {
  const f = await fixture(t, { events: { all: [], wutai: [], ligu: [] } });
  await f.ask();
  assert.match(f.geminiPrompt(), /成功讀取的來源沒有回傳可用活動/);
  assert.doesNotMatch(f.geminiPrompt(), /【行事曆暫時無法取得】/);
});

test('successful context is cached then refreshed after five minutes', async t => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  t.after(() => { Date.now = originalNow; });
  const f = await fixture(t);
  await f.ask();
  await f.ask();
  assert.equal(f.requests.filter(r => r.address.hostname === 'calendar.test').length, 3);
  now += 5 * 60 * 1000 + 1;
  await f.ask();
  assert.equal(f.requests.filter(r => r.address.hostname === 'calendar.test').length, 6);
});

test('all-day exclusive end, timezone-less dates and invalid dates are handled', async t => {
  const f = await fixture(t, { events: { all: [
    { id: 'all-day', title: '兩日活動', start: '2026-09-08', end: '2026-09-10', isAllDay: true },
    { id: 'local', title: '臺灣時間活動', start: '2026-09-08T07:50:00' },
    { id: 'bad', title: '壞日期', start: 'not-a-date' }
  ] } });
  await f.ask();
  assert.match(f.geminiPrompt(), /2026\/09\/08.*至 2026\/09\/09.*全天.*兩日活動/);
  assert.match(f.geminiPrompt(), /07:50.*臺灣時間活動/);
  assert.match(f.geminiPrompt(), /1 筆日期無法辨識/);
});

test('events after first 30 and repeated event IDs on other dates are retained', async t => {
  const events = Array.from({ length: 35 }, (_, i) => ({ id: 'recurring', title: `活動${i}`, start: new Date(Date.UTC(2026, 8, 1 + i)).toISOString() }));
  const f = await fixture(t, { events: { all: [...events, events[0]] } });
  await f.ask();
  assert.match(f.geminiPrompt(), /35 筆/);
  assert.match(f.geminiPrompt(), /活動34/);
});

test('Gemini and Groq inject full extracted text from brain_documents instead of truncated summary', async t => {
  const f = await fixture(t, {
    brainDocs: [
      {
        title: '游泳課規範.pdf',
        extracted_text: '【第 1 頁】\n游泳課第一條：請攜帶泳帽泳鏡。\n\n【第 5 頁】\n游泳課第五條：水深達 120 公分，須有合格教練隨行。',
        summary: '游泳課第一條：請攜帶泳帽...'
      }
    ]
  });
  await f.ask();
  const prompt = f.geminiPrompt();
  assert.match(prompt, /官方校務上傳文件：游泳課規範\.pdf/);
  assert.match(prompt, /水深達 120 公分，須有合格教練隨行/);
});
