import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {
  clientFixture, deferred, inquiry, message, response, timestamp,
  sourceLoader, queryBuilder,
} from './helpers/chatRuntime.mjs';

async function mounted(t, options) {
  const fixture = clientFixture(options);
  t.after(() => fixture.dispose());
  await fixture.mount();
  return fixture;
}
const inboxRequests = (f) => f.calls.queries.filter((query) => query.table === 'inquiries');
const messageRequests = (f) => f.calls.queries.filter((query) => query.table === 'inquiry_messages' && query.columns !== 'inquiry_id');
const sends = (f) => f.calls.requests.filter(({ url }) => url === '/api/inquiries/message');
const ids = (f) => f.get().messages.map((msg) => String(msg.id));

for (const role of ['guest', 'host']) {
  test(`${role}: one initial inbox fetch, with SUBSCRIBED/reconnect catch-up preserved`, async (t) => {
    const f = await mounted(t, { role });
    assert.equal(f.calls.auth, 1);
    assert.equal(inboxRequests(f).length, 1);
    assert.equal(f.calls.channels.length, 1);
    await f.flush(() => f.get().loadMessages(1));
    const before = messageRequests(f).length;
    await f.flush(() => f.calls.channels[0].status('SUBSCRIBED'));
    await f.timers(0);
    assert.equal(messageRequests(f).length, before + 1);
    await f.timers(300);
    assert.equal(inboxRequests(f).length, 2);
    await f.timers(700);
    assert.equal(messageRequests(f).length, before + 2);
    await f.flush(() => f.calls.channels[0].status('SUBSCRIBED'));
    await f.timers(700);
    assert.equal(inboxRequests(f).length, 3);
    assert.equal(messageRequests(f).length, before + 4);
  });

  test(`${role}: cached user sends immediately; stale refetch preserves temp and acknowledged row`, async (t) => {
    const f = await mounted(t, { role });
    await f.flush(() => f.get().loadMessages(1));
    const blockedAuth = deferred();
    f.auth = () => blockedAuth.promise;
    const ack = deferred();
    const request = f.request;
    f.request = (url, options) => url === '/api/inquiries/message' ? ack.promise : request(url, options);
    const authBefore = f.calls.auth;
    let send;
    await f.flush(() => { send = f.get().sendMessage(1, 'instant bubble'); });
    assert.equal(f.calls.auth, authBefore);
    assert.equal(sends(f).length, 1);
    assert.equal(f.get().messages.at(-1).content, 'instant bubble');
    assert.match(ids(f).at(-1), /^temp-/);
    assert.match(f.dom.window.document.body.textContent, /instant bubble/);
    const oldQuery = f.query;
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? { data: [] } : oldQuery(q);
    await f.flush(() => f.get().loadMessages(1));
    assert.equal(f.get().messages.length, 1);
    await f.flush(async () => { ack.resolve(response({ success: true, messageId: 99, updatedAt: timestamp })); await send; });
    assert.deepEqual(ids(f), ['99']);
    await f.flush(() => f.get().loadMessages(1));
    assert.deepEqual(ids(f), ['99']);
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? { data: [message(99, 1, role === 'guest' ? 'guest' : 'host', 'instant bubble')] } : oldQuery(q);
    await f.flush(() => f.get().loadMessages(1));
    assert.deepEqual(ids(f), ['99']);
  });
}

test('missing currentUser uses fallback auth before starting POST', async (t) => {
  const f = clientFixture();
  t.after(() => f.dispose());
  f.auth = async () => ({ data: { user: null } });
  await f.mount();
  const fallback = deferred();
  f.auth = () => fallback.promise;
  let send;
  await f.flush(() => { send = f.get().sendMessage(1, 'fallback'); });
  assert.equal(sends(f).length, 0);
  assert.equal(f.calls.auth, 2);
  await f.flush(async () => { fallback.resolve({ data: { user: { id: 'guest' } } }); await send; });
  assert.equal(sends(f).length, 1);
});

test('missing user rejects instead of silently clearing a draft', async (t) => {
  const f = clientFixture(); t.after(() => f.dispose());
  f.auth = async () => ({ data: { user: null } });
  await f.mount();
  await f.flush(() => assert.rejects(f.get().sendMessage(1, 'draft'), /로그인/));
  assert.equal(sends(f).length, 0);
});

test('Realtime canonical row arriving before send ACK is deduplicated and read/deletion state survives', async (t) => {
  const f = await mounted(t);
  await f.flush(() => f.get().loadMessages(1));
  const ack = deferred(), request = f.request;
  f.request = (url, options) => url === '/api/inquiries/message' ? ack.promise : request(url, options);
  let send;
  await f.flush(() => { send = f.get().sendMessage(1, 'draft'); });
  const oldQuery = f.query;
  f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id'
    ? { data: [{ ...message(99, 1, 'guest', 'draft'), is_read: true, read_at: timestamp }] } : oldQuery(q);
  await f.flush(() => f.get().loadMessages(1));
  await f.flush(async () => { ack.resolve(response({ success: true, messageId: 99, updatedAt: timestamp })); await send; });
  assert.deepEqual(ids(f), ['99']);
  assert.equal(f.get().messages[0].is_read, true);
  f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id'
    ? { data: [{ ...message(99, 1, 'guest', 'removed secret'), type: 'deleted' }] } : oldQuery(q);
  await f.flush(() => f.get().loadMessages(1));
  assert.doesNotMatch(f.get().messages[0].content, /removed secret/);
});

test('body renders while sender profile and application are still pending, then metadata enriches', async (t) => {
  const f = await mounted(t);
  const profile = deferred(), app = deferred(), oldQuery = f.query;
  f.query = (q) => q.table === 'public_profiles' ? profile.promise : q.table === 'host_applications' ? app.promise : oldQuery(q);
  let opening;
  await f.flush(() => { opening = f.get().loadMessages(1); });
  assert.deepEqual(ids(f), ['10']);
  assert.match(f.dom.window.document.body.textContent, /body-10/);
  assert.equal(f.get().selectedInquiry.id, 1);
  assert.equal(f.get().messages[0].sender.name, 'Host');
  await f.flush(async () => {
    profile.resolve({ data: [{ id: 'host', full_name: 'Updated profile', avatar_url: '/updated.png' }] });
    app.resolve({ data: [{ user_id: 'host', name: 'Updated public host', profile_photo: '/public.png' }] });
    await opening;
  });
  assert.equal(f.get().messages[0].sender.name, 'Updated profile');
  assert.equal(f.get().messages[0].sender.avatar_url, '/public.png');
});

test('late profiles cannot replace a concurrent optimistic or acknowledged send', async (t) => {
  const f = await mounted(t);
  const profile = deferred(), oldQuery = f.query;
  f.query = (q) => q.table === 'public_profiles' ? profile.promise : oldQuery(q);
  let opening;
  await f.flush(() => { opening = f.get().loadMessages(1); });
  await f.flush(() => f.get().sendMessage(1, 'concurrent send'));
  assert.deepEqual(ids(f), ['10', '99']);
  await f.flush(async () => { profile.resolve({ data: [{ id: 'host', full_name: 'Late profile' }] }); await opening; });
  assert.deepEqual(ids(f), ['10', '99']);
});

test('fast switch ignores old message and profile responses; clearSelected invalidates pending reads', async (t) => {
  const f = await mounted(t);
  const slowMessages = deferred(), oldQuery = f.query;
  f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' && q.filters.some(([, key, value]) => key === 'inquiry_id' && value === 1) ? slowMessages.promise : oldQuery(q);
  let old;
  await f.flush(() => { old = f.get().loadMessages(1); });
  await f.flush(() => f.get().loadMessages(2));
  await f.flush(async () => { slowMessages.resolve({ data: [message(1, 1)] }); await old; });
  assert.equal(f.get().selectedInquiry.id, 2);
  assert.ok(f.get().messages.every((msg) => msg.inquiry_id === 2));
  const slowProfile = deferred();
  f.query = (q) => q.table === 'public_profiles' ? slowProfile.promise : oldQuery(q);
  await f.flush(() => { old = f.get().loadMessages(1); });
  f.query = oldQuery;
  await f.flush(() => f.get().loadMessages(2));
  await f.flush(async () => { slowProfile.resolve({ data: [{ id: 'host', full_name: 'WRONG ROOM' }] }); await old; });
  assert.equal(f.get().selectedInquiry.id, 2);
  assert.notEqual(f.get().messages[0].sender.name, 'WRONG ROOM');
  const closing = deferred();
  f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? closing.promise : oldQuery(q);
  await f.flush(() => { old = f.get().loadMessages(1); });
  await f.flush(() => f.get().clearSelected());
  await f.flush(async () => { closing.resolve({ data: [message(1, 1)] }); await old; });
  assert.equal(f.get().selectedInquiry, null);
  assert.deepEqual(ids(f), []);
});

test('newer refresh wins even in the same room', async (t) => {
  const f = await mounted(t), oldQuery = f.query, slow = deferred();
  let first;
  f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id' ? slow.promise : oldQuery(q);
  await f.flush(() => { first = f.get().loadMessages(1); });
  f.query = oldQuery;
  await f.flush(() => f.get().loadMessages(1));
  await f.flush(async () => { slow.resolve({ data: [message(1, 1, 'host', 'stale')] }); await first; });
  assert.deepEqual(ids(f), ['10']);
});

test('send ACK and failed read from an old room do not change the new selection', async (t) => {
  const f = await mounted(t), request = f.request, read = deferred(), ack = deferred();
  f.request = (url, options) => url === '/api/inquiries/read' && JSON.parse(options.body).inquiryId === 1 ? read.promise
    : url === '/api/inquiries/message' ? ack.promise : request(url, options);
  await f.flush(() => f.get().loadMessages(1));
  let send;
  await f.flush(() => { send = f.get().sendMessage(1, 'old room send'); });
  await f.flush(() => f.get().loadMessages(2));
  await f.flush(async () => {
    read.resolve(response({ success: false }, 500));
    ack.resolve(response({ success: true, messageId: 99, updatedAt: timestamp }));
    await send;
  });
  assert.equal(f.get().selectedInquiry.id, 2);
  assert.ok(f.get().messages.every((msg) => msg.inquiry_id === 2));
  await f.flush(() => f.get().loadMessages(1));
  assert.ok(ids(f).includes('99'));
});

for (const role of ['guest', 'host']) {
for (const type of ['admin_support', 'admin', 'general']) {
  test(`${role} ${type}: official sender stays official before and after profile hydration`, async (t) => {
    const f = await mounted(t, { role, rows: [inquiry(1, type)] }), oldQuery = f.query;
    f.query = (q) => q.table === 'inquiry_messages' && q.columns !== 'inquiry_id'
      ? { data: [message(50, 1, 'admin'), message(51, 1, 'guest')] } : oldQuery(q);
    const before = f.calls.queries.length;
    await f.flush(() => f.get().loadMessages(1));
    const official = f.get().messages[0];
    assert.equal(official.sender.name, 'Locally Support');
    assert.match(official.sender.avatar_url, /locally|logo/i);
    for (const q of f.calls.queries.slice(before).filter((q) => ['public_profiles', 'host_applications'].includes(q.table))) {
      assert.ok(q.filters.every(([, , values]) => !values.includes('admin')));
    }
    assert.equal(f.get().messages[1].sender.name, 'Guest');
  });
}

}

for (const role of ['guest', 'host']) {
  test(`${role} actual composer: immediate bubble, single POST, lock maintained, failure restores draft`, async (t) => {
    const f = clientFixture({ role }); t.after(() => f.dispose());
    f.searchParams.set('inquiryId', '1');
    const Component = f.load(role === 'guest' ? 'app/guest/inbox/page.tsx' : 'app/host/dashboard/InquiryChat.tsx').default;
    await f.mount(Component);
    const textarea = f.dom.window.document.querySelector('textarea');
    assert.ok(textarea, 'actual composer mounted');
    const ack = deferred(), request = f.request;
    f.request = (url, options) => url === '/api/inquiries/message' ? ack.promise : request(url, options);
    await f.flush(() => {
      Object.getOwnPropertyDescriptor(f.dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'restore this draft');
      textarea.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    });
    // Dispatch the actual Enter handler, including the existing UI isSending guard.
    await f.flush(() => textarea.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.equal(textarea.value, '');
    assert.equal(textarea.disabled, true);
    assert.equal(sends(f).length, 1);
    assert.match(f.dom.window.document.body.textContent, /restore this draft/);
    await f.flush(() => textarea.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.equal(sends(f).length, 1);
    await f.flush(() => ack.resolve(response({ success: false, error: 'forced failure' }, 500)));
    assert.equal(textarea.disabled, false);
    assert.equal(textarea.value, 'restore this draft');
    const messageSurface = f.dom.window.document.body.cloneNode(true);
    messageSurface.querySelectorAll('textarea').forEach((element) => element.remove());
    assert.doesNotMatch(messageSurface.textContent, /restore this draft/);
  });
}

for (const view of ['support', 'monitor']) {
test(`admin ${view} hook regression: inbox scope, selection, post-send refresh and stale guard`, async (t) => {
  const f = clientFixture(); t.after(() => f.dispose());
  const useAdminChatQuery = f.load('app/admin/dashboard/hooks/useAdminChatQuery.ts').useAdminChatQuery;
  let state;
  function Probe() { const chat = useAdminChatQuery({ view }); React.useEffect(() => { state = chat; }); return null; }
  await f.mount(Probe);
  assert.ok(f.calls.requests.some(({ url }) => url.includes(`view=${view}`)));
  await f.flush(() => state.selectInquiry(1));
  assert.equal(state.selectedInquiry.id, 1);
  await f.flush(() => state.sendMessage(1, 'admin message'));
  assert.equal(sends(f).length, 1);
  assert.equal(f.calls.requests.filter(({ url }) => url === '/api/admin/inquiries/1/messages').length, 2);
  const slow = deferred(), request = f.request;
  f.request = (url, options) => url === '/api/admin/inquiries/1/messages' ? slow.promise : request(url, options);
  let old;
  await f.flush(() => { old = state.selectInquiry(1); });
  await f.flush(() => state.selectInquiry(2));
  await f.flush(async () => { slow.resolve(response({ success: true, data: [message(77, 1)] })); await old; });
  assert.equal(state.selectedInquiry.id, 2);
  assert.notEqual(state.messages[0].id, 77);
});

}

function serverFixture({ type = 'general', locale = 'ja' } = {}) {
  const notifications = [], emails = [], background = [], queries = [];
  let lookupCount = 0;
  const client = {
    auth: { admin: { getUserById: async () => { lookupCount++; return { data: { user: { user_metadata: { preferred_locale: locale } } } }; } } },
    from: (table) => queryBuilder(table, (state) => {
      queries.push(state);
      if (table === 'inquiries') return { data: state.operation === 'update' ? { updated_at: timestamp } : inquiry(1, type) };
      if (table === 'inquiry_messages') return { data: { id: 99, created_at: timestamp } };
      if (table === 'profiles') return { data: { full_name: 'Guest', email: 'recipient@example.invalid' } };
      if (table === 'host_applications') return { data: { name: 'Public Host' } };
      if (table === 'public_host_applications') return { data: { status: 'approved' } };
      if (table === 'notifications') { notifications.push(state.body); return { error: null }; }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  const stubs = {
    'next/server': { after: (fn) => background.push(fn), NextResponse: { json: (body, init) => response(body, init?.status || 200) } },
    '@/app/utils/supabase/admin': { createAdminClient: () => client, recordAuditLog: async () => {} },
    '@/app/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/app/utils/adminSupportUnreadAlerts': { startOrAdvanceAdminSupportUnreadBatch: async () => {} },
    '@/app/utils/adminAlertCenter': { insertAdminAlerts: async () => {}, sendAdminAlertEmails: async () => {} },
    '@/app/utils/adminAccess': { resolveAdminAccess: async (_, actor) => ({ isAdmin: actor.userId === 'admin', userRole: actor.userId === 'admin' ? 'admin' : null }) },
    '@/app/emails/delivery/sendTemplatedEmail': { sendTemplatedEmail: async (params) => { emails.push(params); return { sent: true }; } },
  };
  return { load: sourceLoader(stubs), client, stubs, notifications, emails, queries, background, lookups: () => lookupCount };
}

for (const locale of ['ko', 'en', 'ja', 'zh']) {
  test(`normal send ${locale}: exactly one locale lookup shared by notification and background email`, async () => {
    const f = serverFixture({ locale });
    const shared = f.load('app/api/inquiries/thread/shared.ts');
    await shared.createInquiryMessage({ actor: { id: 'guest' }, body: { inquiryId: 1, content: 'Hello' } });
    assert.equal(f.lookups(), 1);
    assert.equal(f.notifications.length, 1);
    assert.equal(f.emails.length, 0, 'email remains in after()');
    assert.equal(f.background.length, 1);
    await f.background[0]();
    assert.equal(f.lookups(), 1);
    assert.equal(f.emails[0].locale, locale);
    assert.equal(f.emails[0].transportPolicy, 'transactional');
    const copy = f.load('app/utils/notificationCopy.ts').buildNotificationCopy('inquiry.new_message', locale, { actorDisplayName: 'Guest', displayContent: 'Hello' });
    assert.equal(f.notifications[0].title, copy.title);
    assert.equal(f.emails[0].recipient.userId, 'host');
  });
}

test('official admin support send reuses locale, preserves official sender and host routing', async () => {
  const f = serverFixture({ type: 'admin_support', locale: 'en' });
  await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'admin' }, body: { inquiryId: 1, content: 'Support reply' } });
  assert.equal(f.lookups(), 1);
  await f.background[0]();
  assert.equal(f.emails[0].payload.actorName, 'Locally Support');
  assert.equal(f.emails[0].audience, 'host');
  assert.equal(f.emails[0].locale, 'en');
  assert.equal(f.emails[0].transportPolicy, 'transactional');
});

test('admin recipient keeps Korean ops mail and a single locale lookup for in-app copy', async () => {
  const f = serverFixture({ type: 'admin_support', locale: 'zh' });
  // A stored administrator receives the guest follow-up.
  const from = f.client.from;
  f.client.from = (table) => table === 'inquiries' ? queryBuilder(table, (q) => ({ data: q.operation === 'update' ? { updated_at: timestamp } : { ...inquiry(1, 'admin_support'), host_id: 'admin' } })) : from(table);
  // Role resolver uses recipientId from the stored support room.
  await f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'guest' }, body: { inquiryId: 1, content: 'Support question' } });
  assert.equal(f.lookups(), 1);
  await f.background[0]();
  assert.equal(f.emails[0].locale, 'ko');
  assert.equal(f.emails[0].audience, 'admin');
  assert.equal(f.emails[0].transportPolicy, 'opsAdmin');
});

test('standalone email helper keeps fallback lookup; provided locale skips it', async () => {
  const f = serverFixture({ locale: 'ja' });
  const shared = f.load('app/api/inquiries/thread/shared.ts');
  const params = { supabaseAdmin: f.client, recipientId: 'host', emailTitle: 'title', emailMessage: 'Hello', actorDisplayName: 'Sora', displayContent: 'Hello', localizeEmailForRecipient: true };
  const fallback = await shared.resolveInquiryNotificationEmailCopy(params);
  assert.equal(f.lookups(), 1);
  assert.equal(fallback.subject, '[Locally] Soraさんから新しいメッセージが届きました');
  assert.deepEqual(await shared.resolveInquiryNotificationEmailCopy({ ...params, recipientLocale: 'ja' }), fallback);
  assert.equal(f.lookups(), 1);
});

test('server route still rejects unauthenticated and non-participant users before writes', async () => {
  const f = serverFixture();
  const result = await f.load('app/api/inquiries/message/route.ts').POST({ json: async () => ({ inquiryId: 1, content: 'test' }) });
  assert.equal(result.status, 401);
  await assert.rejects(f.load('app/api/inquiries/thread/shared.ts').createInquiryMessage({ actor: { id: 'intruder' }, body: { inquiryId: 1, content: 'test' } }), (error) => error.status === 403);
  assert.ok(f.queries.every((query) => query.operation === 'select'));
  assert.equal(f.lookups(), 0);
});
