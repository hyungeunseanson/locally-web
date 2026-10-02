import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import React from 'react';
import { clientFixture, inquiry, message, response, deferred } from './helpers/chatRuntime.mjs';

const hookPath = 'app/admin/dashboard/hooks/useAdminChatQuery.ts';
const baselineSha = '6cda01f3f423d626e32a6d62904506e135f85334';
const baseline = { [resolve(hookPath)]: execFileSync('git', ['show', `${baselineSha}:${hookPath}`], { encoding: 'utf8' }) };

async function phoneFixture(t, sources = {}, { mode = 'phone', authGate } = {}) {
  let useAdmin, state, selectPhone;
  const metrics = { gets: 0, active: 0, maxActive: 0, commits: 0, messageCommits: 0 };
  const pending = [];
  const f = clientFixture({ sources, rows: [inquiry(1, mode === 'monitor' ? 'general' : 'admin_support'), inquiry(2, mode === 'monitor' ? 'general' : 'admin_support')], additionalStubs: {
    '../hooks/useAdminChatQuery': { useAdminChatQuery: options => { const chat = useAdmin(options); React.useEffect(() => { state = chat; }); return chat; } },
    '@/app/components/ui/ConfirmModal': { default: () => null },
    '@/app/admin/dashboard/components/ChatParticipantProfileModal': { default: () => null },
  } });
  t.after(() => f.dispose());
  f.auth = async () => { if (authGate) await authGate.promise; return { data: { user: { id: 'admin' } } }; };
  useAdmin = f.load(hookPath).useAdminChatQuery;
  const ChatMonitor = f.load('app/admin/dashboard/components/ChatMonitor.tsx').default;
  const original = f.request;
  f.request = async (url, options) => {
    if (!url.endsWith('/messages')) return original(url, options);
    metrics.gets++; metrics.maxActive = Math.max(metrics.maxActive, ++metrics.active);
    const gate = deferred(); pending.push({ ...gate, id: Number(url.split('/')[4]), signal: options.signal });
    const aborted = () => gate.reject(options.signal.reason);
    options.signal.addEventListener('abort', aborted, { once: true });
    try { return await gate.promise; } finally {
      options.signal.removeEventListener('abort', aborted); metrics.active--;
    }
  };
  function Phone() {
    const [id, setId] = React.useState(null);
    React.useEffect(() => { selectPhone = setId; }, []);
    return React.createElement(React.Profiler, { id: 'phone', onRender: () => {
      metrics.commits++;
      if (f.dom.window.document.querySelector('[data-testid="admin-chat-message-list"]')?.textContent.includes('phone-message-')) metrics.messageCommits++;
    } }, React.createElement(ChatMonitor, mode === 'phone' ? { phoneContext: { inquiryId: id, toolbar: '전화예약', onSent() {} } } : { view: mode }));
  }
  await f.mount(Phone);
  metrics.commits = 0;
  return Object.assign(f, { admin: () => state, pending, metrics,
    select: id => f.flush(() => {
      if (mode === 'phone') selectPhone(id == null ? null : String(id));
      else f.dom.window.document.querySelector(`[data-testid="admin-chat-inquiry-row-${id}"]`).dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true }));
    }),
    finish: (index, rows = [message(10 + index, pending[index].id, 'guest', `phone-message-${index}`)]) => f.flush(() => pending[index].resolve(response({ success: true, data: rows, inquiry: f.rows.find(row => row.id === pending[index].id) }))),
  });
}

const trigger = (f, event) => f.flush(() => {
  if (event === 'SUBSCRIBED') f.calls.channels.at(-1).status(event);
  else if (event === 'visibilitychange') f.dom.window.document.dispatchEvent(new f.dom.window.Event(event));
  else f.dom.window.dispatchEvent(new f.dom.window.Event(event));
});
const loading = f => Boolean(f.dom.window.document.querySelector('[data-testid="admin-chat-messages-loading"]'));

for (const event of ['SUBSCRIBED', 'visibilitychange', 'online']) {
  test(`phone selection pending + ${event}: renders messages and releases initial loading`, async t => {
    const f = await phoneFixture(t);
    await f.select(1);
    assert.equal(loading(f), true);
    await trigger(f, event);
    await f.finish(0);
    // A catch-up may revalidate the snapshot, but cannot hold initial rendering hostage.
    assert.equal(f.admin().isMessagesLoading, false);
    assert.equal(loading(f), false);
    assert.match(f.dom.window.document.body.textContent, /phone-message-0/);
    for (let i = 1; i < f.pending.length; i++) await f.finish(i);
    assert.equal(f.metrics.maxActive, 1);
  });
}

for (const burst of [false, true]) test(`same phone-selection fixture (${burst ? 'burst' : 'single catch-up'}) records baseline and fixed GET/concurrency/React commit counts`, async t => {
  for (const [label, sources] of [['before', baseline], ['after', {}]]) {
    const f = await phoneFixture({ after() {} }, sources);
    try {
      await f.select(1);
      await trigger(f, 'SUBSCRIBED');
      if (burst) await f.flush(() => { for (let i = 0; i < 5; i++) void f.admin().loadMessages(1); });
      await f.finish(0);
      const initialVisible = !loading(f);
      for (let i = 1; i < f.pending.length; i++) await f.finish(i);
      t.diagnostic(JSON.stringify({ label, burst, ...f.metrics, loading: loading(f), initialVisible }));
      if (label === 'before') {
        assert.equal(loading(f), true, 'baseline reproduces orphaned spinner');
        assert.equal(f.metrics.gets, burst ? 7 : 2);
        assert.equal(f.metrics.maxActive, burst ? 7 : 2);
      } else {
        assert.equal(loading(f), false); assert.equal(f.metrics.maxActive, 1);
        assert.equal(f.metrics.gets, 2);
        assert.ok(f.metrics.commits <= 6, 'bounded React commits per selection');
      }
    } finally { await f.dispose(); }
  }
});

for (const mode of ['support', 'monitor']) {
  test(`${mode}: normal selection with overlapping catch-up renders the selected messages`, async t => {
    const f = await phoneFixture(t, {}, { mode });
    await f.select(1); await trigger(f, 'SUBSCRIBED');
    await f.finish(0);
    assert.equal(loading(f), false);
    assert.match(f.dom.window.document.body.textContent, /phone-message-0/);
    await f.finish(1);
    assert.equal(f.metrics.maxActive, 1);
  });
}

test('phone burst coalesces SUBSCRIBED/visibility/online and direct refreshes; trailing GET recovers a later message', async t => {
  const f = await phoneFixture(t);
  await f.select(1);
  await f.flush(() => {
    for (let i = 0; i < 5; i++) {
      f.calls.channels.at(-1).status('SUBSCRIBED');
      f.dom.window.dispatchEvent(new f.dom.window.Event('online'));
      f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange'));
      void f.admin().loadMessages(1);
    }
  });
  assert.equal(f.metrics.gets, 1);
  await f.finish(0);
  assert.equal(loading(f), false);
  assert.equal(f.metrics.gets, 2);
  await f.finish(1, [message(11, 1, 'guest', 'arrived-after-initial-snapshot')]);
  assert.equal(f.metrics.gets, 2); assert.equal(f.metrics.maxActive, 1);
  assert.match(f.dom.window.document.body.textContent, /arrived-after-initial-snapshot/);
});

for (const returnToA of [false, true]) {
  test(`rapid A -> B${returnToA ? ' -> A' : ''} never accepts an older selection response or loading completion`, async t => {
    const f = await phoneFixture(t);
    await f.select(1); await trigger(f, 'SUBSCRIBED');
    await f.select(2);
    if (returnToA) await f.select(1);
    await f.finish(0);
    assert.equal(loading(f), true);
    assert.doesNotMatch(f.dom.window.document.body.textContent, /phone-message-0/);
    await f.finish(1);
    if (returnToA) {
      assert.equal(loading(f), true);
      assert.doesNotMatch(f.dom.window.document.body.textContent, /phone-message-1/);
      await f.finish(2);
    }
    assert.equal(loading(f), false);
    assert.equal(String(f.admin().selectedInquiry.id), returnToA ? '1' : '2');
    assert.match(f.dom.window.document.body.textContent, new RegExp(`phone-message-${returnToA ? 2 : 1}`));
  });
}

for (const kind of ['http', 'network', 'timeout']) {
  test(`initial GET ${kind} + catch-up ends spinner, shows retry and recovers`, async t => {
    const originalTimeout = AbortSignal.timeout;
    if (kind === 'timeout') {
      AbortSignal.timeout = ms => {
        assert.equal(ms, 15_000);
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('Fixture timeout', 'TimeoutError')), ms);
        return controller.signal;
      };
      t.after(() => { AbortSignal.timeout = originalTimeout; });
    }
    const f = await phoneFixture(t);
    await f.select(1); await trigger(f, 'SUBSCRIBED');
    const fail = async index => {
      if (kind === 'timeout') await f.advanceTimers(15_000);
      else await f.flush(() => kind === 'http'
        ? f.pending[index].resolve(response({ success: false, error: 'fixture failure' }, 500))
        : f.pending[index].reject(new TypeError('fixture network failure')));
    };
    await fail(0);
    assert.equal(loading(f), false);
    assert.ok(f.dom.window.document.querySelector('[data-testid="admin-chat-messages-error"]'));
    await fail(1);
    const retry = [...f.dom.window.document.querySelectorAll('button')].find(el => el.textContent === '다시 시도');
    assert.ok(retry);
    await f.flush(() => retry.dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal(loading(f), true);
    await f.finish(2);
    assert.equal(loading(f), false);
    assert.equal(f.admin().messageError, undefined);
    assert.match(f.dom.window.document.body.textContent, /phone-message-2/);
  });
}

for (const success of [true, false]) {
  test(`pending admin ACK then ${success ? 'success' : 'failure'} cannot hold message loading`, async t => {
    const f = await phoneFixture(t);
    f.rows[0].admin_unread_count = 1;
    const ack = deferred(), request = f.request;
    f.request = (url, options) => url.endsWith('/ack') ? ack.promise : request(url, options);
    await f.select(1); await trigger(f, 'SUBSCRIBED');
    await f.finish(0);
    assert.equal(loading(f), false);
    assert.match(f.dom.window.document.body.textContent, /phone-message-0/);
    await f.finish(1, [message(10, 1, 'guest', 'phone-message-0')]);
    assert.equal(f.calls.requests.filter(r => r.url.endsWith('/ack')).length, 1);
    await f.flush(() => ack.resolve(response({ success }, success ? 200 : 500)));
    assert.equal(loading(f), false);
    assert.equal(f.calls.requests.some(r => r.url === '/api/inquiries/read'), false);
  });
}

test('auth resolution and subscription effect restart cannot invalidate a pending phone GET', async t => {
  const authGate = deferred();
  const f = await phoneFixture(t, {}, { authGate });
  await f.select(1);
  assert.equal(f.calls.channels.length, 0);
  await f.flush(() => authGate.resolve());
  await trigger(f, 'SUBSCRIBED');
  await f.finish(0);
  assert.equal(loading(f), false);
  assert.match(f.dom.window.document.body.textContent, /phone-message-0/);
  await f.finish(1);
});

test('B finishes before A: stale A success cannot overwrite B messages or selection', async t => {
  const f = await phoneFixture(t);
  await f.select(1); await trigger(f, 'SUBSCRIBED'); await f.select(2);
  await f.finish(1);
  assert.equal(loading(f), false);
  await f.finish(0);
  assert.equal(String(f.admin().selectedInquiry.id), '2');
  assert.match(f.dom.window.document.body.textContent, /phone-message-1/);
  assert.doesNotMatch(f.dom.window.document.body.textContent, /phone-message-0/);
  assert.equal(f.metrics.gets, 2, 'abandoned A does not run its queued refresh');
});

test('deselecting a pending phone conversation invalidates its response and queued catch-up', async t => {
  const f = await phoneFixture(t);
  await f.select(1); await trigger(f, 'SUBSCRIBED'); await f.select(null);
  await f.finish(0);
  assert.equal(f.admin().selectedInquiry, null);
  assert.equal(f.admin().isMessagesLoading, false);
  assert.deepEqual(f.admin().messages, []);
  assert.equal(f.metrics.gets, 1);
});
