// Pure proof preparation only: no database client, environment credentials,
// provider transport, mutation mode, notification or application refund import.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const LEDGER_BOOKING_FIELDS = [
  'amount', 'host_payout_amount', 'id', 'order_id', 'payment_method', 'payment_provider',
  'payment_provider_reference', 'payout_paid_at', 'payout_status', 'platform_revenue', 'price_at_booking',
  'refund_amount', 'solo_guarantee_price', 'solo_guarantee_refund_amount', 'solo_guarantee_refund_error',
  'solo_guarantee_refund_status', 'solo_guarantee_refund_trigger_booking_id', 'solo_guarantee_refunded_at',
  'status', 'tid', 'total_experience_price', 'total_price',
];
export const LEDGER_PROOF_FIELDS = [
  'acquired_on', 'acquisition_state', 'attempt_identity', 'booking_id', 'booking_snapshot',
  'cancel_amount', 'cancellation_count', 'cancellation_transaction_id', 'cancelled_at', 'captured_at',
  'evidence_source', 'merchant_id', 'operation_id', 'operation_order_reference', 'original_amount',
  'original_approved_at', 'original_transaction_id', 'payment_method', 'provider', 'provider_export_sha256', 'provider_verifier_account',
  'query_from', 'query_scope', 'query_to', 'remaining_amount', 'schema_version', 'transaction_state', 'verifying_admin_id',
];
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function exactKeys(value, expected) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'ledger_proof_object_required');
  assert.deepEqual(Object.keys(value).sort(), expected, 'ledger_proof_fields_differ');
}
export function canonicalLedgerJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    assert(Number.isSafeInteger(value) && !Object.is(value, -0), 'ledger_proof_integer_required');
    return JSON.stringify(value);
  }
  assert(value && typeof value === 'object' && !Array.isArray(value), 'ledger_proof_object_required');
  const keys = Object.keys(value).sort();
  assert(keys.every(key => /^[a-z_][a-z_0-9]*$/.test(key)), 'ledger_proof_ascii_keys_required');
  return '{' + keys.map(key => JSON.stringify(key) + ':' + canonicalLedgerJson(value[key])).join(',') + '}';
}
export function validateLedgerProof(evidence) {
  exactKeys(evidence, LEDGER_PROOF_FIELDS);
  exactKeys(evidence.booking_snapshot, LEDGER_BOOKING_FIELDS);
  for (const name of ['operation_id', 'attempt_identity', 'verifying_admin_id']) {
    assert(typeof evidence[name] === 'string' && uuid.test(evidence[name]), 'ledger_proof_admin_and_operation_identity_required');
  }
  for (const name of ['booking_id', 'operation_order_reference', 'merchant_id', 'original_transaction_id',
    'cancellation_transaction_id', 'provider_verifier_account']) {
    assert(typeof evidence[name] === 'string' && identifier.test(evidence[name]), 'ledger_proof_identifier_required');
  }
  for (const name of ['cancelled_at', 'original_approved_at', 'captured_at', 'query_from', 'query_to']) {
    assert(typeof evidence[name] === 'string' && timestamp.test(evidence[name])
      && Number.isFinite(Date.parse(evidence[name])) && new Date(evidence[name]).toISOString() === evidence[name], 'ledger_proof_timestamp_required');
  }
  assert(/^\d{4}-\d{2}-\d{2}$/.test(evidence.acquired_on)
    && new Date(evidence.acquired_on).toISOString().slice(0, 10) === evidence.acquired_on, 'ledger_proof_acquisition_date_required');
  for (const name of ['schema_version', 'original_amount', 'cancel_amount', 'remaining_amount', 'cancellation_count']) {
    assert(Number.isSafeInteger(evidence[name]) && evidence[name] >= 0 && evidence[name] <= 999999999, 'ledger_proof_amount_required');
  }
  assert.equal(evidence.schema_version, 1);
  assert.equal(evidence.provider, 'nicepay');
  assert.equal(evidence.payment_method, 'card');
  assert.equal(evidence.evidence_source, 'nicepay_merchant_ledger');
  assert(typeof evidence.provider_export_sha256 === 'string' && /^[a-f0-9]{64}$/.test(evidence.provider_export_sha256), 'ledger_proof_export_digest_required');
  assert.equal(evidence.query_scope, 'original_order_all_states');
  assert.equal(evidence.transaction_state, '후취소');
  assert.equal(evidence.acquisition_state, '취소매입');
  assert.equal(evidence.cancellation_count, 1);
  assert(evidence.cancel_amount > 0 && evidence.remaining_amount > 0
    && evidence.original_amount === evidence.cancel_amount + evidence.remaining_amount, 'ledger_proof_money_mismatch');
  assert(evidence.cancellation_transaction_id !== evidence.original_transaction_id
    && evidence.cancellation_transaction_id.startsWith(evidence.merchant_id), 'ledger_proof_cancel_identity_mismatch');
  assert(Date.parse(evidence.original_approved_at) <= Date.parse(evidence.cancelled_at)
    && Date.parse(evidence.captured_at) >= Date.parse(evidence.cancelled_at)
    && Date.parse(evidence.query_from) <= Date.parse(evidence.original_approved_at)
    && Date.parse(evidence.query_to) >= Date.parse(evidence.cancelled_at), 'ledger_proof_time_mismatch');
  const canonical = canonicalLedgerJson(evidence);
  assert(Buffer.byteLength(canonical, 'utf8') <= 8192, 'ledger_proof_too_large');
  return canonical;
}
export function prepareLedgerReconciliationProof(evidence) {
  const canonical = validateLedgerProof(evidence);
  const evidenceSha256 = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return {
    mode: 'prepare-only',
    evidenceSha256,
    proofReference: `nicepay-ledger:${evidenceSha256}`,
    rpc: 'reconcile_solo_refund_provider_ledger_accepted_atomic',
    parameters: { p_operation_id: evidence.operation_id, p_evidence: structuredClone(evidence),
      p_evidence_sha256: evidenceSha256, p_admin_id: evidence.verifying_admin_id },
    providerCalls: 0, databaseMutations: 0,
  };
}
