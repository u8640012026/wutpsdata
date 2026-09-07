import test from 'node:test';
import assert from 'node:assert/strict';
import { roleTags, isSuperAdmin, isSchoolAdmin, homeroomClass, studentClass, canManageRepairs } from '../src/lib/staffAccess.js';

process.env.VITE_SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
let moduleId = 0;
const students = [{ id: 'a', grade: '三', class_name: '甲', seat_number: 2 }, { id: 'b', grade: '3', class_name: '甲', seat_number: 1 }, { id: 'c', grade: '三', class_name: '乙', seat_number: 1 }];
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

async function invoke(t, file, staff, req, existing = { id: 'r1', reporter_uid: 'teacher', status: 'open' }) {
  const originalFetch = globalThis.fetch;
  const mutations = [];
  globalThis.fetch = async (url, init = {}) => {
    const address = new URL(String(url));
    assert.equal(address.hostname, 'database.test');
    const table = address.pathname.split('/').pop();
    if (table === 'staff') return json(staff);
    if (table === 'students') return json(students);
    if (table === 'repairs' && init.method === 'PATCH') {
      const updates = JSON.parse(init.body);
      mutations.push(updates);
      return json([{ ...existing, ...updates }]);
    }
    if (table === 'repairs') return json(existing);
    if (table === 'announcements' && ['PATCH', 'POST'].includes(init.method)) {
      const updates = JSON.parse(init.body);
      mutations.push(updates);
      return json([{ ...existing, ...(Array.isArray(updates) ? updates[0] : updates) }]);
    }
    if (table === 'announcements') return json(existing);
    if (table === 'audit_logs') return json(null);
    throw new Error(`Unexpected table: ${table}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { default: handler } = await import(`../api/${file}.js?test=${++moduleId}`);
  let status, body;
  await handler({ headers: { 'x-line-uid': 'teacher' }, ...req }, {
    status(code) { status = code; return this; }, json(value) { body = value; return this; }, send(value) { body = value; }
  });
  return { status, body, mutations };
}

test('exact role tokens do not grant role 10, 20 or 40 administrative access', () => {
  for (const role of ['10', '20', '30', '40', '50']) {
    assert.equal(isSchoolAdmin({ role_tags: role }), false);
    assert.equal(isSuperAdmin({ role_tags: role }), false);
  }
  assert.deepEqual(roleTags({ role_tags: '2, 4' }), ['2', '4']);
  for (const role of ['0', '1', '2', '3']) assert.equal(isSchoolAdmin({ role_tags: role }), true);
});

test('homeroom class normalizes current and legacy fields without guessing', () => {
  assert.equal(homeroomClass({ role_tags: '4', class_assigned: '3年甲班' }), '三甲');
  assert.equal(homeroomClass({ role_tags: '4', details: { 任教班級: '三甲' } }), '三甲');
  assert.equal(homeroomClass({ role_tags: '6', class_assigned: '三甲' }), null);
  assert.equal(homeroomClass({ role_tags: '4', class_assigned: '全校' }), null);
  assert.equal(studentClass({ grade: '三年級', class_name: '甲班' }), '三甲');
});

test('teacher receives only own class from student API', async t => {
  const result = await invoke(t, 'students', { role_tags: '4', class_assigned: '三甲' }, { method: 'GET' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.map(s => s.id), ['b', 'a']);
});

test('administrative role 2 receives all students even with an assigned class', async t => {
  const result = await invoke(t, 'students', { role_tags: '2,4', class_assigned: '三甲' }, { method: 'GET' });
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 3);
});

test('non-homeroom role 10 cannot read students', async t => {
  const result = await invoke(t, 'students', { role_tags: '10' }, { method: 'GET' });
  assert.equal(result.status, 403);
});

test('missing homeroom assignment is denied rather than selecting first student class', async t => {
  const result = await invoke(t, 'students', { role_tags: '4' }, { method: 'GET' });
  assert.equal(result.status, 403);
});

test('administrative role routes to admin regardless of job title wording', async t => {
  const result = await invoke(t, 'auth', { role_tags: '2', title: '教務主任' }, { method: 'POST', body: { line_uid: 'teacher' } });
  assert.equal(result.body.role, 'admin');
});

test('ordinary reporter cannot write handling progress', async t => {
  const result = await invoke(t, 'repairs', { role_tags: '4' }, { method: 'PATCH', body: { id: 'r1', updates: { progress_logs: [{ text: '補充狀況' }] } } });
  assert.equal(result.status, 403);
  assert.equal(result.mutations.length, 0);
});

test('reporter cannot close a repair before handler completion', async t => {
  const result = await invoke(t, 'repairs', { role_tags: '4' }, { method: 'PATCH', body: { id: 'r1', updates: { status: 'closed' } } });
  assert.equal(result.status, 409);
  assert.equal(result.mutations.length, 0);
});

test('announcement author may edit own announcement', async t => {
  const result = await invoke(t, 'announcements', { role_tags: '3', name: 'Author' }, { method:'PUT', body:{id:'a1', title:'Updated',content:'Corrected'} }, {id:'a1',author_uid:'teacher'});
  assert.equal(result.status,200);
  assert.equal(result.body.title,'Updated');
});

test('administrator may not edit another announcement author content', async t => {
  const result = await invoke(t, 'announcements', { role_tags: '2' }, {method:'PUT',body:{id:'a1',title:'Wrong'}}, {id:'a1',author_uid:'other'});
  assert.equal(result.status,403);
  assert.equal(result.mutations.length,0);
});

test('ordinary teacher cannot publish announcements', async t => {
  const result = await invoke(t, 'announcements', {role_tags:'4'}, {method:'POST',body:{title:'Test',content:'Test'}});
  assert.equal(result.status,403);
  assert.equal(result.mutations.length,0);
});

test('superadmin may maintain another author announcement', async t => {
  const result = await invoke(t,'announcements',{role_tags:'0'},{method:'PUT',body:{id:'a1',is_archived:true}},{id:'a1',author_uid:'other'});
  assert.equal(result.status,200);
  assert.equal(result.body.is_archived,true);
});

test('reporter cannot modify another person repair', async t => {
  const result = await invoke(t, 'repairs', { role_tags: '4' }, { method: 'PATCH', body: { id: 'r1', updates: { progress_logs: [] } } }, { id: 'r1', reporter_uid: 'other', status: 'open' });
  assert.equal(result.status, 403);
  assert.equal(result.mutations.length, 0);
});

test('general affairs manager marks work completed but cannot close for another reporter', async t => {
  const result = await invoke(t, 'repairs', { role_tags: '3', department: '總務處' }, { method: 'PATCH', body: { id: 'r1', updates: { status: 'closed' } } }, { id:'r1',reporter_uid:'other',status:'completed' });
  assert.equal(result.status, 403);
  assert.equal(result.mutations.length, 0);
});

test('closed repairs reject later updates even for administrators', async t => {
  const result = await invoke(t, 'repairs', { role_tags: '2' }, { method: 'PATCH', body: { id: 'r1', updates: { progress_logs: [] } } }, { id: 'r1', reporter_uid: 'teacher', status: 'closed' });
  assert.equal(result.status, 409);
  assert.equal(result.mutations.length, 0);
});

test('unregistered identity cannot access repairs', async t => {
  const result = await invoke(t, 'repairs', null, { method: 'GET' });
  assert.equal(result.status, 403);
});

test('roles 0, 1, 2, 3, 40 and general affairs staff manage repairs', () => {
  for (const role of ['0','1','2','3','40']) assert.equal(canManageRepairs({role_tags:role}),true);
  assert.equal(canManageRepairs({role_tags:'4',department:'教務處'}),false);
  assert.equal(canManageRepairs({role_tags:'40',department:'總務處'}),true);
});

test('reporter confirms completed repair and moves it to closed status', async t => {
  const result = await invoke(t,'repairs',{role_tags:'4'},{method:'PATCH',body:{id:'r1',updates:{status:'closed'}}},{id:'r1',reporter_uid:'teacher',status:'completed'});
  assert.equal(result.status,200);
  assert.equal(result.body.status,'closed');
  assert.equal(result.body.urgency,'blue');
});

test('general affairs handler can report completion', async t => {
  const result = await invoke(t,'repairs',{role_tags:'3',department:'總務處'},{method:'PATCH',body:{id:'r1',updates:{status:'completed',progress_logs:[{text:'已修復'}]}}});
  assert.equal(result.status,200);
  assert.equal(result.body.status,'completed');
});
