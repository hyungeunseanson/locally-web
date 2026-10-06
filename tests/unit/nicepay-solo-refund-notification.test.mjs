import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
before(() => {
  process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
  process.env.NICEPAY_MID = 'nictest00m';
  process.env.NICEPAY_MERCHANT_KEY = 'synthetic-unit-merchant-key';
  globalThis.fetch = async () => { throw new Error('Network is forbidden in ACK tests'); };
});
after(() => {
  for (const key of ['CARD_PAYMENT_PROVIDER', 'NICEPAY_MID', 'NICEPAY_MERCHANT_KEY']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
});

// Execute actual TS modules with explicit I/O boundaries. Unknown imports fail
// closed, so this suite never creates a real database client or payment request.
function loadSource(stubs) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const sourceModule = { exports: {} };
    cache.set(filename, sourceModule);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (['crypto', 'next/server'].includes(name)) return require(name);
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(filename), name);
        const target = [base, `${base}.ts`].find(existsSync);
        if (target) return load(target);
      }
      throw new Error(`Unmocked import ${name} in ${filename}`);
    };
    new Script(`(function(require,module,exports){${code}\n})`, { filename })
      .runInThisContext()(localRequire, sourceModule, sourceModule.exports);
    return sourceModule.exports;
  }
  return load;
}

const booking = {
  id: 'ORD-SYNTHETIC-SOLO', order_id: 'ORD-SYNTHETIC-SOLO', tid: 'SYNTHETIC-ORIGINAL-TID',
  status: 'completed', payment_method: 'card', amount: 79800, refund_amount: 38000,
  solo_guarantee_refund_status: 'refunded',
};
const operation = {
  booking_id: booking.id, provider: 'nicepay', payment_method: 'card',
  merchant_reference: 'nictest00m',
  transaction_reference: booking.tid, order_reference: 'solo-synthetic-attempt',
  requested_amount: 38000, outcome: 'accepted', settlement_applied_at: '2026-10-06T00:00:00Z',
};
const payload = {
  MOID: booking.order_id, TID: booking.tid, CancelMOID: operation.order_reference, MID: 'nictest00m',
  Amt: '38000', StateCd: '2', ResultCode: '2001', PayMethod: 'CARD',
};

function request(fields = payload, json = false) {
  return new Request('https://unit.invalid/api/payment/card-notification', {
    method: 'POST', headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
    body: json ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
  });
}

function fixture({ rows = { bookings: [booking], booking_solo_refund_operations: [operation] }, evidenceError = false } = {}) {
  const calls = { reads: [], writes: [], confirmations: [] };
  const forbidden = (name) => {
    calls.writes.push(name);
    throw new Error(`Forbidden mutation: ${name}`);
  };
  const db = {
    rpc: () => forbidden('rpc'),
    from(table) {
      assert.ok(Object.hasOwn(rows, table), `Unexpected table ${table}`);
      const state = { table, filters: [], columns: null };
      const q = {
        select(columns) { state.columns = columns; return q; },
        eq(key, value) { state.filters.push([key, value]); return q; },
        insert: () => forbidden('insert'), update: () => forbidden('update'),
        delete: () => forbidden('delete'), upsert: () => forbidden('upsert'),
        async maybeSingle() {
          calls.reads.push(structuredClone(state));
          if (table === 'booking_solo_refund_operations' && evidenceError) {
            return { data: null, error: { message: 'synthetic lookup failure' } };
          }
          const matches = rows[table].filter(row => state.filters.every(([key, value]) => row[key] === value));
          assert.ok(matches.length <= 1, 'fixture should not silently select ambiguous evidence');
          return { data: matches.length ? structuredClone(matches[0]) : null, error: null };
        },
      };
      return q;
    },
  };
  const finalize = domain => async (params) => {
    calls.confirmations.push({ domain, params });
    return { success: true };
  };
  const load = loadSource({
    '@/app/utils/supabase/admin': { createAdminClient: () => db },
    '@/app/utils/portone/server': {
      getPortOnePayment: () => forbidden('PortOne request'), isPortOneCardReady: () => false,
    },
    '@/app/api/payment/experienceCardConfirmation': { finalizeExperienceCardPayment: finalize('experience') },
    '@/app/api/services/payment/serviceCardConfirmation': { finalizeServiceCardPayment: finalize('service') },
    '@/app/api/proxy-bookings/payment/proxyCardConfirmation': { finalizeProxyCardPayment: finalize('proxy') },
  });
  const handler = load('app/api/payment/cardNotificationHandler.ts');
  return {
    calls, rows, handler,
    parse: load('app/utils/payments/card/server.ts').readCardPaymentNotificationRequest,
    post: load('app/api/payment/card-notification/route.ts').POST,
  };
}

function assertReadOnly(f) {
  assert.deepEqual(f.calls.writes, []);
  assert.deepEqual(f.calls.confirmations, []);
  assert.ok(f.calls.reads.every(q => ['bookings', 'service_bookings', 'proxy_requests', 'booking_solo_refund_operations'].includes(q.table)));
}
async function assertOk(response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), 'OK');
}

for (const json of [false, true]) {
  test(`parser preserves original MOID and distinct CancelMOID (${json ? 'JSON' : 'form'})`, async () => {
    const f = fixture();
    const parsed = await f.parse(request(payload, json));
    assert.equal(parsed.originalOrderId, booking.order_id);
    assert.equal(parsed.orderId, booking.order_id);
    assert.equal(parsed.cancelOrderId, operation.order_reference);
    assert.equal(parsed.payload.CancelMOID, operation.order_reference);
    assert.equal(parsed.providerTransactionId, booking.tid);
    const withoutCancel = { ...payload }; delete withoutCancel.CancelMOID;
    assert.equal((await f.parse(request(withoutCancel, json))).cancelOrderId, null);
  });
}

test('completed + matching applied Solo operation returns exact 200 OK without financial writes', async () => {
  const f = fixture();
  await assertOk(await f.post(request()));
  assertReadOnly(f);
  assert.deepEqual(f.calls.reads.map(q => [q.table, q.filters]), [
    ['bookings', [['order_id', booking.order_id]]],
    ['booking_solo_refund_operations', [['booking_id', booking.id]]],
  ]);
});

test('duplicate post-cancel notifications are read-only and idempotently return OK', async () => {
  const f = fixture(); const before = structuredClone(f.rows);
  for (let i = 0; i < 3; i++) await assertOk(await f.post(request()));
  assert.deepEqual(f.rows, before);
  assertReadOnly(f);
  assert.equal(f.calls.reads.filter(q => q.table === 'booking_solo_refund_operations').length, 3);
});

for (const json of [false, true]) {
  test(`distinct post-cancel TID is not compared to the stored original payment TID (${json ? 'JSON' : 'form'})`, async () => {
    const f = fixture(); const before = structuredClone(f.rows);
    const fields = { ...payload, TID: 'DISTINCT-CANCELLATION-TID' };
    assert.notEqual(fields.TID, booking.tid);
    assert.equal(operation.transaction_reference, booking.tid);
    for (let i = 0; i < 2; i++) await assertOk(await f.post(request(fields, json)));
    assert.deepEqual(f.rows, before);
    assertReadOnly(f);
    assert.equal(f.calls.reads.filter(q => q.table === 'booking_solo_refund_operations').length, 2);
  });
}

test('unconfigured MID never acknowledges a Solo refund', async () => {
  const savedMid = process.env.NICEPAY_MID;
  delete process.env.NICEPAY_MID;
  try {
    const f = fixture();
    const response = await f.post(request());
    assert.equal(response.status, 409);
    assertReadOnly(f);
  } finally { process.env.NICEPAY_MID = savedMid; }
});

test('distinct cancellation TID never repairs an unknown, unapplied provider outcome', async () => {
  const f = fixture({ rows: {
    bookings: [{ ...booking, refund_amount: 0, solo_guarantee_refund_amount: 0, solo_guarantee_refund_status: 'unknown' }],
    booking_solo_refund_operations: [{ ...operation, outcome: 'unknown', settlement_applied_at: null }],
  } });
  const before = structuredClone(f.rows);
  const response = await f.post(request({ ...payload, TID: 'DISTINCT-CANCELLATION-TID' }));
  assert.equal(response.status, 409);
  assert.deepEqual(f.rows, before);
  assertReadOnly(f);
});

const rejected = [
  ['notification amount mismatch', { fields: { Amt: '37999' } }],
  ['notification MID mismatch', { fields: { MID: 'OTHER-MID' } }],
  ['missing notification MID', { omit: 'MID' }],
  ['operation MID mismatch', { op: { merchant_reference: 'OTHER-MID' } }],
  ['missing operation MID', { op: { merchant_reference: null } }],
  ['CancelMOID mismatch', { fields: { CancelMOID: 'solo-another-attempt' } }],
  ['missing CancelMOID', { omit: 'CancelMOID' }],
  ['settlement unapplied', { op: { settlement_applied_at: null } }],
  ['unaccepted operation', { op: { outcome: 'unknown' } }],
  ['operation TID differs from booking', { op: { transaction_reference: 'OTHER-APPROVAL-TID' } }],
  ['operation booking differs', { op: { booking_id: 'ORD-OTHER-BOOKING' } }],
  ['operation requested amount differs', { op: { requested_amount: 1000 } }],
  ['operation provider differs', { op: { provider: 'portone' } }],
  ['operation payment method differs', { op: { payment_method: 'bank' } }],
  ['booking solo refund not refunded', { row: { solo_guarantee_refund_status: 'accepted' } }],
  ['missing operation despite matching aggregate refund_amount', { missingOperation: true }],
  ['booking payment method differs', { row: { payment_method: 'bank' } }],
  ['non-CARD notification', { fields: { PayMethod: 'VBANK' } }],
  ['missing official original MOID with generic orderId', { fields: { orderId: booking.order_id }, omit: 'MOID' }],
  ['wrong original MOID masked by generic orderId', { fields: { orderId: booking.order_id, MOID: 'WRONG-ORIGINAL-MOID' } }],
  ['wrong official Amt masked by generic amount', { fields: { Amt: '37999', amount: '38000' } }],
  ['zero notification amount', { fields: { Amt: '0' } }],
];
for (const [name, change] of rejected) {
  test(`completed Solo refund rejects ${name}`, async () => {
    const fields = { ...payload, ...change.fields };
    if (change.omit) delete fields[change.omit];
    const f = fixture({ rows: {
      bookings: [{ ...booking, ...change.row }],
      booking_solo_refund_operations: change.missingOperation ? [] : [{ ...operation, ...change.op }],
    } });
    const response = await f.post(request(fields));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).success, false);
    assertReadOnly(f);
  });
}

test('operation evidence lookup failure never acknowledges or reapplies settlement', async () => {
  const f = fixture({ evidenceError: true });
  const response = await f.post(request());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).success, false);
  assertReadOnly(f);
});

for (const domain of [
  { name: 'experience', table: 'bookings', order: 'order_id', status: 'cancelled', id: 'ORD-SYNTHETIC-CANCELLED' },
  { name: 'service', table: 'service_bookings', order: 'order_id', status: 'cancelled', id: 'SVC-SYNTHETIC-CANCELLED' },
  { name: 'proxy', table: 'proxy_requests', order: 'locally_order_id', status: 'REFUNDED', id: 'LOCALLY-PROXY-SYNTHETIC-CANCELLED' },
]) {
  test(`${domain.name} ordinary cancelled booking retains existing ACK with a distinct cancellation TID`, async () => {
    const row = { id: domain.id, [domain.order]: domain.id, status: domain.status, payment_status: domain.status,
      payment_channel: 'LOCALLY', category: 'RESTAURANT', refund_amount: 4500, tid: 'STORED-APPROVAL-TID' };
    const f = fixture({ rows: { [domain.table]: [row] } });
    const fields = { MOID: domain.id, TID: 'DISTINCT-CANCELLATION-TID', Amt: '4500', PayMethod: 'CARD', StateCd: '2' };
    for (let i = 0; i < 2; i++) await assertOk(await f.post(request(fields)));
    assertReadOnly(f);
    assert.ok(f.calls.reads.every(q => q.table === domain.table));
  });
}

for (const domain of [
  { name: 'experience', table: 'bookings', order: 'order_id', id: 'ORD-SYNTHETIC-APPROVAL', amount: 79800 },
  { name: 'service', table: 'service_bookings', order: 'order_id', id: 'SVC-SYNTHETIC-APPROVAL', amount: 79800 },
  { name: 'proxy', table: 'proxy_requests', order: 'locally_order_id', id: 'LOCALLY-PROXY-SYNTHETIC-APPROVAL', amount: 4500 },
]) {
  test(`${domain.name} approval still verifies provider status and calls its existing finalizer`, async (t) => {
    const f = fixture({ rows: { [domain.table]: [{ id: domain.id, [domain.order]: domain.id, status: 'PENDING',
      payment_status: 'PENDING', payment_method: 'card', payment_channel: 'LOCALLY', category: 'RESTAURANT', amount: domain.amount }] } });
    const inquiries = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(String(url), 'https://webapi.nicepay.co.kr/webapi/inquery/trans_status.jsp');
      inquiries.push(new URLSearchParams(options.body));
      return Response.json({ ResultCode: '0000', Status: '0' });
    });
    await assertOk(await f.post(request({ MOID: domain.id, TID: 'SYNTHETIC-APPROVAL-TID',
      Amt: String(domain.amount), PayMethod: 'CARD', StateCd: '0', ResultCode: '3001' })));
    assert.equal(inquiries.length, 1);
    assert.equal(inquiries[0].get('TID'), 'SYNTHETIC-APPROVAL-TID');
    assert.deepEqual(f.calls.confirmations.map(c => c.domain), [domain.name]);
    assert.deepEqual(f.calls.writes, []);
    assert.ok(f.calls.reads.every(q => q.table === domain.table));
  });
}
