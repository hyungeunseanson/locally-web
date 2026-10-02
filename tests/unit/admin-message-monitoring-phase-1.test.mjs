import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { sourceLoader, queryBuilder, clientFixture, inquiry, message, response, deferred } from './helpers/chatRuntime.mjs';

const time = sourceLoader()('app/utils/adminChatTime.ts');
test('KST times and calendar boundaries are independent of the browser timezone; missing times stay unknown', () => {
  const now = Date.parse('2026-10-01T15:05:00Z'); // Oct 2, 00:05 KST
  assert.equal(time.formatAdminMessageTime('2026-10-02T06:42:00Z'), '오후 3:42');
  assert.equal(time.formatAdminMessageDay('2026-10-01T15:00:00Z', now), '오늘');
  assert.equal(time.formatAdminMessageDay('2026-10-01T14:59:59Z', now), '어제');
  assert.equal(time.formatAdminMessageDay('2026-09-30T14:59:59Z', now), '2026년 9월 30일');
  assert.equal(time.formatAdminMessageDay('2026-10-02T06:42:00Z', Date.parse('2026-10-05T00:00Z')), '2026년 10월 2일');
  assert.equal(time.formatAdminMessageDay('2025-12-31T15:00Z', Date.parse('2026-01-01T15:00Z')), '어제');
  assert.equal(time.formatAdminMessageTime(null), '시간 정보 없음');
  assert.equal(time.formatAdminMessageDay('bad', now), '날짜 정보 없음');
  assert.equal(time.formatReplyWait('2026-10-01T13:35Z', now), '1시간 30분 대기');
  assert.equal(time.formatReplyWait(null, now), '대기 시간 정보 없음');
});

function serverFixture(actor = { id: 'admin', email: 'admin@example.invalid' }, type = 'admin_support') {
  const queries = [], rpcs = [], background = [];
  const row = inquiry(1, type);
  const client = {
    from: table => queryBuilder(table, state => {
      queries.push(state);
      if (table === 'inquiries') return { data: row };
      if (table === 'inquiry_messages') return { data: state.operation === 'update' ? [{ id: 10 }] : [{ ...message(10, 1, 'guest'), created_at: null }] };
      if (table === 'users') return { data: { role: actor?.id === 'admin' ? 'admin' : actor?.id === 'host' ? 'host' : 'guest' } };
      if (table === 'admin_whitelist') return { data: null };
      if (['profiles', 'host_applications'].includes(table)) return { data: [] };
      throw new Error(`Unmocked table ${table}`);
    }),
    rpc: async (name, args) => {
      rpcs.push({ name, args });
      return { data: name === 'get_admin_inquiry_activity' ? [{ inquiry_id: 1, last_sender_role: 'customer', last_message_at: null, needs_reply: true, admin_unread_count: 1 }] : 1 };
    },
  };
  const stubs = {
    'server-only': {},
    'next/server': { NextResponse: { json: (body, init) => response(body, init?.status || 200) }, after: fn => background.push(fn) },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: actor } }) } }) },
    '@/app/utils/supabase/admin': { createAdminClient: () => client, recordAuditLog: async () => {} },
    '@/app/utils/adminSupportUnreadAlerts': { clearAdminSupportUnreadBatch: async () => {}, startOrAdvanceAdminSupportUnreadBatch: async () => {} },
    '@/app/utils/adminAlertCenter': { insertAdminAlerts: async () => {}, sendAdminAlertEmails: async () => {} },
    '@/app/emails/delivery/sendTemplatedEmail': { sendTemplatedEmail: async () => ({ sent: true }) },
  };
  return { load: sourceLoader(stubs), queries, rpcs, background, row };
}

test('admin detail GET performs no writes, keeps missing DB timestamps null, and does not fake customer read', async () => {
  const f = serverFixture();
  const result = await f.load('app/api/admin/inquiries/[id]/messages/route.ts').GET({}, { params: Promise.resolve({ id: '1' }) });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.data[0].created_at, null);
  assert.equal(body.data[0].is_read, false); assert.equal(body.data[0].read_at, null);
  assert.ok(f.queries.every(q => q.operation === 'select'));
  assert.deepEqual(f.rpcs.map(r => r.name), ['get_admin_inquiry_activity']);
});

for (const actor of [null, { id: 'guest' }, { id: 'host' }, { id: 'outsider', user_metadata: { role: 'admin' } }]) {
  test(`${actor?.id || 'anonymous'} cannot use admin GET or acknowledgement API`, async () => {
    const f = serverFixture(actor);
    for (const [path, method] of [['messages', 'GET'], ['ack', 'POST']]) {
      const result = await f.load(`app/api/admin/inquiries/[id]/${path}/route.ts`)[method]({ json: async () => ({ throughMessageId: 10 }) }, { params: Promise.resolve({ id: '1' }) });
      assert.equal(result.status, actor ? 403 : 401);
    }
    const list = await f.load('app/api/admin/inquiries/route.ts').GET(new Request('http://localhost/api/admin/inquiries'));
    assert.equal(list.status, actor ? 403 : 401);
    assert.ok(f.queries.every(q => q.operation === 'select')); assert.equal(f.rpcs.length, 0);
  });
}

test('an administrator who is also a thread participant cannot write customer read receipts', async () => {
  const f = serverFixture({ id: 'admin' }, 'general'); f.row.host_id = 'admin';
  const result = await f.load('app/api/inquiries/read/route.ts').POST({ json: async () => ({ inquiryId: 1 }) });
  assert.equal(result.status, 403); assert.ok(f.queries.every(q => q.operation === 'select'));
});

test('explicit admin acknowledgement uses its own bounded RPC and validates IDs', async () => {
  const f = serverFixture(); const api = f.load('app/api/admin/inquiries/[id]/ack/route.ts');
  assert.equal((await api.POST({ json: async () => ({ throughMessageId: '10' }) }, { params: Promise.resolve({ id: '1' }) })).status, 200);
  assert.deepEqual(f.rpcs, [{ name: 'ack_admin_inquiry_messages', args: { p_inquiry_id: '1', p_through_message_id: '10' } }]);
  assert.equal((await api.POST({ json: async () => ({ throughMessageId: '-1' }) }, { params: Promise.resolve({ id: '1' }) })).status, 400);
  assert.ok(f.queries.every(q => q.operation === 'select'));
});

for (const [id, type, expected] of [['guest', 'general', 200], ['host', 'general', 200], ['guest', 'admin_support', 200], ['admin', 'admin_support', 403], ['admin', 'general', 403], ['outsider', 'general', 403], ['outsider', 'admin_support', 403]]) {
  test(`${id} ${type}: server read permissions remain participant-only`, async () => {
    const f = serverFixture({ id }, type);
    const result = await f.load('app/api/inquiries/read/route.ts').POST({ json: async () => ({ inquiryId: 1 }) });
    assert.equal(result.status, expected);
    const writes = f.queries.filter(q => q.operation === 'update');
    assert.equal(writes.length, expected === 200 ? 1 : 0);
    if (writes.length) {
      assert.equal(writes[0].table, 'inquiry_messages'); assert.equal(writes[0].body.is_read, true);
      assert.ok(writes[0].filters.some(([method, col, value]) => method === 'neq' && col === 'sender_id' && value === id));
    }
  });
}

async function adminFixture(t, options = {}) {
  const f = clientFixture(options); t.after(() => f.dispose());
  f.auth = async () => ({ data: { user: { id: 'admin' } } });
  const useAdmin = f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  let state;
  function Probe() {
    const chat = useAdmin();
    React.useEffect(() => { state = chat; });
    return null;
  }
  await f.mount(Probe); f.admin = () => state;
  return f;
}
const lists = f => f.calls.requests.filter(r => r.url.startsWith('/api/admin/inquiries?')).length;
const details = f => f.calls.requests.filter(r => /\/messages$/.test(r.url)).length;

test('admin acknowledgement clears only its captured alert wave; a concurrent arrival is preserved', async () => {
  for (const newArrival of [false, true]) {
    const queries = [];
    const batch = { inquiry_id: 1, first_unread_message_id: 70, first_unread_message_at: '2026-10-01T05:00:00.000Z', last_unread_message_id: 71 };
    const client = { from: table => queryBuilder(table, state => {
      queries.push(state);
      if (table === 'inquiries') return { data: { id: 1, user_id: 'guest', type: 'admin_support' } };
      if (table === 'inquiry_messages') {
        if (newArrival) batch.last_unread_message_id = 72;
        return { count: 0 };
      }
      if (state.operation === 'select') return { data: { ...batch } };
      const matches = state.filters.every(([method, key, value]) => method !== 'eq' || String(batch[key]) === String(value));
      return { data: matches ? [{ inquiry_id: 1 }] : [] };
    }) };
    const alerts = sourceLoader({ '@/app/utils/adminAlertCenter': { insertAdminAlerts: async () => {}, sendAdminAlertEmails: async () => {} } })('app/utils/adminSupportUnreadAlerts.ts');
    const result = await alerts.clearAdminSupportUnreadBatch({ supabaseAdmin: client, inquiryId: 1 });
    assert.equal(result.cleared, !newArrival);
    const readQuery = queries.find(q => q.table === 'inquiry_messages');
    assert.ok(readQuery.filters.some(([method, key]) => method === 'is' && key === 'admin_read_at'));
    assert.ok(queries.filter(q => q.operation === 'update').every(q => q.table === 'admin_support_unread_alert_batches'));
  }
});

test('admin reconnect, visibility, online and slow healthy / disconnected fallback recover missing publication/events; bursts are serialized', async t => {
  const f = await adminFixture(t);
  await f.flush(() => f.admin().selectInquiry(1));
  let version = 10;
  const original = f.request;
  f.request = (url, opts) => /\/messages$/.test(url) ? response({ success: true, data: [message(version, 1, 'guest')], inquiry: f.rows[0] }) : original(url, opts);
  const before = details(f);
  await f.flush(() => f.calls.channels[0].status('SUBSCRIBED'));
  assert.equal(details(f), before + 1); assert.equal(f.admin().messages[0].id, 10);
  version = 11;
  await f.flush(() => f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')));
  assert.equal(f.admin().messages[0].id, 11);
  version = 12;
  await f.flush(() => f.dom.window.dispatchEvent(new f.dom.window.Event('online')));
  assert.equal(f.admin().messages[0].id, 12);
  version = 13;
  await f.timers(30_000); assert.equal(f.admin().messages[0].id, 12);
  await f.timers(300_000); assert.equal(f.admin().messages[0].id, 13);
  version = 15;
  await f.flush(() => f.calls.channels[0].status('TIMED_OUT'));
  await f.timers(30_000); assert.equal(f.admin().messages[0].id, 13);
  await f.timers(60_000); assert.equal(f.admin().messages[0].id, 15);
  const blocked = deferred(); let active = 0, maxActive = 0;
  f.request = async (url, opts) => {
    if (/\/messages$/.test(url)) { maxActive = Math.max(maxActive, ++active); await blocked.promise; active--; return response({ success: true, data: [message(14, 1)], inquiry: f.rows[0] }); }
    return original(url, opts);
  };
  const n = details(f);
  await f.flush(() => { for (let i = 0; i < 5; i++) f.calls.channels[0].status('SUBSCRIBED'); });
  assert.equal(details(f), n + 1);
  await f.flush(() => blocked.resolve());
  assert.equal(details(f), n + 2); assert.equal(maxActive, 1);
  assert.ok(lists(f) > 1);
});

test('hidden admin fallback does no work; stale list cannot revert a newer status/needs_reply snapshot', async t => {
  const f = await adminFixture(t);
  await f.flush(() => f.admin().selectInquiry(1));
  Object.defineProperty(f.dom.window.document, 'visibilityState', { configurable: true, value: 'hidden' });
  const n = lists(f); await f.timers(300_000); assert.equal(lists(f), n);
  Object.defineProperty(f.dom.window.document, 'visibilityState', { configurable: true, value: 'visible' });
  const original = f.request;
  const slow = deferred();
  f.request = url => url.startsWith('/api/admin/inquiries?') ? slow.promise : response({ success: true, inquiry: { ...f.rows[0], updated_at: '2026-10-02T01:00Z', status: 'open', needs_reply: true }, data: [message(22, 1)] });
  let old;
  await f.flush(() => { old = f.admin().refresh(false); });
  await f.flush(() => f.admin().loadMessages(1));
  await f.flush(async () => { slow.resolve(response({ success: true, data: [{ ...f.rows[0], status: 'resolved', needs_reply: false }] })); await old; });
  assert.equal(f.admin().selectedInquiry.status, 'open'); assert.equal(f.admin().selectedInquiry.needs_reply, true);
  assert.equal(f.admin().inquiries.find(row => row.id === 1).status, 'open');
  assert.equal(f.admin().inquiries.find(row => row.id === 1).needs_reply, true);
  f.request = original;
});

test('customer INSERT alone refreshes reopened status and moves a completed inquiry to the reply queue without inquiries publication', async t => {
  const f = await adminFixture(t, { rows: [
    { ...inquiry(1, 'admin_support'), status: 'resolved', needs_reply: false, last_message_at: '2026-10-01T00:00Z' },
    { ...inquiry(2, 'admin_support'), needs_reply: false, last_message_at: '2026-10-02T01:00Z' },
  ] });
  assert.deepEqual(f.admin().inquiries.map(row => row.id), [2, 1]);
  await f.flush(() => f.admin().selectInquiry(1));
  f.rows[0] = { ...f.rows[0], status: 'open', needs_reply: true, updated_at: '2026-10-02T02:00Z', last_sender_role: 'customer', last_message_at: '2026-10-02T02:00Z', support_reopened_at: '2026-10-02T02:00Z' };
  const insert = f.calls.channels[0].handlers.find(([, filter]) => filter.event === 'INSERT' && filter.table === 'inquiry_messages')[2];
  await f.flush(() => insert({ eventType: 'INSERT', new: { id: 99, inquiry_id: 1, sender_id: 'guest' } }));
  await f.timers(300);
  assert.deepEqual(f.admin().inquiries.map(row => row.id), [1, 2]);
  assert.equal(f.admin().selectedInquiry.status, 'open');
  assert.equal(f.admin().selectedInquiry.needs_reply, true);
  assert.ok(f.admin().inquiries[0].support_reopened_at);
});

test('admin UI displays latest sender/time/wait/reinquiry and KST separators and message times', async t => {
  const f = clientFixture({ additionalStubs: {
    '@/app/hooks/useConfirmDialog': { useConfirmDialog: () => ({ requestConfirm: async () => false, ConfirmDialogElement: null }) },
    '@/app/admin/dashboard/components/ChatParticipantProfileModal': { default: () => null },
  }, rows: [{ ...inquiry(1, 'admin_support'), needs_reply: true, last_sender_role: 'customer', last_message_at: '2026-10-02T06:42Z', reply_waiting_since: '2026-10-02T06:00Z', support_reopened_at: '2026-10-02T06:42Z' }] });
  t.after(() => f.dispose());
  const original = f.request;
  f.request = async (url, opts) => /\/messages$/.test(url) ? response({ success: true, inquiry: f.rows[0], data: [
    { ...message(10, 1, 'guest'), created_at: '2026-10-01T14:59Z' },
    { ...message(11, 1, 'guest'), created_at: '2026-10-01T15:00Z' },
    { ...message(12, 1, 'admin'), created_at: '2026-10-02T06:42Z' },
    { ...message(13, 1, 'guest'), created_at: null },
  ] }) : /\/ack$/.test(url) ? response({ success: true }) : original(url, opts);
  const Component = f.load('app/admin/dashboard/components/ChatMonitor.tsx').default;
  await f.mount(Component);
  const doc = f.dom.window.document;
  assert.match(doc.body.textContent, /마지막 발신: 고객/); assert.match(doc.body.textContent, /답변 필요/); assert.match(doc.body.textContent, /완료 후 재문의/);
  await f.flush(() => doc.querySelector('[data-testid="admin-chat-inquiry-row-1"]').dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true })));
  const labels = [...doc.querySelectorAll('[data-testid="admin-chat-date-separator"]')].map(el => el.textContent);
  assert.equal(labels.length, 3); // null date, previous KST day, same-day messages
  assert.ok([...doc.querySelectorAll('time')].some(el => el.textContent === '오후 3:42'));
  assert.match(doc.body.textContent, /시간 정보 없음/);
  assert.equal(f.calls.requests.filter(r => /\/api\/inquiries\/read$/.test(r.url)).length, 0);
});
