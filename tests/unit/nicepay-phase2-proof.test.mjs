import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'locally-nicepay-proof-'));
const outfile = join(dir, 'server.cjs');
const mid = 'testmid00m'; const key = 'test-merchant-key';
const tid = 'testmid00m01012610110000000001';
const order = 'ORD-PHASE2-PROOF'; const amount = 110000;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const originalFetch = globalThis.fetch;
process.env.NICEPAY_MID = mid;
process.env.NICEPAY_MERCHANT_KEY = key;
function authPayload() {
  const token = 'TEST-AUTH-TOKEN';
  return {
    AuthResultCode: '0000', AuthToken: token, TxTid: tid, MID: mid,
    Moid: order, Amt: String(amount), PayMethod: 'CARD',
    Signature: sha(`${token}${mid}${amount}${key}`),
    NextAppURL: 'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp',
  };
}
try {
  await build({
    entryPoints: ['app/utils/payments/card/server.ts'], outfile,
    bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    tsconfig: 'tsconfig.json',
    plugins: [{ name: 'isolate-finance-providers', setup(api) {
      api.onResolve({ filter: /app\/utils\/portone\/server|targetedCloseoutTargets/ }, args => ({ path: args.path, namespace: 'stub' }));
      api.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents:
        'export function assertNicePayApprovalNotRetired(){}; export function getPortOnePayment(){throw Error("No live provider");}; export function isPortOneCardReady(){return {ready:false};}' }));
    } }],
  });
  const server = require(outfile);
  assert.deepEqual(server.verifyNicePayAuthPayload({ providerPayload: authPayload(), orderId: order, expectedAmount: amount }),
    { tid, mid, orderId: order, amount });
  for (const mutation of [
    { MID: 'wrong' }, { Moid: 'wrong' }, { Amt: '110001' }, { TxTid: '' },
    { Signature: 'wrong' }, { PayMethod: 'BANK' }, { AuthResultCode: '2001' },
  ]) {
    assert.throws(() => server.verifyNicePayAuthPayload({
      providerPayload: { ...authPayload(), ...mutation }, orderId: order, expectedAmount: amount,
    }));
  }
  console.log('PASS signed authentication MID, order, TID, amount and method validation');

  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'POST');
    return new Response(JSON.stringify({
      ResultCode: '3001', TID: tid, MID: mid, Moid: order, Amt: String(amount),
      PayMethod: 'CARD', Signature: sha(`${tid}${mid}${amount}${key}`),
    }), { status: 200 });
  };
  const approval = await server.verifyApprovedCardPayment({
    provider: 'nicepay', approvalId: tid, orderId: order,
    expectedAmount: amount, providerPayload: authPayload(),
  });
  assert.deepEqual([approval.provider, approval.providerTransactionId, approval.approvedAmount], ['nicepay', tid, amount]);
  console.log('PASS approved transaction with strict signed proof');

  for (const mutation of [
    { MID: 'wrong' }, { Moid: 'wrong' }, { Amt: '110001' },
    { TID: 'wrong' }, { Signature: 'wrong' }, { Signature: '' },
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify({
      ResultCode: '3001', TID: tid, MID: mid, Moid: order, Amt: String(amount),
      PayMethod: 'CARD', Signature: sha(`${tid}${mid}${amount}${key}`), ...mutation,
    }), { status: 200 });
    await assert.rejects(server.verifyApprovedCardPayment({
      provider: 'nicepay', approvalId: tid, orderId: order,
      expectedAmount: amount, providerPayload: authPayload(),
    }));
  }
  console.log('PASS mismatched approval proof rejected');

  for (const [status, expected] of [['0', 'approved'], ['1', 'cancelled'], ['9', 'missing']]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ ResultCode: '0000', Status: status, TID: tid }), { status: 200 });
    assert.equal(await server.queryNicePayPaymentState(tid), expected);
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ ResultCode: '0000', Status: '0', TID: 'different' }), { status: 200 });
  await assert.rejects(server.queryNicePayPaymentState(tid));
  globalThis.fetch = async () => { throw new Error('network disconnected'); };
  await assert.rejects(server.queryNicePayPaymentState(tid));
  console.log('PASS provider status and network uncertainty remain distinct');
} finally {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
}
