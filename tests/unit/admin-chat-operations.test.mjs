import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { sourceLoader, clientFixture, inquiry, response } from './helpers/chatRuntime.mjs';

const load = sourceLoader();
const { EMPTY_CHAT_OPERATIONS: empty, matchesChatOperations: matches, adjacentConversation, adminConversationPermalink } = load('app/utils/adminChatOperations.ts');
const { formatPhoneTimestamp, formatAdminSyncTime } = load('app/utils/adminChatTime.ts');
const startingMain = '06249e0747fe3542b71f88e0819da58326ea77e3';

test('orthogonal exact N, needs_reply and reopened predicates and all combinations', () => {
  const rows = [
    { id: 1, admin_unread_count: 10, needs_reply: false, support_reopened_at: null, last_sender_role: 'admin', is_read: true },
    { id: 2, admin_unread_count: 0, needs_reply: true, support_reopened_at: null, last_sender_role: 'customer', is_read: false },
    { id: 3, admin_unread_count: 0, needs_reply: false, support_reopened_at: '2026-10-02T00:00Z' },
    { id: 4, admin_unread_count: 1, needs_reply: true, support_reopened_at: '2026-10-02T00:00Z' },
  ];
  for (let mask = 0; mask < 8; mask++) {
    const f = { unseen: Boolean(mask & 1), needsReply: Boolean(mask & 2), reopened: Boolean(mask & 4) };
    const expected = mask === 0 ? [1, 2, 3, 4] : mask === 1 ? [1, 4] : mask === 2 ? [2, 4] : mask === 4 ? [3, 4] : [4];
    assert.deepEqual(rows.filter(row => matches(row, f)).map(row => row.id), expected);
  }
  assert.equal(matches({ needs_reply: true, last_sender_role: 'customer' }, { ...empty, unseen: true }), false);
});

test('KST formatting is deterministic across UTC day/year boundaries and overseas DST changes', () => {
  for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const saved = process.env.TZ; process.env.TZ = zone;
    try {
      assert.equal(formatPhoneTimestamp('2026-12-31T15:01:00Z'), '01. 01. 00:01');
      assert.equal(formatPhoneTimestamp('2026-10-02T15:21:00Z'), '10. 03. 00:21');
      assert.equal(formatAdminSyncTime('2026-03-08T10:01:00Z'), '19:01');
      assert.equal(formatAdminSyncTime('2026-11-01T09:01:00Z'), '18:01');
      assert.equal(formatPhoneTimestamp('invalid'), '');
      assert.equal(formatPhoneTimestamp(null), '');
    } finally { if (saved == null) delete process.env.TZ; else process.env.TZ = saved; }
  }
});

test('permalinks use canonical CHATS routes; no stale filter or other conversation params', () => {
  assert.equal(adminConversationPermalink('https://example.test', 2, 'support'), 'https://example.test/admin/dashboard?tab=CHATS&view=support&inquiryId=2');
  assert.equal(adminConversationPermalink('https://example.test', 2, 'phone', 'request-2'), 'https://example.test/admin/dashboard?tab=CHATS&view=phone&proxyRequestId=request-2');
  assert.equal(adjacentConversation(['9', '2', '4'], '2', 1), '4');
  assert.equal(adjacentConversation(['9', '2', '4'], '2', -1), '9');
  assert.equal(adjacentConversation(['9'], '9', 1), null);
  assert.equal(adjacentConversation(['9'], '9', -1), null);
  assert.equal(adjacentConversation(['9'], 'filtered-out', 1), '9');
});

function serverFixture(before = false, count = 4) {
  const calls = [];
  const rows = Array.from({ length: count }, (_, n) => ({ ...inquiry(n + 1, 'admin_support'), inquiry_messages: [] }));
  const activities = rows.map((row, n) => ({ inquiry_id: row.id, admin_unread_count: n === 0 ? 10 : n === 3 ? 1 : 0,
    needs_reply: n === 1 || n === 3, phone_needs_reply: n === 3,
    support_reopened_at: n >= 2 ? '2026-10-02T00:00Z' : null }));
  const requests = rows.map(row => ({ id: `request-${row.id}`, user_id: row.user_id, category: 'RESTAURANT', status: 'COMPLETED',
    payment_status: 'COMPLETED', created_at: '2026-10-02T00:00Z', updated_at: '2026-10-02T00:00Z',
    form_data: { linked_inquiry_id: String(row.id) } }));
  let phone = false, user = { id: 'admin' };
  const client = {
    from(table) {
      const state = { table, filters: [], range: null, single: false };
      const q = {};
      for (const method of ['select', 'order', 'limit', 'range', 'eq', 'in', 'or', 'maybeSingle']) q[method] = (...args) => {
        if (method === 'range') state.range = args;
        if (method === 'maybeSingle') state.single = true;
        if (['eq', 'in'].includes(method)) state.filters.push([method, ...args]);
        return q;
      };
      q.then = (yes, no) => Promise.resolve().then(() => {
        calls.push(state);
        if (table === 'users') return { data: { role: 'admin' } };
        let result = table === 'inquiries' ? rows : table === 'proxy_requests' && phone ? requests : [];
        for (const [method, key, value] of state.filters) result = result.filter(row => {
          const actual = key === 'form_data->>linked_inquiry_id' ? row.form_data?.linked_inquiry_id : row[key];
          return method === 'eq' ? String(actual) === String(value) : value.map(String).includes(String(actual));
        });
        if (state.range) result = result.slice(state.range[0], state.range[1] + 1);
        return { data: state.single ? result[0] ?? null : result, error: null };
      }).then(yes, no);
      return q;
    },
    rpc: async (name, args) => {
      calls.push({ rpc: name, ids: args.p_inquiry_ids });
      return { data: activities.filter(row => args.p_inquiry_ids.map(String).includes(String(row.inquiry_id))), error: null };
    },
  };
  const list = 'app/api/admin/inquiries/route.ts';
  const phoneList = 'app/api/admin/customer-support/route.ts';
  const queries = 'app/api/admin/customer-support/queries.ts';
  const sources = before ? Object.fromEntries([list, phoneList, queries].map(p => [resolve(p), execFileSync('git', ['show', `${startingMain}:${p}`], { encoding: 'utf8' })])) : {};
  const loader = sourceLoader({ 'server-only': {}, 'next/server': { NextResponse: { json: (body, init) => response(body, init?.status || 200) } },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/app/utils/supabase/admin': { createAdminClient: () => client } }, sources);
  return { calls, rows, activities, setUser: value => { user = value; },
    get: async (surface, query = '') => { phone = surface === 'phone'; return loader(surface === 'phone' ? phoneList : list).GET(new Request(`http://fixture.test/api?${surface === 'phone' ? 'filter=all&' : 'view=support&'}${query}`)); } };
}

for (const surface of ['support', 'phone']) test(`${surface} server filters precede pagination and batch enrichment remains bounded`, async () => {
  const f = serverFixture();
  const expected = surface === 'phone' ? { unseen: [1, 4], needsReply: [4], reopened: [3, 4] } : { unseen: [1, 4], needsReply: [2, 4], reopened: [3, 4] };
  for (const key of ['unseen', 'needsReply', 'reopened']) {
    f.calls.length = 0;
    const result = await (await f.get(surface, `${key}=true`)).json();
    assert.deepEqual(result.data.map(row => Number(String(row.id).replace('request-', ''))), expected[key]);
    assert.equal(f.calls.filter(call => call.rpc).length, 1, 'one existing activity RPC per batch');
    assert.equal(result.data.some(row => 'phoneLinked' in row || 'matchesOperations' in row || 'row' in row), false);
  }
  const combined = await (await f.get(surface, 'unseen=true&needsReply=true&reopened=true')).json();
  assert.deepEqual(combined.data.map(row => String(row.id)), [surface === 'phone' ? 'request-4' : '4']);
  const page = await (await f.get(surface, 'unseen=true&limit=1&offset=1')).json();
  assert.equal(String(page.data[0].id), surface === 'phone' ? 'request-4' : '4');
  assert.equal(page.pagination.hasMore, false);
  const before = serverFixture(true), after = serverFixture();
  await before.get(surface); await after.get(surface);
  assert.equal(after.calls.length, before.calls.length);
  console.log('PHASE3A_DB', JSON.stringify({ surface, initialBefore: before.calls.length, initialAfter: after.calls.length, filters: f.calls.filter(c => c.rpc).length }));
});

test('support filter finds a sparse match beyond 100 without re-reading activity per row', async () => {
  const f = serverFixture(false, 205);
  f.activities.forEach(row => { row.admin_unread_count = row.inquiry_id === 205 ? 1 : 0; });
  const result = await (await f.get('support', 'unseen=true')).json();
  assert.deepEqual(result.data.map(row => row.id), [205]);
  assert.equal(f.calls.filter(call => call.rpc).length, 3);
  assert.equal(Math.max(...f.calls.filter(call => call.rpc).map(call => call.ids.length)), 100);
});

test('selected inquiry outside operations filter remains available for canonical URL resolution', async () => {
  const f = serverFixture();
  const result = await (await f.get('support', 'unseen=true&inquiryId=2')).json();
  assert.deepEqual(result.data.map(row => row.id), [2, 1, 4]);
  assert.deepEqual(result.selection, { view: 'support' });
  f.setUser(null);
  assert.equal((await f.get('support', 'unseen=true')).status, 401);
  assert.equal((await f.get('phone', 'unseen=true')).status, 401);
});

test('operational filter switch retains selected thread/flight/channel and only refreshes list', async () => {
  const f = clientFixture({ role: 'admin', rows: [inquiry(1, 'admin_support')] });
  f.auth = async () => ({ data: { user: { id: 'admin' } } });
  const useQuery = f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  let state, change;
  function Probe() { const [filters, set] = React.useState(empty); const value = useQuery({ operations: filters }); React.useEffect(() => { change = set; state = value; }, [value, set]); return React.createElement('div'); }
  try {
    await f.mount(Probe); await f.flush(() => state.selectInquiry(1));
    const channels = f.calls.channels.length, threads = f.calls.requests.filter(r => r.url.endsWith('/messages')).length;
    for (const filters of [{ ...empty, unseen: true }, { ...empty, needsReply: true }, { ...empty, reopened: true }, empty]) {
      await f.flush(() => change(filters));
      assert.equal(state.selectedInquiry.id, 1);
      assert.equal(state.isMessagesLoading, false);
      assert.equal(f.calls.channels.length, channels);
      assert.equal(f.calls.requests.filter(r => r.url.endsWith('/messages')).length, threads);
    }
    assert.ok(f.calls.requests.some(r => r.url.includes('unseen=true')));
  } finally { await f.dispose(); }
});

test('sync observes subscribed/reconnecting/offline/hidden and successful catchup, creates no I/O', async () => {
  const f = clientFixture();
  const useSync = f.load('app/admin/dashboard/hooks/useAdminChatSync.ts').useAdminChatSync;
  let state;
  function Probe() { const value = useSync(); React.useEffect(() => { state = value; }); return React.createElement('div'); }
  try {
    await f.mount(Probe); assert.equal(state.state, 'reconnecting');
    await f.flush(() => state.onSubscription('SUBSCRIBED')); assert.equal(state.state, 'connected');
    await f.flush(() => state.onSuccess()); const synced = state.lastSyncedAt; assert.ok(synced);
    await f.flush(() => state.onSubscription('CHANNEL_ERROR')); assert.equal(state.state, 'reconnecting');
    await f.flush(() => { Object.defineProperty(f.dom.window.navigator, 'onLine', { value: false, configurable: true }); f.dom.window.dispatchEvent(new f.dom.window.Event('offline')); });
    assert.equal(state.state, 'offline'); assert.equal(state.lastSyncedAt, synced);
    await f.flush(() => { Object.defineProperty(f.dom.window.navigator, 'onLine', { value: true, configurable: true }); f.dom.window.dispatchEvent(new f.dom.window.Event('online')); state.onSubscription('SUBSCRIBED'); state.onSuccess(); });
    assert.equal(state.state, 'connected');
    await f.flush(() => { Object.defineProperty(f.dom.window.document, 'hidden', { value: true, configurable: true }); f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')); });
    assert.equal(state.state, 'paused');
    assert.equal(f.calls.requests.length, 0); assert.equal(f.calls.channels.length, 0); assert.equal(f.calls.queries.length, 0);
  } finally { await f.dispose(); }
  const source = readFileSync('app/admin/dashboard/hooks/useAdminChatSync.ts', 'utf8');
  assert.doesNotMatch(source, /setInterval|setTimeout|fetch\(|\.channel\(/);
});

for (const surface of ['support', 'phone']) test(`${surface} N filter uses ready shared snapshot absence as zero and preserves selection`, async () => {
  const row = { ...inquiry(1, 'admin_support'), admin_unread_count: 10 };
  const f = clientFixture({ role: 'admin', rows: [row], additionalStubs: { '@/app/components/ui/ConfirmModal': { default: () => null } } });
  f.auth = async () => ({ data: { user: { id: 'admin' } } });
  const original = f.request;
  let unseen = 10;
  f.request = (url, options) => url.startsWith('/api/admin/sidebar-counts') ? Promise.resolve(response({ success: true, data: {
    conversations: unseen ? [{ inquiry_id: 1, surface, admin_unread_count: unseen }] : [], adminAlertsUnread: 0,
  } })) : url.startsWith('/api/admin/customer-support') ? Promise.resolve(response({ success: true, data: [{
    id: 'request-1', user_id: 'guest', category: 'RESTAURANT', status: 'COMPLETED', payment_status: 'COMPLETED',
    needs_reply: true, needs_attention: false, linked_inquiry_id: '1', admin_unread_count: 10,
    form_data: { restaurant_name: 'test' }, profiles: { full_name: '고객' },
  }], pagination: { hasMore: false } })) : original(url, options);
  const { default: Provider, useAdminAttention } = f.load('app/admin/dashboard/components/AdminAttentionProvider.tsx');
  const View = f.load(surface === 'phone' ? 'app/admin/dashboard/components/PhoneReservationTab.tsx' : 'app/admin/dashboard/components/ChatMonitor.tsx').default;
  let store;
  function Probe() { const value = useAdminAttention(); React.useEffect(() => { store = value; }, [value]); return React.createElement(View); }
  function Root() { return React.createElement(Provider, { userId: 'admin' }, React.createElement(Probe)); }
  try {
    await f.mount(Root);
    const checkbox = f.dom.window.document.querySelector('input[type="checkbox"]');
    await f.flush(() => checkbox.click());
    const selector = surface === 'phone' ? '[data-testid="admin-phone-reservation-list-item"]' : '[data-testid="admin-chat-inquiry-row-1"]';
    assert.ok(f.dom.window.document.querySelector(selector));
    unseen = 0;
    await f.flush(() => store.refresh());
    assert.equal(f.dom.window.document.querySelector(selector), null, 'stale list metadata cannot override canonical zero');
  } finally { await f.dispose(); }
});
