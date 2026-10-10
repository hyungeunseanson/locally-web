import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import type { ExperienceCardBookingRow } from '@/app/api/payment/experienceCardConfirmation';
import { getNicePayRuntimeConfig, queryNicePayPaymentState } from './server';

export const PHASE2_SAFE_RELEASE_REASON = 'NICEPAY 승인 전 확인된 결제 중단 (PHASE2)';
const ABANDONED_AFTER_MS = 5 * 60 * 1000;

type RecoveryRow = {
  booking_id: string;
  order_id: string;
  mid: string;
  amount: number;
  tid: string | null;
  state: 'claimed' | 'auth_received' | 'approval_started' | 'approved' | 'confirmed' | 'released' | 'manual_review';
  created_at: string;
  auth_received_at: string | null;
  interrupted_at: string | null;
  next_retry_at: string | null;
  alerted_at: string | null;
};

type RecoveryResult = 'confirmed' | 'released' | 'pending' | 'manual_review' | 'already_terminal';

async function rpcText(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await client.rpc(name, args);
  if (error || typeof data !== 'string') throw new Error(`${name}: ${error?.message || 'empty result'}`);
  return data;
}

export async function prepareNicePayAttempt(params: {
  client: SupabaseClient; bookingId: string; orderId: string; amount: number;
}) {
  return rpcText(params.client, 'prepare_experience_nicepay_attempt_atomic', {
    p_booking_id: params.bookingId, p_order_id: params.orderId,
    p_mid: getNicePayRuntimeConfig().mid, p_amount: params.amount,
  });
}

export async function observeNicePayAuth(params: {
  client: SupabaseClient; bookingId: string; orderId: string; tid: string; mid: string; amount: number;
}) {
  return rpcText(params.client, 'observe_experience_nicepay_auth_atomic', {
    p_booking_id: params.bookingId, p_order_id: params.orderId, p_tid: params.tid,
    p_mid: params.mid, p_amount: params.amount,
  });
}

export async function beginNicePayApproval(params: { client: SupabaseClient; bookingId: string; tid: string }) {
  return rpcText(params.client, 'begin_experience_nicepay_approval_atomic', {
    p_booking_id: params.bookingId, p_tid: params.tid,
  });
}

export async function recordNicePayApproval(params: {
  client: SupabaseClient; bookingId: string; orderId: string; tid: string; amount: number;
}) {
  return rpcText(params.client, 'record_experience_nicepay_approval_atomic', {
    p_booking_id: params.bookingId, p_order_id: params.orderId, p_tid: params.tid,
    p_mid: getNicePayRuntimeConfig().mid, p_amount: params.amount,
  });
}

export async function markNicePayConfirmed(params: { client: SupabaseClient; bookingId: string; tid: string }) {
  return rpcText(params.client, 'confirm_experience_nicepay_recovery_atomic', {
    p_booking_id: params.bookingId, p_tid: params.tid,
  });
}

async function noteRecovery(client: SupabaseClient, bookingId: string, code: string, manual = false) {
  const result = await rpcText(client, 'note_experience_nicepay_recovery_atomic', {
    p_booking_id: bookingId, p_error_code: code, p_manual: manual,
  });
  return result === 'manual_review' ? 'manual_review' : 'pending';
}

async function alertManualReview(client: SupabaseClient, row: RecoveryRow) {
  if (row.alerted_at) return;
  const message = `예약 ${row.order_id}: NICEPAY TID ${row.tid || '미확인'}, 승인·예약 상태를 수동으로 대조해야 합니다. 자동 환불은 실행하지 않았습니다.`;
  await insertAdminAlerts({
    title: '[긴급] 카드 결제 복구 수동 대조 필요', message,
    link: '/admin/dashboard?tab=LEDGER',
  }, { supabaseAdmin: client });
  await sendAdminAlertEmails({
    subject: '[LOCALLY] 카드 결제 복구 수동 대조 필요',
    title: '카드 결제 복구 수동 대조 필요', message,
    link: '/admin/dashboard?tab=LEDGER',
  }, { supabaseAdmin: client }).catch(() => undefined);
  await client.from('experience_nicepay_recovery')
    .update({ alerted_at: new Date().toISOString() })
    .eq('booking_id', row.booking_id).eq('state', 'manual_review').is('alerted_at', null);
}

async function loadRecovery(client: SupabaseClient, bookingId: string): Promise<RecoveryRow | null> {
  const { data, error } = await client.from('experience_nicepay_recovery')
    .select('booking_id, order_id, mid, amount, tid, state, created_at, auth_received_at, interrupted_at, next_retry_at, alerted_at')
    .eq('booking_id', bookingId).maybeSingle();
  if (error) throw error;
  return data as RecoveryRow | null;
}

export async function interruptNicePayAttempt(params: {
  client: SupabaseClient; bookingId: string; userId: string;
}) {
  return rpcText(params.client, 'interrupt_experience_nicepay_attempt_atomic', {
    p_booking_id: params.bookingId, p_user_id: params.userId,
  });
}

export async function recoverNicePayAttempt(params: {
  client: SupabaseClient; bookingId: string; userId?: string | null; now?: number;
}): Promise<RecoveryResult> {
  const { client, bookingId } = params;
  const row = await loadRecovery(client, bookingId);
  if (!row) return 'pending';
  if (row.state === 'confirmed' || row.state === 'released') return 'already_terminal';
  if (row.state === 'manual_review') {
    await alertManualReview(client, row);
    return 'manual_review';
  }
  const configuredMid = getNicePayRuntimeConfig().mid;
  if (row.mid !== configuredMid || row.amount <= 0 || row.order_id !== bookingId) {
    const result = await noteRecovery(client, bookingId, 'recovery_identity_conflict', true);
    if (result === 'manual_review') await alertManualReview(client, { ...row, alerted_at: null });
    return result;
  }
  const age = (params.now ?? Date.now()) - Date.parse(row.auth_received_at || row.created_at);
  const abandoned = Boolean(row.interrupted_at) || age >= ABANDONED_AFTER_MS;
  if (!row.tid) {
    if (!abandoned) return 'pending';
    try {
      await rpcText(client, 'release_experience_nicepay_hold_atomic', {
        p_booking_id: bookingId, p_user_id: params.userId || null, p_provider_status: 'no_auth',
      });
      return 'released';
    } catch {
      return noteRecovery(client, bookingId, 'release_conflict', true);
    }
  }
  let providerState: Awaited<ReturnType<typeof queryNicePayPaymentState>>;
  try {
    providerState = await queryNicePayPaymentState(row.tid);
  } catch {
    return noteRecovery(client, bookingId, 'provider_query_unavailable');
  }
  if (providerState === 'approved') {
    const { data: booking, error } = await client.from('bookings')
      .select('*, experiences (price, private_price, max_guests, host_id, title)')
      .eq('id', bookingId).maybeSingle();
    if (error) return noteRecovery(client, bookingId, 'booking_query_unavailable');
    if (!booking || booking.order_id !== row.order_id || Number(booking.amount) !== row.amount ||
        booking.payment_provider !== 'nicepay' || booking.payment_provider_reference !== row.order_id) {
      const result = await noteRecovery(client, bookingId, 'booking_provider_identity_conflict', true);
      if (result === 'manual_review') await alertManualReview(client, { ...row, alerted_at: null });
      return result;
    }
    try {
      const { finalizeExperienceCardPayment } = await import('@/app/api/payment/experienceCardConfirmation');
      const outcome = await finalizeExperienceCardPayment({
        supabaseAdmin: client as ReturnType<typeof import('@/app/utils/supabase/admin').createAdminClient>,
        originalBooking: booking as ExperienceCardBookingRow,
        verificationResult: { provider: 'nicepay', approvedAmount: row.amount,
          providerTransactionId: row.tid, raw: { recoveryStatusQuery: 'approved' } },
      });
      if (outcome.success && !outcome.cancelledAndRefunded) return 'confirmed';
      return noteRecovery(client, bookingId, 'confirmation_contract_conflict', true);
    } catch {
      return noteRecovery(client, bookingId, 'confirmation_retry_required');
    }
  }
  if (providerState === 'cancelled' && row.state !== 'approved') {
    try {
      await rpcText(client, 'release_experience_nicepay_hold_atomic', {
        p_booking_id: bookingId, p_user_id: params.userId || null, p_provider_status: 'cancelled',
      });
      return 'released';
    } catch {
      return noteRecovery(client, bookingId, 'cancelled_release_conflict', true);
    }
  }
  if (providerState === 'missing' && row.state === 'auth_received' && abandoned) {
    try {
      await rpcText(client, 'release_experience_nicepay_hold_atomic', {
        p_booking_id: bookingId, p_user_id: params.userId || null, p_provider_status: 'missing',
      });
      return 'released';
    } catch {
      return noteRecovery(client, bookingId, 'missing_release_conflict', true);
    }
  }
  if (providerState === 'missing' && row.state === 'auth_received') {
    return 'pending';
  }
  return noteRecovery(client, bookingId, providerState === 'cancelled'
    ? 'approved_then_cancelled' : 'approval_result_unconfirmed', providerState === 'cancelled');
}

export async function runNicePayRecoveryBatch(params: { client: SupabaseClient; now?: number }) {
  const now = params.now ?? Date.now();
  const { data: due, error } = await params.client.rpc('list_due_experience_nicepay_recovery', {
    p_now: new Date(now).toISOString(), p_limit: 20,
  });
  if (error || !Array.isArray(due)) throw new Error(`NICEPAY recovery due query failed: ${error?.message || 'empty result'}`);
  const results: PromiseSettledResult<RecoveryResult>[] = [];
  for (const row of due) {
    try {
      results.push({ status: 'fulfilled', value: await recoverNicePayAttempt({
        client: params.client, bookingId: row.booking_id, now,
      }) });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }
  return {
    scanned: due.length,
    confirmed: results.filter((r) => r.status === 'fulfilled' && r.value === 'confirmed').length,
    released: results.filter((r) => r.status === 'fulfilled' && r.value === 'released').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}
