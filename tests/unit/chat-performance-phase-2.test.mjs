import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import React from 'react';
import { clientFixture, sourceLoader, queryBuilder, deferred, response, inquiry, message, timestamp } from './helpers/chatRuntime.mjs';

const baselineSha = 'b9e9fb9db2d91653038ebec4513a635a8a744754';
const baselineSources = Object.fromEntries(['app/hooks/useChat.ts', 'app/api/inquiries/thread/shared.ts', 'app/admin/dashboard/hooks/useAdminChatQuery.ts'].map((path) => [resolve(path), execFileSync('git', ['show', `${baselineSha}:${path}`], { encoding: 'utf8' })]));
const fullInbox = (f) => f.calls.queries.filter((q) => q.table === 'inquiries').length;
const fullThread = (f) => f.calls.queries.filter((q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' && !q.filters.some(([, key]) => key === 'id')).length;
const queryCount = (f) => f.calls.queries.length;
const emit = (f, event, table, row, old = {}) => f.flush(() => {
  const channel = f.calls.channels.at(-1);
  const handler = channel.handlers.find(([, config]) => config.table === table && config.event === event);
  assert.ok(handler, `${table}:${event} subscribed`);
  handler[2]({ new: row, old, eventType: event });
});
async function mount(t, options) { const f = clientFixture(options); t.after(() => f.dispose()); await f.mount(); return f; }
async function notify(f, id, messageId, inquiryId = 1) {
  f.notifications = [{ id, type: 'new_message', link: `/guest/inbox?inquiryId=${inquiryId}${messageId ? `&messageId=${messageId}` : ''}` }, ...f.notifications];
  await f.mount();
}

for (const role of ['guest', 'host']) {
  test(`${role}: one incoming message with inquiry/read/notification events, full queries before -> after`, async () => {
    const totals = [];
    for (const sources of [baselineSources, {}]) {
      const f = clientFixture({ role, sources });
      try {
        await f.mount(); await f.flush(() => f.get().loadMessages(1));
        const incoming = message(21, 1, role === 'guest' ? 'host' : 'guest', 'new body');
        const original = f.query;
        f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? { data: [message(10, 1), incoming] } : original(q);
        const before = [fullInbox(f), fullThread(f), queryCount(f)];
        await emit(f, 'INSERT', 'inquiry_messages', incoming); await f.timers(0);
        await emit(f, 'UPDATE', 'inquiries', { id: 1, content: incoming.content, updated_at: timestamp }); await f.timers(300);
        await emit(f, 'UPDATE', 'inquiry_messages', { ...incoming, is_read: true, read_at: timestamp }); await f.timers(300);
        await notify(f, 101, 21); await f.timers(1000);
        totals.push([fullInbox(f) - before[0], fullThread(f) - before[1], queryCount(f) - before[2]]);
        assert.equal(f.get().messages.filter((m) => String(m.id) === '21').length, 1);
      } finally { await f.dispose(); }
    }
    assert.deepEqual(totals, [[2, 3, 19], [0, 0, 0]]);
    console.log(`${role} incoming full inbox/thread/DB reads: ${JSON.stringify(totals)}`);
  });

  for (const order of ['realtime-first', 'notification-first', 'notification-in-flight']) {
    test(`${role}: ${order} keeps one canonical bubble and newest read/deleted state`, async (t) => {
      const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
      const sender = role === 'guest' ? 'host' : 'guest';
      const canonical = message(21, 1, sender, 'private body');
      const deleted = { ...canonical, is_read: true, read_at: timestamp, type: 'deleted' };
      const original = f.query, slow = deferred();
      f.query = (q) => q.table === 'inquiry_messages' && q.filters.some(([, key]) => key === 'id')
        ? order === 'notification-in-flight' ? slow.promise : { data: deleted } : original(q);
      if (order === 'realtime-first') {
        await emit(f, 'INSERT', 'inquiry_messages', canonical);
        await emit(f, 'UPDATE', 'inquiry_messages', deleted);
        await notify(f, 101, 21);
      } else {
        await notify(f, 101, 21);
        await emit(f, 'INSERT', 'inquiry_messages', canonical);
        await emit(f, 'UPDATE', 'inquiry_messages', deleted);
        if (order === 'notification-in-flight') await f.flush(() => slow.resolve({ data: canonical }));
      }
      const row = f.get().messages.find((m) => String(m.id) === '21');
      assert.equal(f.get().messages.filter((m) => String(m.id) === '21').length, 1);
      assert.equal(row.type, 'deleted'); assert.equal(row.is_read, true); assert.equal(row.read_at, timestamp);
      assert.doesNotMatch(row.content, /private body/);
      assert.equal(fullThread(f), 1, 'no notification or realtime full thread reload');
      const before = queryCount(f);
      await notify(f, 102, 21); await f.timers(1000);
      assert.equal(queryCount(f), before, 'late duplicate notification is free');
    });
  }

  test(`${role}: Realtime own INSERT before ACK retains temp once; deleted/read survives ACK and stale GET`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    const actor = role === 'guest' ? 'guest' : 'host', ack = deferred(), request = f.request;
    f.request = (url, opts) => url === '/api/inquiries/message' ? ack.promise : request(url, opts);
    let send; await f.flush(() => { send = f.get().sendMessage(1, 'draft'); });
    const canonical = { ...message(99, 1, actor, 'draft'), is_read: true, read_at: timestamp, type: 'deleted' };
    await emit(f, 'INSERT', 'inquiry_messages', canonical);
    assert.equal(f.get().messages.length, 2); assert.match(String(f.get().messages.at(-1).id), /^temp-/);
    assert.ok(!f.get().messages.some((m) => m.id === 99));
    const slow = deferred(), original = f.query;
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? slow.promise : original(q);
    let stale; await f.flush(() => { stale = f.get().loadMessages(1); });
    await f.flush(async () => { ack.resolve(response({ success: true, messageId: 99, displayContent: 'draft', updatedAt: timestamp, message: message(99, 1, actor, 'draft') })); await send; });
    await f.flush(async () => { slow.resolve({ data: [message(10, 1), message(99, 1, actor, 'draft')] }); await stale; });
    const row = f.get().messages.find((m) => m.id === 99);
    assert.equal(f.get().messages.filter((m) => m.id === 99).length, 1);
    assert.equal(row.type, 'deleted'); assert.equal(row.is_read, true); assert.equal(row.read_at, timestamp);
    assert.ok(!f.get().messages.some((m) => String(m.id).startsWith('temp-')));
  });

  test(`${role}: distinct same-content messages and multiple read UPDATEs are preserved`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    const sender = role === 'guest' ? 'host' : 'guest';
    for (const id of [21, 22]) await emit(f, 'INSERT', 'inquiry_messages', message(id, 1, sender, 'same content'));
    await emit(f, 'UPDATE', 'inquiry_messages', { ...message(21, 1, sender, 'same content'), is_read: true });
    await emit(f, 'UPDATE', 'inquiry_messages', { ...message(21, 1, sender, 'same content'), is_read: true, read_at: timestamp });
    assert.deepEqual(f.get().messages.filter((m) => m.content === 'same content').map((m) => m.id), [21, 22]);
    assert.equal(f.get().messages.find((m) => m.id === 21).read_at, timestamp);
    assert.equal(fullInbox(f), 1); assert.equal(fullThread(f), 1);
  });

  test(`${role}: non-selected room unread refresh is scoped and stale unread response cannot undo read`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    const slow = deferred(), original = f.query;
    f.query = (q) => q.table === 'inquiry_messages' && q.columns === 'inquiry_id' && q.filters.some(([, key, val]) => key === 'inquiry_id' && val === 2)
      ? slow.promise : original(q);
    await emit(f, 'INSERT', 'inquiry_messages', message(25, 2, role === 'guest' ? 'host' : 'guest'));
    await f.timers(300);
    const reads = f.calls.queries.filter((q) => q.table === 'inquiry_messages' && q.columns === 'inquiry_id').at(-1);
    assert.ok(reads.filters.some(([, key, val]) => key === 'inquiry_id' && val === 2));
    await f.flush(() => f.get().loadMessages(2));
    await f.flush(() => slow.resolve({ data: [{ inquiry_id: 2 }] }));
    assert.equal(f.get().selectedInquiry.unread_count, 0);
    assert.equal(fullInbox(f), 1);
  });

  test(`${role}: reconnect and visibility each perform one catch-up and recover missed rows`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    const original = f.query;
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? { data: [message(10, 1), message(30, 1)] } : original(q);
    await f.flush(() => f.calls.channels.at(-1).status('SUBSCRIBED')); await f.timers(1000);
    assert.equal(fullInbox(f), 2); assert.equal(fullThread(f), 2); assert.ok(f.get().messages.some((m) => m.id === 30));
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? { data: [message(10, 1), message(30, 1), message(31, 1)] } : original(q);
    Object.defineProperty(f.dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
    await f.flush(() => f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange'))); await f.timers(1000);
    assert.equal(fullInbox(f), 3); assert.equal(fullThread(f), 3); assert.ok(f.get().messages.some((m) => m.id === 31));
  });

  test(`${role}: missing row metadata and legacy notification recover with one reload, no 700ms repeat`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    await emit(f, 'INSERT', 'inquiry_messages', { id: 21, inquiry_id: 1 });
    await notify(f, 101, null); await f.timers(1000); await f.timers(1000);
    assert.equal(fullInbox(f), 2); assert.equal(fullThread(f), 2);
  });
}

function serverFixture({ type = 'general', sources = {} } = {}) {
  const queries = [], notifications = [], emails = [], background = [], audits = [], alerts = [];
  const f = { queries, notifications, emails, background, audits, alerts, localeCount: 0, authActor: null, failures: new Set(), unreadCount: 0 };
  const client = {
    auth: { admin: { getUserById: async () => { f.localeCount++; if (f.failures.has('locale')) throw new Error('locale failure'); return { data: { user: { user_metadata: { preferred_locale: 'ja' } } } }; } } },
    from: (table) => queryBuilder(table, (q) => {
      queries.push(q);
      if (f.failures.has(`${table}:${q.operation}`)) return { data: null, error: { message: `${table} failure` } };
      if (table === 'inquiries') return { data: q.operation === 'update' ? { updated_at: timestamp } : inquiry(1, type) };
      if (table === 'inquiry_messages') return { data: q.operation === 'insert' ? { id: 99, created_at: timestamp } : null };
      if (table === 'profiles') return { data: { full_name: 'Guest', email: 'guest@example.invalid' } };
      if (table === 'host_applications') return { data: { name: 'Host' } };
      if (table === 'public_host_applications') return { data: { status: 'approved' } };
      if (table === 'notifications') { notifications.push(q.body); return { error: null }; }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  const stubs = {
    'next/server': { after: (fn) => { if (f.failures.has('after')) throw new Error('missing adapter'); background.push(fn); }, NextResponse: { json: (body, init) => response(body, init?.status || 200) } },
    '@/app/utils/supabase/admin': { createAdminClient: () => client, recordAuditLog: async (params) => { audits.push(params); if (f.failures.has('audit')) throw new Error('audit failure'); } },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: f.authActor } }) } }) },
    '@/app/utils/adminAccess': { resolveAdminAccess: async (_, actor) => ({ isAdmin: actor.userId === 'admin', userRole: actor.userId === 'admin' ? 'admin' : null }) },
    '@/app/utils/adminSupportUnreadAlerts': { startOrAdvanceAdminSupportUnreadBatch: async () => { f.unreadCount++; if (f.unreadGate) await f.unreadGate.promise; if (f.failures.has('unread')) throw new Error('unread failure'); } },
    '@/app/utils/adminAlertCenter': { insertAdminAlerts: async (params) => { alerts.push(params); if (f.failures.has('policy')) throw new Error('policy alert failure'); }, sendAdminAlertEmails: async () => { if (f.failures.has('email')) throw new Error('policy email failure'); } },
    '@/app/emails/delivery/sendTemplatedEmail': { sendTemplatedEmail: async (params) => { emails.push(params); if (f.emailGate) await f.emailGate.promise; if (f.failures.has('email')) throw new Error('email failure'); return { sent: true }; } },
  };
  f.load = sourceLoader(stubs, sources);
  f.client = client;
  f.drain = async () => { for (let i = 0; i < background.length; i++) await background[i](); };
  return f;
}

test('normal send response-path DB/Auth operations before -> after: 7 -> 3 (route auth unchanged)', async () => {
  const counts = [];
  for (const sources of [baselineSources, {}]) {
    const f = serverFixture({ sources });
    const result = await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'guest' }, body: { inquiryId: 1, content: 'Hello' } });
    assert.equal(result.success, true);
    counts.push(f.queries.length + f.localeCount);
    await f.drain(); assert.equal(f.localeCount, 1); assert.equal(f.notifications.length, 1); assert.equal(f.emails.length, 1);
    assert.equal(f.emails[0].locale, 'ja'); assert.equal(f.emails[0].transportPolicy, 'transactional');
  }
  assert.deepEqual(counts, [7, 3]);
  console.log(`normal send DB/Auth response operations: ${counts.join(' -> ')}; route auth +1 on both sides`);
});

for (const actor of ['guest', 'host', 'admin']) {
  test(`${actor}: saved message remains successful under notification/email/audit/policy failures`, async () => {
    const f = serverFixture(); f.authActor = { id: actor };
    for (const failure of ['notifications:insert', 'email', 'audit', 'policy']) f.failures.add(failure);
    const result = await f.load('app/api/inquiries/message/route.ts').POST({ json: async () => ({ inquiryId: 1, content: '010-1234-5678로 연락주세요' }) });
    assert.equal(result.status, 200); const body = await result.json(); assert.equal(body.success, true); assert.equal(body.message.id, 99);
    assert.equal(f.emails.length, 0); assert.equal(f.background.length, 1);
    await f.drain(); assert.equal(f.emails.length, 1, 'notification failure does not prevent email attempt');
    if (actor === 'admin') assert.equal(f.audits[0].action_type, 'ADMIN_MONITORED_CHAT_MESSAGE_SEND');
    else { assert.equal(f.alerts.length, 1); assert.equal(f.audits[0].action_type, 'CHAT_POLICY_SIGNAL_DETECTED'); }
  });

  for (const failure of ['inquiry_messages:insert', 'inquiries:update']) {
    test(`${actor}: actual ${failure} failure returns error and schedules no delivery`, async () => {
      const f = serverFixture(); f.authActor = { id: actor }; f.failures.add(failure);
      const result = await f.load('app/api/inquiries/message/route.ts').POST({ json: async () => ({ inquiryId: 1, content: 'Hello' }) });
      assert.equal(result.status, 500); assert.equal((await result.json()).success, false);
      assert.equal(f.background.length, 0); assert.equal(f.notifications.length, 0);
      if (failure === 'inquiries:update') assert.ok(f.queries.some((q) => q.operation === 'delete'));
    });
  }
}

test('support unread wave stays ordered before response; failure never changes committed result', async () => {
  const f = serverFixture({ type: 'admin_support' }); f.unreadGate = deferred(); f.failures.add('unread');
  let resolved = false;
  const send = f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'guest' }, body: { inquiryId: 1, content: 'Hello' } }).then((r) => { resolved = true; return r; });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(f.unreadCount, 1); assert.equal(resolved, false);
  f.unreadGate.resolve(); assert.equal((await send).success, true); await f.drain();
});

test('admin support audit and role routing execute after response and preserve official sender', async () => {
  const f = serverFixture({ type: 'admin_support' });
  await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'admin' }, body: { inquiryId: 1, content: 'reply' } });
  assert.equal(f.queries.length, 3); assert.equal(f.audits.length, 0); assert.equal(f.localeCount, 0);
  await f.drain(); assert.equal(f.audits[0].action_type, 'ADMIN_CS_MESSAGE_SEND');
  assert.equal(f.emails[0].payload.actorName, 'Locally Support');
  assert.equal(f.emails[0].recipient.userId, 'guest'); assert.equal(f.emails[0].audience, 'host');
});

test('after callback stays pending until email settles; missing adapter uses awaited fallback', async () => {
  const f = serverFixture(); f.emailGate = deferred();
  await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'guest' }, body: { inquiryId: 1, content: 'hello' } });
  let done = false; const delivery = f.drain().then(() => { done = true; });
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(f.emails.length, 1); assert.equal(done, false); f.emailGate.resolve(); await delivery;
  const fallback = serverFixture(); fallback.failures.add('after');
  assert.equal((await fallback.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'guest' }, body: { inquiryId: 1, content: 'hello' } })).success, true);
  assert.equal(fallback.emails.length, 1); assert.equal(fallback.background.length, 0);
});

test('unauthenticated/nonparticipant users are rejected before mutation; authorized support admin is accepted', async () => {
  const f = serverFixture();
  assert.equal((await f.load('app/api/inquiries/message/route.ts').POST({ json: async () => ({ inquiryId: 1, content: 'hello' }) })).status, 401);
  for (const type of ['general', 'admin_support']) {
    const scope = serverFixture({ type }); scope.authActor = { id: 'intruder' };
    assert.equal((await scope.load('app/api/inquiries/message/route.ts').POST({ json: async () => ({ inquiryId: 1, content: 'hello' }) })).status, 403);
    assert.ok(scope.queries.every((q) => q.operation === 'select')); assert.equal(scope.background.length, 0);
  }
});

async function adminFixture(options = {}) {
  const f = clientFixture(options); f.auth = async () => ({ data: { user: { id: 'admin' } } }); const useAdmin = f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  let state;
  function Probe() { const chat = useAdmin({ view: options.view || 'support' }); React.useEffect(() => { state = chat; }); return React.createElement('div', null, chat.messages.map((m) => React.createElement('p', { key: m.id }, m.content))); }
  await f.mount(Probe); f.admin = () => state; await f.flush(() => state.selectInquiry(1)); return f;
}
for (const view of ['support', 'monitor']) {
  test(`admin ${view}: canonical ACK reduces POST + full GET from 2 -> 1 requests`, async () => {
    const totals = [];
    for (const sources of [baselineSources, {}]) {
      const f = await adminFixture({ sources, role: 'admin', view });
      try {
        const request = f.request;
        f.request = (url, opts) => url === '/api/inquiries/message' ? response({ success: true, inquiryId: 1, messageId: 99, displayContent: 'reply', updatedAt: timestamp, message: message(99, 1, 'admin', 'reply') }) : request(url, opts);
        const before = f.calls.requests.length;
        await f.flush(() => f.admin().sendMessage(1, 'reply'));
        totals.push(f.calls.requests.length - before);
        if (!Object.keys(sources).length) assert.equal(f.admin().messages.filter((m) => m.id === 99).length, 1);
      } finally { await f.dispose(); }
    }
    assert.deepEqual(totals, [2, 1]);
  });
}

test('admin canonical ACK preserves observed read/deleted state and resists stale GET', async () => {
  const f = await adminFixture({ role: 'admin' });
  try {
    const ack = deferred(), get = deferred(), request = f.request; let send, stale;
    f.request = (url, opts) => url === '/api/inquiries/message' ? ack.promise : /\/messages$/.test(url) ? get.promise : request(url, opts);
    await f.flush(() => { send = f.admin().sendMessage(1, 'private reply'); stale = f.admin().loadMessages(1); });
    const deleted = { ...message(99, 1, 'admin', 'private reply'), is_read: true, read_at: timestamp, type: 'deleted' };
    await emit(f, 'UPDATE', 'inquiry_messages', deleted);
    await f.flush(async () => { ack.resolve(response({ success: true, inquiryId: 1, messageId: 99, displayContent: 'private reply', updatedAt: timestamp, message: message(99, 1, 'admin', 'private reply') })); await send; });
    await f.flush(async () => { get.resolve(response({ success: true, data: [message(10, 1)] })); await stale; });
    const row = f.admin().messages.find((m) => m.id === 99); assert.ok(row);
    assert.equal(row.type, 'deleted'); assert.equal(row.is_read, true); assert.equal(row.read_at, timestamp); assert.doesNotMatch(row.content, /private reply/);
  } finally { await f.dispose(); }
});

test('OpenNext Cloudflare adapter provides after waitUntil and drains promises via invocation context', async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const { runWithOpenNextRequestContext } = sourceLoader({ '../adapters/logger': { debug() {}, error() {} }, './requestCache': { RequestCache: class {} } })('node_modules/@opennextjs/aws/dist/utils/promise.js');
  const previousAls = globalThis.__openNextAls, symbol = Symbol.for('@next/request-context'), previousContext = globalThis[symbol];
  globalThis.__openNextAls = new AsyncLocalStorage();
  const pending = [], gate = deferred();
  await runWithOpenNextRequestContext({ isISRRevalidation: false, waitUntil: (promise) => pending.push(promise) }, async () => {
    const waitUntil = globalThis[Symbol.for('@next/request-context')].get().waitUntil;
    assert.equal(typeof waitUntil, 'function'); waitUntil(gate.promise);
  });
  assert.ok(pending.includes(gate.promise)); gate.resolve(); await Promise.all(pending);
  globalThis.__openNextAls = previousAls; globalThis[symbol] = previousContext;
  const wrapper = readFileSync('node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-node.js', 'utf8');
  assert.match(wrapper, /waitUntil: ctx\.waitUntil\.bind\(ctx\)/);
});

test('batched notifications recover every canonical row without full reload or duplicate bubbles', async (t) => {
  const f = await mount(t); await f.flush(() => f.get().loadMessages(1));
  const original = f.query;
  f.query = (q) => q.table === 'inquiry_messages' && q.filters.some(([, key]) => key === 'id')
    ? { data: message(Number(q.filters.find(([, key]) => key === 'id')[2]), 1) } : original(q);
  f.notifications = [32, 31].map((id) => ({ id: id + 100, type: 'new_message', link: `/guest/inbox?inquiryId=1&messageId=${id}` }));
  await f.mount();
  assert.deepEqual(f.get().messages.map((m) => m.id).sort((a, b) => a - b), [10, 31, 32]);
  assert.equal(fullInbox(f), 1); assert.equal(fullThread(f), 1);
});

test('admin first support reply: canonical ACK renders once, status PATCH receives ACK token, lock remains', async (t) => {
  const f = clientFixture({ rows: [{ ...inquiry(1, 'admin_support'), host_id: 'admin' }], additionalStubs: {
    '@/app/components/ui/ConfirmModal': { default: () => null },
  } });
  t.after(() => f.dispose()); f.auth = async () => ({ data: { user: { id: 'admin' } } }); f.searchParams.set('inquiryId', '1');
  const Component = f.load('app/admin/dashboard/components/ChatMonitor.tsx').default;
  await f.mount(Component);
  const original = f.request, ack = deferred(), status = deferred(), statusTime = '2026-10-01T00:00:01.000Z';
  f.request = (url, options) => url === '/api/inquiries/message' ? ack.promise : url.endsWith('/status') ? status.promise : original(url, options);
  const textarea = f.dom.window.document.querySelector('textarea'); assert.ok(textarea);
  await f.flush(() => {
    Object.getOwnPropertyDescriptor(f.dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'first support reply');
    textarea.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
  });
  const before = f.calls.requests.length;
  await f.flush(() => textarea.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  assert.equal(textarea.disabled, true);
  await f.flush(() => ack.resolve(response({ success: true, inquiryId: 1, messageId: 99, displayContent: 'first support reply', updatedAt: timestamp, message: message(99, 1, 'admin', 'first support reply') })));
  const sends = f.calls.requests.slice(before);
  assert.equal(sends.length, 2, 'POST then status PATCH, no intervening message GET');
  assert.equal(sends[1].url, '/api/admin/inquiries/1/status');
  assert.deepEqual(JSON.parse(sends[1].options.body), { status: 'in_progress', updated_at: timestamp });
  assert.equal(textarea.disabled, true, 'composer remains locked until required status transition completes');
  assert.match(f.dom.window.document.body.textContent, /first support reply/);
  f.rows = [{ ...f.rows[0], status: 'in_progress', updated_at: statusTime }];
  await f.flush(() => status.resolve(response({ success: true, data: { id: 1, status: 'in_progress', updated_at: statusTime } })));
  assert.equal(textarea.disabled, false); assert.equal(textarea.value, '');
  assert.equal(f.calls.requests.filter(({ url }) => url.endsWith('/1/messages')).length, 1);
  assert.match(f.dom.window.document.body.textContent, /처리중/);
});

for (const role of ['guest', 'host']) {
  test(`${role}: pre-Realtime GET cannot downgrade buffered own row while ACK is still pending`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    const actor = role === 'guest' ? 'guest' : 'host', request = f.request, ack = deferred(), get = deferred(), original = f.query;
    f.request = (url, opts) => url === '/api/inquiries/message' ? ack.promise : request(url, opts);
    let send, stale;
    await f.flush(() => { send = f.get().sendMessage(1, 'draft'); });
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? get.promise : original(q);
    await f.flush(() => { stale = f.get().loadMessages(1); });
    await emit(f, 'UPDATE', 'inquiry_messages', { ...message(99, 1, actor, 'draft'), is_read: true, read_at: timestamp, type: 'deleted' });
    await f.flush(async () => { get.resolve({ data: [message(10, 1), message(99, 1, actor, 'draft')] }); await stale; });
    assert.equal(f.get().messages.filter((m) => m.id === 99).length, 0);
    assert.equal(f.get().messages.filter((m) => String(m.id).startsWith('temp-')).length, 1);
    await f.flush(async () => { ack.resolve(response({ success: true, messageId: 99, displayContent: 'draft', updatedAt: timestamp, message: message(99, 1, actor, 'draft') })); await send; });
    const row = f.get().messages.find((m) => m.id === 99);
    assert.equal(row.type, 'deleted'); assert.equal(row.is_read, true); assert.equal(row.read_at, timestamp);
  });

  test(`${role}: send ACK and stale inbox response cannot revert a newer incoming preview`, async (t) => {
    const f = await mount(t, { role }); await f.flush(() => f.get().loadMessages(1));
    const ack = deferred(), inbox = deferred(), request = f.request, original = f.query;
    f.request = (url, opts) => url === '/api/inquiries/message' ? ack.promise : request(url, opts);
    let send, refresh;
    await f.flush(() => { send = f.get().sendMessage(1, 'my reply'); });
    f.query = (q) => q.table === 'inquiries' ? inbox.promise : original(q);
    await f.flush(() => { refresh = f.get().refresh(false); });
    const createdAt = '2026-10-01T00:00:02.000Z';
    await emit(f, 'INSERT', 'inquiry_messages', { ...message(31, 1, role === 'guest' ? 'host' : 'guest', 'newer incoming'), created_at: createdAt });
    await f.flush(async () => { ack.resolve(response({ success: true, messageId: 99, displayContent: 'my reply', updatedAt: timestamp })); await send; inbox.resolve({ data: f.rows }); await refresh; });
    assert.equal(f.get().inquiries.find((i) => i.id === 1).content, 'newer incoming');
    assert.equal(f.get().selectedInquiry.content, 'newer incoming');
  });
}

test('admin send failure keeps draft and emits no status transition or canonical bubble', async (t) => {
  const f = clientFixture({ rows: [inquiry(1, 'admin_support')], additionalStubs: { '@/app/components/ui/ConfirmModal': { default: () => null } } });
  t.after(() => f.dispose()); f.auth = async () => ({ data: { user: { id: 'admin' } } }); f.searchParams.set('inquiryId', '1');
  await f.mount(f.load('app/admin/dashboard/components/ChatMonitor.tsx').default);
  const request = f.request; f.request = (url, opts) => url === '/api/inquiries/message' ? response({ success: false, error: 'storage failed' }, 500) : request(url, opts);
  const textarea = f.dom.window.document.querySelector('textarea');
  await f.flush(() => {
    Object.getOwnPropertyDescriptor(f.dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'restore admin draft');
    textarea.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
  });
  await f.flush(() => textarea.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  assert.equal(textarea.value, 'restore admin draft'); assert.equal(textarea.disabled, false);
  assert.equal(f.calls.requests.filter(({ url }) => url.endsWith('/status')).length, 0);
  const clone = f.dom.window.document.body.cloneNode(true); clone.querySelectorAll('textarea').forEach((e) => e.remove());
  assert.doesNotMatch(clone.textContent, /restore admin draft/);
});

test('bulk read updates coalesce to one scoped unread query without cancelling selected catch-up', async (t) => {
  const f = await mount(t); await f.flush(() => f.get().loadMessages(1));
  const before = queryCount(f);
  for (let id = 40; id < 45; id++) await emit(f, 'UPDATE', 'inquiry_messages', { ...message(id, 2), is_read: true, read_at: timestamp });
  await f.timers(300);
  assert.equal(queryCount(f) - before, 1);
  assert.equal(fullInbox(f), 1); assert.equal(fullThread(f), 1);
  await f.flush(() => f.calls.channels.at(-1).status('SUBSCRIBED'));
  await emit(f, 'INSERT', 'inquiry_messages', { id: 50, inquiry_id: 2 });
  await f.timers(1000);
  assert.equal(fullThread(f), 2, 'unselected partial INSERT does not cancel selected reconnect recovery');
});

test('admin read UPDATE preserves private image delivery and deleted UPDATE removes the image', async () => {
  const f = await adminFixture();
  try {
    await emit(f, 'UPDATE', 'inquiry_messages', { ...message(10, 1, 'admin'), type: 'image', image_url: 'private-storage/object.png', is_read: true, read_at: timestamp });
    assert.equal(f.admin().messages[0].image_url, '/api/inquiries/messages/10/image');
    await emit(f, 'UPDATE', 'inquiry_messages', { ...message(10, 1, 'admin'), type: 'deleted', image_url: 'private-storage/object.png', is_read: true, read_at: timestamp });
    assert.equal(f.admin().messages[0].image_url, null); assert.equal(f.admin().messages[0].read_at, timestamp);
    assert.equal(f.calls.requests.filter(({ url }) => url.endsWith('/1/messages')).length, 1);
  } finally { await f.dispose(); }
});
