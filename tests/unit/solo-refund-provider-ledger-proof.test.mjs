import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonicalLedgerJson, LEDGER_BOOKING_FIELDS, prepareLedgerReconciliationProof } from '../../scripts/financial/solo-refund-ledger-proof.mjs';

function proof() {
  return {
    schema_version: 1, evidence_source: 'nicepay_merchant_ledger', provider: 'nicepay', payment_method: 'card',
    operation_id: '11111111-1111-4111-8111-111111111111', booking_id: 'TEST-ORDER',
    attempt_identity: '22222222-2222-4222-8222-222222222222', operation_order_reference: 'solo-test-attempt',
    merchant_id: 'TESTMID', original_transaction_id: 'TESTMID-ORIGINAL', cancellation_transaction_id: 'TESTMID-CANCEL',
    original_amount: 79800, cancel_amount: 38000, remaining_amount: 41800, cancellation_count: 1,
    original_approved_at: '2026-01-01T00:00:00.000Z', cancelled_at: '2026-01-02T00:00:02.000Z',
    captured_at: '2026-01-03T00:00:00.000Z', acquired_on: '2026-01-03',
    transaction_state: '후취소', acquisition_state: '취소매입', query_scope: 'original_order_all_states',
    query_from: '2026-01-01T00:00:00.000Z', query_to: '2026-01-03T23:59:59.000Z',
    provider_export_sha256:'a'.repeat(64),provider_verifier_account: 'test-merchant-admin', verifying_admin_id: '44444444-4444-4444-8444-444444444444',
    booking_snapshot: Object.fromEntries(LEDGER_BOOKING_FIELDS.map(key => [key, null])),
  };
}
test('canonical digest is deterministic, immutable and separate from provider identifiers', () => {
  const evidence = proof();
  const prepared = prepareLedgerReconciliationProof(evidence);
  const reordered = Object.fromEntries(Object.entries(evidence).reverse());
  assert.deepEqual(prepared, prepareLedgerReconciliationProof(reordered));
  assert.match(prepared.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(prepared.proofReference, 'nicepay-ledger:' + prepared.evidenceSha256);
  assert.equal(prepared.mode, 'prepare-only');
  assert.equal(prepared.parameters.p_admin_id, evidence.verifying_admin_id);
  evidence.original_amount = 1;
  assert.equal(prepared.parameters.p_evidence.original_amount, 79800);
});
test('unbound admin, missing fields, extra private fields and fabricated provider codes fail closed', () => {
  for (const change of [p => { p.verifying_admin_id = null; }, p => { delete p.cancelled_at; },
    p => { p.card_number = 'forbidden'; }, p => { p.result_code = '2001'; },
    p => { p.booking_snapshot.contact_name = 'forbidden'; }]) {
    const p = proof(); change(p); assert.throws(() => prepareLedgerReconciliationProof(p));
  }
});
test('money, unique cancellation, timestamps and final ledger state must be exact', () => {
  for (const change of [p => { p.cancel_amount = 38001; }, p => { p.cancellation_count = 2; },
    p => { p.remaining_amount = 0; }, p => { p.transaction_state = '승인'; },
    p => { p.acquisition_state = '미매입'; }, p => { p.cancelled_at = '2026-02-30T00:00:00.000Z'; },
    p => { p.acquired_on = null; }, p => { p.cancelled_at = '2026-01-02T09:00:02+09:00'; },
    p => { p.cancellation_transaction_id = p.original_transaction_id; }]) {
    const p = proof(); change(p); assert.throws(() => prepareLedgerReconciliationProof(p));
  }
});
test('canonicalization forbids ambiguous numbers and unsupported JSON types', () => {
  for (const value of [-0, 0.5, NaN, Infinity, undefined, [], { non_ascii_key: undefined }]) {
    assert.throws(() => canonicalLedgerJson(value));
  }
  assert.equal(canonicalLedgerJson({ z: '후취소', a: { b: 1, a: null } }), '{"a":{"a":null,"b":1},"z":"후취소"}');
});
test('any evidence change has a distinct proof identity', () => {
  const a = proof(), b = proof(); b.captured_at = '2026-01-03T00:00:01.000Z';
  assert.notEqual(prepareLedgerReconciliationProof(a).evidenceSha256, prepareLedgerReconciliationProof(b).evidenceSha256);
});
test('proof preparation has no network or mutation surface; SQL only reuses existing settlement', async () => {
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('provider network forbidden'); };
  try { prepareLedgerReconciliationProof(proof()); assert.equal(calls, 0); } finally { globalThis.fetch = originalFetch; }
  const helper = await readFile(new URL('../../scripts/financial/solo-refund-ledger-proof.mjs', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../../supabase/migrations/20261007052144_solo_refund_provider_ledger_reconciliation.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(helper, /cancelCardPayment|https?:|fetch\(|createAdminClient|\.rpc\(/);
  assert.doesNotMatch(sql, /CREATE OR REPLACE|cancelCardPayment|https?:|http_post|net\.http|deliver_solo_refund_notification_atomic/i);
  assert.match(sql, /RETURN QUERY SELECT \* FROM public\.apply_solo_refund_settlement_atomic\(o\.id\)/);
});
