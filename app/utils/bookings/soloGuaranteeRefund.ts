import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSoloGuaranteeTourEnded, type SoloGuaranteeRefundSlotBooking } from '@/app/utils/bookings/soloGuaranteeRefundPolicy';
import { cancelCardPayment, CardRefundOutcomeError } from '@/app/utils/payments/card/server';
import { normalizeNotificationLocale } from '@/app/utils/notificationLocale';
import { soloRefundNotificationCopy } from '@/app/utils/bookings/soloRefundCopy';

type CompletedSlotRow = { id: string; experience_id: number | string | null; date: string | null; time: string | null };
type CancelCardPaymentFn = typeof cancelCardPayment;
export type SoloRefundOperation = {
  id: string; booking_id: string; provider: string; payment_method: string;
  attempt_identity: string;
  transaction_reference: string | null; order_reference: string; requested_amount: number;
  gross_amount: number;
  outcome: 'claimed' | 'accepted' | 'unknown' | 'rejected' | 'manual_pending';
  settlement_applied_at: string | null; delivery_state: string;
};
const SOLO_REFUND_RECONCILIATION_LIMIT = 50;
const SOLO_REFUND_RECONCILIATION_ROTATION_MS = 2 * 60 * 60 * 1000;
function buildSlotKey(row: CompletedSlotRow) { return [row.experience_id, row.date, row.time].join('|'); }
async function rpcOperations(db: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error('solo_refund_database_transition_failed');
  return (data || []) as SoloRefundOperation[];
}
// Only DB transitions are retried. The dispatch token and external request are
// never retried on a lost response, transport exception or accounting failure.
async function saveOutcome(db: SupabaseClient, op: SoloRefundOperation, outcome: string,
  resultCode: string | null, reference: string | null, diagnostic: string | null) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return (await rpcOperations(db, 'record_solo_refund_outcome_atomic', {
        p_operation_id: op.id, p_attempt_identity: op.attempt_identity, p_outcome: outcome, p_result_code: resultCode,
        p_refund_reference: reference, p_diagnostic_code: diagnostic,
      }))[0] || op;
    } catch { if (attempt === 1) return { ...op, outcome: 'unknown' as const }; }
  }
  return op;
}
async function applySettlement(db: SupabaseClient, op: SoloRefundOperation) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return (await rpcOperations(db, 'apply_solo_refund_settlement_atomic', { p_operation_id: op.id }))[0] || op; }
    catch { /* durable ACCEPTED remains blocked and recoverable */ }
  }
  return op;
}
export async function deliverSoloRefundNotification(db: SupabaseClient, op: SoloRefundOperation) {
  if (!op.settlement_applied_at && op.outcome !== 'manual_pending') return true;
  try {
    const { data: booking, error } = await db.from('bookings').select('user_id, experiences(host_id)').eq('id', op.booking_id).single();
    if (error) throw error;
    const exp = Array.isArray(booking.experiences) ? booking.experiences[0] : booking.experiences;
    const recipients = [{ id: booking.user_id, host: false }, { id: exp?.host_id, host: true }].filter(r => r.id);
    const notifications = await Promise.all(recipients.map(async r => {
      let locale = 'ko' as 'ko' | 'en' | 'ja' | 'zh';
      try {
        const user = await db.auth.admin.getUserById(r.id);
        locale = normalizeNotificationLocale(user.data.user?.user_metadata?.preferred_locale) || 'ko';
      } catch { /* locale fallback requires no sensitive diagnostic */ }
      return { user_id: r.id, ...soloRefundNotificationCopy(locale, !!op.settlement_applied_at, op.requested_amount, r.host) };
    }));
    const { data, error: deliveryError } = await db.rpc('deliver_solo_refund_notification_atomic', {
      p_operation_id: op.id, p_expected_phase: op.settlement_applied_at ? 'applied' : 'manual_pending', p_notifications: notifications,
    });
    if (deliveryError) throw new Error('notification_delivery_uncertain');
    return data === true;
  } catch {
    // The outbox stays pending. Recovery retries delivery without touching money.
    try { await db.rpc('mark_solo_refund_delivery_failed_atomic', { p_operation_id: op.id }); } catch { /* retain outbox */ }
    return false;
  }
}
async function executeClaim(db: SupabaseClient, op: SoloRefundOperation, cancel: CancelCardPaymentFn, merchantReference = process.env.NICEPAY_MID) {
  if (op.outcome !== 'claimed') return op;
  let dispatch: SoloRefundOperation | undefined;
  try { dispatch = (await rpcOperations(db, 'begin_solo_refund_request_atomic', { p_operation_id: op.id, p_attempt_identity: op.attempt_identity, p_merchant_reference: merchantReference || null }))[0]; }
  catch { return { ...op, outcome: 'unknown' as const }; }
  if (!dispatch) return op;
  let next: SoloRefundOperation;
  try {
    const response = await cancel({ providerTransactionId: op.transaction_reference!, orderId: op.order_reference,
      cancelAmount: op.requested_amount, cancelReason: 'Solo guarantee refund', requireMerchantKey: true,
      // Solo refund is a partial cancellation of the booking-time add-on.
      totalAmount: op.gross_amount, acceptedResultCodes: ['2001', '2211'],
    });
    if (!response.refundReference) throw new CardRefundOutcomeError('unknown', 'provider_refund_identity_missing');
    next = await saveOutcome(db, op, 'accepted', response.resultCode, response.refundReference, null);
  } catch (error) {
    const classification = error instanceof CardRefundOutcomeError ? error.outcome : 'unknown';
    const code = error instanceof CardRefundOutcomeError ? error.diagnosticCode : 'provider_outcome_uncertain';
    next = await saveOutcome(db, op, classification, error instanceof CardRefundOutcomeError ? error.resultCode : null, null, code);
  }
  return next.outcome === 'accepted' ? applySettlement(db, next) : next;
}
async function fetchCompletedSlotRows(
  supabaseAdmin: SupabaseClient,
  completedBookingIds: string[]
): Promise<CompletedSlotRow[]> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, experience_id, date, time')
    .in('id', completedBookingIds)
    .eq('status', 'completed');

  if (error) throw error;

  return ((data || []) as CompletedSlotRow[]).filter((row) => row.experience_id && row.date);
}

async function fetchSlotBookings(
  supabaseAdmin: SupabaseClient,
  slot: CompletedSlotRow
): Promise<SoloGuaranteeRefundSlotBooking[]> {
  let query = supabaseAdmin
    .from('bookings')
    .select(`
      id,
      order_id,
      user_id,
      experience_id,
      date,
      time,
      status,
      guests,
      amount,
      total_price,
      total_experience_price,
      price_at_booking,
      solo_guarantee_price,
      solo_guarantee_refund_status,
      solo_guarantee_refund_amount,
      refund_amount,
      host_payout_amount,
      platform_revenue,
      payout_status,
      payment_method,
      tid,
      experiences(title, host_id, duration)
    `)
    .eq('experience_id', slot.experience_id)
    .eq('date', slot.date);

  query = slot.time == null ? query.is('time', null) : query.eq('time', slot.time);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as SoloGuaranteeRefundSlotBooking[];
}

async function fetchSoloRefundReconciliationBookingIds(
  supabaseAdmin: SupabaseClient,
  now: Date
) {
  const { count, error: countError } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gt('solo_guarantee_price', 0)
    .eq('solo_guarantee_refund_status', 'not_applicable');

  if (countError) throw countError;
  if (!count) return [];

  const pageCount = Math.ceil(count / SOLO_REFUND_RECONCILIATION_LIMIT);
  // The existing completion cron runs every two hours; rotate one bounded page per slot.
  const rotation = Math.floor(now.getTime() / SOLO_REFUND_RECONCILIATION_ROTATION_MS);
  const pageIndex = ((rotation % pageCount) + pageCount) % pageCount;
  const pageStart = pageIndex * SOLO_REFUND_RECONCILIATION_LIMIT;
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, date, time, experiences(duration)')
    .eq('status', 'completed')
    .gt('solo_guarantee_price', 0)
    .eq('solo_guarantee_refund_status', 'not_applicable')
    .order('date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(pageStart, pageStart + SOLO_REFUND_RECONCILIATION_LIMIT - 1);

  if (error) throw error;

  return ((data || []) as SoloGuaranteeRefundSlotBooking[])
    .filter((booking) => hasSoloGuaranteeTourEnded(booking, now))
    .map((booking) => booking.id);
}

export async function retryRejectedSoloRefund(db: SupabaseClient, operationId: string, adminId: string) {
  const op = (await rpcOperations(db, 'retry_rejected_solo_refund_atomic', { p_operation_id: operationId, p_admin_id: adminId }))[0];
  if (!op) throw new Error('solo_refund_retry_unsafe');
  const final = await executeClaim(db, op, cancelCardPayment);
  await deliverSoloRefundNotification(db, final);
  return final;
}

type ProcessSoloRefundResult = { processed: number; refunded: number; pendingManual: number; failed: number; skipped: number }
  & Partial<Record<'claimed' | 'accepted' | 'unknown' | 'rejected' | 'settlement_applied' | 'manual_pending' | 'reconciliation_required' | 'delivery_failed', number>>;
export async function processSoloGuaranteeRefundsForCompletedBookings(params: {
  supabaseAdmin: SupabaseClient;
  completedBookingIds: Array<string | number | null | undefined>;
  cancelCardPaymentFn?: CancelCardPaymentFn;
  reconcileCompleted?: boolean;
  merchantReference?: string;
  now?: Date;
}): Promise<ProcessSoloRefundResult> {
  const db = params.supabaseAdmin;
  const ids = params.completedBookingIds.map(id => String(id || '').trim()).filter(Boolean);
  const result = { processed: 0, refunded: 0, pendingManual: 0, failed: 0, skipped: 0,
    claimed: 0, accepted: 0, unknown: 0, rejected: 0, settlement_applied: 0, manual_pending: 0,
    reconciliation_required: 0, delivery_failed: 0 };
  if (params.reconcileCompleted) {
    const recovery = await rpcOperations(db, 'recover_solo_refunds_atomic', { p_limit: 50 });
    for (const operation of recovery) {
      const op = operation.outcome === 'accepted' && !operation.settlement_applied_at ? await applySettlement(db, operation) : operation;
      if (!await deliverSoloRefundNotification(db, op)) result.delivery_failed++;
    }
    ids.push(...await fetchSoloRefundReconciliationBookingIds(db, params.now ?? new Date()));
  }
  if (ids.length) {
    const slots = await fetchCompletedSlotRows(db, [...new Set(ids)]);
    for (const slot of new Map(slots.map(s => [buildSlotKey(s), s])).values()) {
      // This read is only a bounded candidate hint. SQL locks and revalidates A,
      // qualifying B, slot, exact S and payout state at the authority boundary.
      const rows = await fetchSlotBookings(db, slot);
      for (const row of rows.filter(r => Number(r.solo_guarantee_price) > 0 && r.solo_guarantee_refund_status === 'not_applicable')) {
        const op = (await rpcOperations(db, 'claim_solo_refund_atomic', { p_booking_id: row.id }))[0];
        if (!op) { result.skipped++; continue; }
        result.processed++;
        if (op.outcome === 'claimed') result.claimed++;
        const final = await executeClaim(db, op, params.cancelCardPaymentFn || cancelCardPayment, params.merchantReference);
        if (final.settlement_applied_at) { result.refunded++; result.settlement_applied++; }
        if (final.outcome === 'accepted') result.accepted++;
        if (final.outcome === 'unknown') result.unknown++;
        if (final.outcome === 'rejected') { result.rejected++; result.failed++; }
        if (final.outcome === 'manual_pending') { result.pendingManual++; result.manual_pending++; }
        if (!final.settlement_applied_at && final.outcome !== 'manual_pending') result.reconciliation_required++;
        // Delivery never shares the provider/financial error handler.
        if (!await deliverSoloRefundNotification(db, final)) result.delivery_failed++;
      }
    }
  }
  console.info(JSON.stringify({ event: 'solo_guarantee_refund', ...result }));
  return result;
}

export async function markSoloGuaranteeManualRefundCompleted(params: {
  supabaseAdmin: SupabaseClient; bookingId: string; refundAmount?: number;
  proofReference?: string; transactionReference?: string; adminId?: string | null; adminEmail?: string | null;
}) {
  if (!Number.isSafeInteger(params.refundAmount) || !params.proofReference || !params.adminId) {
    return { success: false as const, status: 400, error: '정확한 환불 금액과 외부 환불 참조값이 필요합니다.' };
  }
  const { data, error } = await params.supabaseAdmin.rpc('complete_manual_solo_refund_atomic', {
    p_booking_id: params.bookingId, p_amount: params.refundAmount, p_proof_reference: params.proofReference,
    p_transaction_reference: params.transactionReference || null, p_admin_id: params.adminId,
  });
  const op = (data as SoloRefundOperation[] | null)?.[0];
  if (error || !op) return { success: false as const, status: 409, error: '환불 의무·결제수단·참조값·예약 상태를 다시 확인해 주세요.' };
  const applied = await applySettlement(params.supabaseAdmin, op);
  if (!applied.settlement_applied_at) return { success: false as const, status: 409, error: '외부 환불 증빙은 저장됐으며 장부 반영을 확인 중입니다. 다시 이체하지 마세요.' };
  await deliverSoloRefundNotification(params.supabaseAdmin, applied);
  return { success: true as const, bookingId: op.booking_id, refundAmount: op.requested_amount,
    refundedAt: applied.settlement_applied_at, adminId: params.adminId, adminEmail: params.adminEmail || null };
}
