import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import test from 'node:test';
import React from 'react';
import { sourceLoader, queryBuilder, clientFixture, inquiry, message, response, deferred } from './helpers/chatRuntime.mjs';

// Frozen source from reviewed commit c2c9f85d454bc2c3ef91fe76583647a973611fd6.
// Keep the baseline portable after a squash merge or shallow checkout.
const beforeSource = readFileSync('tests/unit/fixtures/admin-chat-before-review.ts.txt', 'utf8');
assert.equal(createHash('sha256').update(beforeSource).digest('hex'), '50a7b1c2b6c5a1c54d9cb91c397df1198acc065e7b29e7575fdbb34013f0d0cb', 'reviewed baseline must remain byte-for-byte unchanged');
const hookPath = 'app/admin/dashboard/hooks/useAdminChatQuery.ts';

function countedServer() {
  const queries = [], rpcs = [];
  const row = inquiry(1, 'admin_support');
  const client = {
    from: table => queryBuilder(table, state => {
      queries.push(state);
      if (table === 'users') return { data: { role: 'admin' } };
      if (table === 'admin_whitelist') return { data: null };
      if (table === 'inquiries') return { data: state.filters.some(([method,key]) => method === 'eq' && key === 'id') ? row : [row] };
      if (table === 'proxy_requests' || table === 'host_applications') return { data: [] };
      if (table === 'profiles') return { data: [{ id: 'guest', full_name: 'Customer' }] };
      if (table === 'inquiry_messages') return state.columns === 'inquiry_id' ? { data: [] }
        : state.columns === 'id' ? { count: 0 } : { data: [message(10, 1, 'guest')] };
      if (table === 'admin_support_unread_alert_batches') return { data: state.operation === 'update' ? [{ inquiry_id: 1 }]
        : { inquiry_id: 1, first_unread_message_id: null, first_unread_message_at: null, last_unread_message_id: null } };
      throw new Error(`Unmocked table ${table}`);
    }),
    rpc: async (name, args) => {
      rpcs.push({ name, args });
      if (name === 'list_admin_support_recency') return {data:[{id:'1',canonical_activity_at:row.updated_at}]};
      return { data: name === 'get_admin_inquiry_activity' ? [{ inquiry_id: 1, status: 'open', updated_at: row.updated_at,
        last_sender_role: 'customer', last_message_at: row.updated_at, needs_reply: true, admin_unread_count: 0 }] : 0 };
    },
  };
  const load = sourceLoader({
    'server-only': {},
    'next/server': { NextResponse: { json: (body, init) => response(body, init?.status || 200) } },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin', email: 'admin@example.invalid' } } }) } }) },
    '@/app/utils/supabase/admin': { createAdminClient: () => client },
    '@/app/utils/adminAlertCenter': { insertAdminAlerts: async () => {}, sendAdminAlertEmails: async () => {} },
    '@/app/utils/privateStorageDelivery': { getPrivateChatImageDeliveryUrl: id => `/api/inquiries/messages/${id}/image` },
  });
  const list = load('app/api/admin/inquiries/route.ts').GET;
  const detail = load('app/api/admin/inquiries/[id]/messages/route.ts').GET;
  const ack = load('app/api/admin/inquiries/[id]/ack/route.ts').POST;
  return { queries, rpcs, request: async (url, options) => {
    const result = url.includes('?') ? await list(new Request(`http://localhost${url}`))
      : /\/messages$/.test(url) ? await detail({}, { params: Promise.resolve({ id: '1' }) })
        : await ack({ json: async () => JSON.parse(options.body) }, { params: Promise.resolve({ id: '1' }) });
    assert.equal(result.status, 200, `actual route ${url}`);
    return result;
  } };
}

async function mountAdmin(f) {
  f.auth = async () => ({ data: { user: { id: 'admin' } } });
  const useAdmin = f.load(hookPath).useAdminChatQuery;
  let state;
  function Probe() {
    const chat = useAdmin();
    React.useEffect(() => { state = chat; });
    return null;
  }
  await f.mount(Probe);
  return () => state;
}

// Phase 2 removes the participant-unread query from each list GET in both fixtures.
test('idle visible subscribed ten-minute API/DB counts: reviewed 30s baseline vs slow safety net', async () => {
  const metrics = [];
  for (const sources of [{ [resolve(hookPath)]: beforeSource }, {}]) {
    const server = countedServer();
    const f = clientFixture({ sources });
    try {
      f.request = server.request;
      const admin = await mountAdmin(f);
      await f.flush(() => admin().selectInquiry(1));
      await f.flush(() => f.calls.channels[0].status('SUBSCRIBED'));
      f.calls.requests.length = 0; server.queries.length = 0; server.rpcs.length = 0;
      await f.advanceTimers(600_000);
      metrics.push({
        list: f.calls.requests.filter(r => r.url.includes('?')).length,
        thread: f.calls.requests.filter(r => /\/messages$/.test(r.url)).length,
        ack: f.calls.requests.filter(r => /\/ack$/.test(r.url)).length,
        api: f.calls.requests.length,
        db: server.queries.length + server.rpcs.length,
      });
    } finally { await f.dispose(); }
  }
  assert.deepEqual(metrics, [
    { list: 20, thread: 20, ack: 20, api: 60, db: 500 },
    { list: 2, thread: 2, ack: 0, api: 4, db: 36 },
  ]);
  console.log(`ADMIN_CHAT_IDLE_10_MIN ${JSON.stringify({ before: metrics[0], after: metrics[1] })}`);
});

test('ack skips zero-unread snapshots, coalesces pending calls, retries failures and sees late lower-ID commits', async () => {
  const f = clientFixture({ rows: [inquiry(1, 'admin_support'), inquiry(2, 'admin_support')] });
  try {
    const admin = await mountAdmin(f);
    let unread = 0, ids = [11], ackResult = response({ success: true });
    const gate = deferred();
    const original = f.request;
    f.request = async (url, options) => /\/messages$/.test(url) ? response({ success: true,
      inquiry: { ...f.rows.find(row => String(row.id) === url.split('/')[4]), admin_unread_count: unread },
      data: ids.map(id => message(id, Number(url.split('/')[4]), 'guest')) })
      : /\/ack$/.test(url) ? ackResult : original(url, options);
    const acknowledgements = () => f.calls.requests.filter(r => /\/ack$/.test(r.url));
    await f.flush(() => admin().selectInquiry(1)); assert.equal(acknowledgements().length, 0);
    unread = 1; ackResult = gate.promise;
    await f.flush(async () => assert.equal(await admin().loadMessages(1), true));
    await f.flush(async () => assert.equal(await admin().loadMessages(1), true)); assert.equal(acknowledgements().length, 1, 'one pending POST');
    await f.flush(() => gate.resolve(response({ success: false }, 500)));
    ackResult = response({ success: true });
    await f.flush(async () => assert.equal(await admin().loadMessages(1), true)); assert.equal(acknowledgements().length, 2, 'failure is retryable');
    await f.flush(async () => assert.equal(await admin().loadMessages(1), true)); assert.equal(acknowledgements().length, 2, 'successful same snapshot is cached');
    ids = [10,11];
    await f.flush(async () => assert.equal(await admin().loadMessages(1), true)); assert.equal(acknowledgements().length, 3, 'same max ID with new lower-ID row is a new snapshot');
    assert.equal(JSON.parse(acknowledgements()[2].options.body).throughMessageId, '11');
    await f.flush(() => admin().selectInquiry(2)); assert.equal(acknowledgements().length, 4, 'cache is scoped to the inquiry');
    await f.flush(() => admin().selectInquiry(1)); assert.equal(acknowledgements().length, 4);
    unread = 0; ids = [10,11,12];
    await f.flush(async () => assert.equal(await admin().loadMessages(1), true)); assert.equal(acknowledgements().length, 4, 'already read new snapshot needs no acknowledgement');
  } finally { await f.dispose(); }
});
