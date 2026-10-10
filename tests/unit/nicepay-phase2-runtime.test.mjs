import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'locally-nicepay-runtime-'));
const outfile = join(dir, 'runtime.cjs');
const require = createRequire(import.meta.url);
const clock = Date.parse('2026-10-11T00:20:00Z');
const state = { provider: 'missing', finalizerFails: false, finalizeCalls: [], alerts: [] };
globalThis.__phase2Runtime = state;
try {
  await build({
    entryPoints: ['app/utils/payments/card/nicepayRecovery.ts'], outfile,
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'tsconfig.json',
    plugins: [{ name: 'all-external-effects-mocked', setup(api) {
      api.onResolve({ filter: /adminAlertCenter|(^\.\/server$)|experienceCardConfirmation/ }, args => ({ path: args.path, namespace: 'mock' }));
      api.onLoad({ filter: /adminAlertCenter/, namespace: 'mock' }, () => ({ contents: `
        export async function insertAdminAlerts(params){globalThis.__phase2Runtime.alerts.push(params);}
        export async function sendAdminAlertEmails(){};` }));
      api.onLoad({ filter: /(^\.\/server$)/, namespace: 'mock' }, () => ({ contents: `
        export function getNicePayRuntimeConfig(){return {mid:'testmid00m',merchantKey:'mock-only'};}
        export async function queryNicePayPaymentState(){const s=globalThis.__phase2Runtime.provider;if(s instanceof Error)throw s;return s;}` }));
      api.onLoad({ filter: /experienceCardConfirmation/, namespace: 'mock' }, () => ({ contents: `
        export async function finalizeExperienceCardPayment(params){
          globalThis.__phase2Runtime.finalizeCalls.push(params);
          if(globalThis.__phase2Runtime.finalizerFails) throw Error('synthetic DB outage');
          return {success:true};
        }` }));
    } }],
  });
  const runtime = require(outfile);
  const rows = new Map(); const bookings = new Map(); const rpcCalls = [];
  const row = (id, partial = {}) => ({ booking_id: id, order_id: id, mid: 'testmid00m',
    amount: 110000, tid: null, state: 'claimed',
    created_at: new Date(clock - 10 * 60_000).toISOString(),
    auth_received_at: null, interrupted_at: null, next_retry_at: null,
    alerted_at: null, retry_count: 0, ...partial });
  function add(id, partial) {
    rows.set(id, row(id, partial));
    bookings.set(id, { id, order_id: id, amount: 110000,
      payment_provider: 'nicepay', payment_provider_reference: id,
      status: 'PENDING', payment_claim_state: 'processing' });
  }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.updates = null; }
    select() { return this; }
    eq(k, v) { this.filters.push(x => x[k] === v); return this; }
    is(k, v) { this.filters.push(x => x[k] === v); return this; }
    in(k, values) { this.filters.push(x => values.includes(x[k])); return this; }
    order() { return this; }
    limit(n) { this.n = n; return this; }
    update(values) { this.updates = values; return this; }
    async maybeSingle() { const { data, error } = await this.result(); return { data: data[0] || null, error }; }
    then(resolve, reject) { return this.result().then(resolve, reject); }
    async result() {
      const source = this.table === 'bookings' ? bookings : rows;
      const values = [...source.values()].filter(x => this.filters.every(f => f(x))).slice(0, this.n || Infinity);
      if (this.updates) values.forEach(x => Object.assign(x, this.updates));
      return { data: values, error: null };
    }
  }
  const client = {
    from: table => new Query(table),
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === 'list_due_experience_nicepay_recovery') {
        const now = Date.parse(args.p_now);
        const due = [...rows.values()].filter(item =>
          item.state === 'manual_review' ? !item.alerted_at :
          ['claimed', 'auth_received', 'approval_started', 'approved'].includes(item.state) &&
          (item.next_retry_at ? Date.parse(item.next_retry_at) <= now :
            Boolean(item.interrupted_at) ||
            Date.parse(item.state === 'auth_received' ? item.auth_received_at || item.created_at : item.created_at) <= now - 5 * 60_000));
        due.sort((a, b) => Number(a.state === 'manual_review') - Number(b.state === 'manual_review') ||
          Date.parse(a.next_retry_at || a.auth_received_at || a.created_at) -
          Date.parse(b.next_retry_at || b.auth_received_at || b.created_at));
        return { data: due.slice(0, args.p_limit).map(item => ({ booking_id: item.booking_id })), error: null };
      }
      const item = rows.get(args.p_booking_id);
      if (name === 'release_experience_nicepay_hold_atomic') {
        if (item.state === 'released') return { data: 'already_released', error: null };
        if (item.state === 'approval_started' && args.p_provider_status !== 'cancelled') {
          return { data: null, error: { message: 'unsafe' } };
        }
        item.state = 'released'; bookings.get(args.p_booking_id).status = 'cancelled';
        return { data: 'released', error: null };
      }
      if (name === 'note_experience_nicepay_recovery_atomic') {
        item.retry_count++;
        item.state = args.p_manual || item.retry_count >= 5 ? 'manual_review' : item.state;
        return { data: item.state === 'manual_review' ? 'manual_review' : 'retry', error: null };
      }
      if (name === 'interrupt_experience_nicepay_attempt_atomic') {
        item.interrupted_at = new Date(clock).toISOString();
        return { data: item.state, error: null };
      }
      throw new Error(`unexpected RPC: ${name}`);
    },
  };
  add('ORD-CLOSE');
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-CLOSE', now: clock }), 'released');
  console.log('PASS window closed without auth releases through server gate');

  add('ORD-TIMEOUT', { state: 'auth_received', tid: 'TID-TIMEOUT', auth_received_at: new Date(clock - 5 * 60_000).toISOString() });
  state.provider = 'missing';
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-TIMEOUT', now: clock }), 'released');
  console.log('PASS five minute timeout releases only after provider absence');

  add('ORD-AUTH-OPEN', { state: 'auth_received', tid: 'TID-AUTH-OPEN',
    auth_received_at: new Date(clock - 60_000).toISOString() });
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-AUTH-OPEN', now: clock }), 'pending');
  assert.equal(rows.get('ORD-AUTH-OPEN').state, 'auth_received');
  console.log('PASS open authentication stays held before interruption or timeout');

  add('ORD-STARTED', { state: 'approval_started', tid: 'TID-STARTED' });
  state.provider = 'missing';
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-STARTED', now: clock }), 'pending');
  assert.equal(rows.get('ORD-STARTED').state, 'approval_started');
  state.provider = new Error('network loss');
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-STARTED', now: clock }), 'pending');
  assert.equal(rows.get('ORD-STARTED').state, 'approval_started');
  console.log('PASS active approval and network uncertainty keep seat held');

  add('ORD-DBFAIL', { state: 'approved', tid: 'TID-DBFAIL' });
  state.provider = 'approved'; state.finalizerFails = true;
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-DBFAIL', now: clock }), 'pending');
  state.finalizerFails = false;
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-DBFAIL', now: clock }), 'confirmed');
  assert.equal(state.finalizeCalls.filter(x => x.originalBooking.id === 'ORD-DBFAIL').length, 2);
  console.log('PASS provider-approved DB failure safely retries and confirms');

  add('ORD-RESTART', { state: 'approval_started', tid: 'TID-RESTART' });
  rows.get('ORD-RESTART').next_retry_at = new Date(clock - 1).toISOString();
  state.provider = 'approved';
  const batch = await runtime.runNicePayRecoveryBatch({ client, now: clock });
  assert.ok(batch.confirmed >= 1);
  console.log('PASS server-side scheduled replay confirms persisted approval intent');

  for (let i = 0; i < 160; i++) add(`ORD-OLD-ALERT-${i}`, {
    state: 'manual_review', alerted_at: new Date(clock - 60_000).toISOString(),
    created_at: new Date(clock - 24 * 60 * 60_000).toISOString(),
  });
  for (let i = 0; i < 10; i++) add(`ORD-OLD-NOT-DUE-${i}`, {
    state: 'approval_started', tid: `TID-NOT-DUE-${i}`,
    next_retry_at: new Date(clock + 60_000).toISOString(),
    created_at: new Date(clock - 24 * 60 * 60_000).toISOString(),
  });
  add('ORD-NEW-INCIDENT', { state: 'approved', tid: 'TID-NEW-INCIDENT',
    next_retry_at: new Date(clock - 1000).toISOString() });
  assert.ok((await runtime.runNicePayRecoveryBatch({ client, now: clock })).confirmed >= 1);
  assert.equal(bookings.get('ORD-NEW-INCIDENT').status, 'PENDING');
  assert.ok(state.finalizeCalls.some(x => x.originalBooking.id === 'ORD-NEW-INCIDENT'));
  console.log('PASS 170 stale/not-due rows cannot starve a new approved incident');

  add('ORD-CANCELLED', { state: 'approval_started', tid: 'TID-CANCELLED' });
  state.provider = 'cancelled';
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-CANCELLED', now: clock }), 'released');
  add('ORD-REFUND-SAFE', { state: 'approved', tid: 'TID-REFUND-SAFE' });
  assert.equal(await runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-REFUND-SAFE', now: clock }), 'manual_review');
  assert.equal(rows.get('ORD-REFUND-SAFE').state, 'manual_review');
  assert.ok(!rpcCalls.some(x => /cancel|refund/i.test(x.name)));
  console.log('PASS provider cancellation releases; approved-then-cancelled requires manual review without refund');

  add('ORD-CUSTOMER-CRON');
  const [customer, cron] = await Promise.all([
    runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-CUSTOMER-CRON', now: clock }),
    runtime.recoverNicePayAttempt({ client, bookingId: 'ORD-CUSTOMER-CRON', now: clock }),
  ]);
  assert.deepEqual([customer, cron], ['released', 'already_terminal']);
  console.log('PASS duplicate customer and Cron recovery is idempotent');
} finally {
  delete globalThis.__phase2Runtime;
  await rm(dir, { recursive: true, force: true });
}
