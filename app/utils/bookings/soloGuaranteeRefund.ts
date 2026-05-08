import type { SupabaseClient } from '@supabase/supabase-js';

import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import {
  buildSoloRefundSettlementSnapshot,
  findSoloGuaranteeRefundCandidatesInSlot,
  getSoloManualRefundCompletionGuard,
  type SoloGuaranteeRefundSlotBooking,
  toSoloGuaranteeRefundNumber as toNumber,
} from '@/app/utils/bookings/soloGuaranteeRefundPolicy';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { normalizeSoloGuaranteeRefundStatus } from '@/app/utils/soloGuaranteeRefundStatus';

type CompletedSlotRow = {
  id: string;
  experience_id: number | string | null;
  date: string | null;
  time: string | null;
};

type ProcessSoloGuaranteeRefundResult = {
  processed: number;
  refunded: number;
  pendingManual: number;
  failed: number;
  skipped: number;
};

type CancelCardPaymentFn = typeof cancelCardPayment;

function normalizeExperienceMeta(value: SoloGuaranteeRefundSlotBooking['experiences']) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function buildSlotKey(row: Pick<CompletedSlotRow, 'experience_id' | 'date' | 'time'>) {
  return [String(row.experience_id ?? ''), row.date || '', row.time || ''].join('|');
}

function formatWon(amount: number) {
  return `${Math.max(0, Math.floor(amount)).toLocaleString('ko-KR')}원`;
}

async function notifyGuestSoloRefundStatus(params: {
  supabaseAdmin: SupabaseClient;
  booking: SoloGuaranteeRefundSlotBooking;
  status: 'refunded' | 'pending_manual';
  refundAmount: number;
}) {
  if (!params.booking.user_id) return;

  const title = params.status === 'refunded'
    ? '1인 진행 추가금 환불 완료'
    : '1인 진행 추가금 환불 확인 중';
  const refundAmountLabel = formatWon(params.refundAmount);
  const message = params.status === 'refunded'
    ? `다른 참여자가 함께 확정되어 1인 진행 추가금 ${refundAmountLabel}이 환불 처리되었습니다.`
    : `다른 참여자가 함께 확정되어 1인 진행 추가금 ${refundAmountLabel} 환불을 운영팀이 확인 중입니다.`;

  const { error } = await params.supabaseAdmin.from('notifications').insert({
    user_id: params.booking.user_id,
    type: 'refund',
    title,
    message,
    link: '/guest/trips',
    is_read: false,
  });

  if (error) {
    console.error('[solo guarantee refund] guest notification failed:', error);
  }
}

async function alertAdminSoloRefundRequired(params: {
  title: string;
  booking: SoloGuaranteeRefundSlotBooking;
  message: string;
}) {
  try {
    const experience = normalizeExperienceMeta(params.booking.experiences);
    await insertAdminAlerts({
      title: params.title,
      message: `[${String(params.booking.order_id || params.booking.id).slice(-12)}] ${
        experience?.title || '체험 예약'
      } - ${params.message}`,
      link: '/admin/dashboard?tab=LEDGER',
    });
  } catch (error) {
    console.error('[solo guarantee refund] admin alert failed:', error);
  }
}

async function markSoloRefundFailed(params: {
  supabaseAdmin: SupabaseClient;
  booking: SoloGuaranteeRefundSlotBooking;
  triggerBookingId: string;
  refundAmount: number;
  errorMessage: string;
}) {
  await params.supabaseAdmin
    .from('bookings')
    .update({
      solo_guarantee_refund_status: 'failed',
      solo_guarantee_refund_amount: params.refundAmount,
      solo_guarantee_refund_error: params.errorMessage,
      solo_guarantee_refund_trigger_booking_id: params.triggerBookingId,
    })
    .eq('id', params.booking.id);

  await alertAdminSoloRefundRequired({
    title: '1인 진행 추가금 환불 확인 필요',
    booking: params.booking,
    message: params.errorMessage,
  });
}

async function processManualSoloRefund(params: {
  supabaseAdmin: SupabaseClient;
  booking: SoloGuaranteeRefundSlotBooking;
  triggerBookingId: string;
  refundAmount: number;
}) {
  if (params.booking.payout_status === 'paid') {
    await markSoloRefundFailed({
      supabaseAdmin: params.supabaseAdmin,
      booking: params.booking,
      triggerBookingId: params.triggerBookingId,
      refundAmount: params.refundAmount,
      errorMessage: '이미 정산 완료된 예약입니다. 수동 확인이 필요합니다.',
    });
    return 'failed' as const;
  }

  const snapshot = buildSoloRefundSettlementSnapshot(params.booking, params.refundAmount);
  const { data: updatedRow, error } = await params.supabaseAdmin
    .from('bookings')
    .update({
      solo_guarantee_refund_status: 'pending_manual',
      solo_guarantee_refund_amount: params.refundAmount,
      solo_guarantee_refund_error: null,
      solo_guarantee_refund_trigger_booking_id: params.triggerBookingId,
      ...snapshot,
    })
    .eq('id', params.booking.id)
    .in('solo_guarantee_refund_status', ['not_applicable', 'failed'])
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!updatedRow) return 'skipped' as const;

  await notifyGuestSoloRefundStatus({
    supabaseAdmin: params.supabaseAdmin,
    booking: params.booking,
    status: 'pending_manual',
    refundAmount: params.refundAmount,
  });
  await alertAdminSoloRefundRequired({
    title: '1인 진행 추가금 수동 환불 필요',
    booking: params.booking,
    message: `카드 외 결제수단 예약입니다. ${formatWon(params.refundAmount)} 수동 환불 후 장부에서 완료 처리해 주세요.`,
  });

  return 'pending_manual' as const;
}

async function processCardSoloRefund(params: {
  supabaseAdmin: SupabaseClient;
  booking: SoloGuaranteeRefundSlotBooking;
  triggerBookingId: string;
  refundAmount: number;
  cancelCardPaymentFn: CancelCardPaymentFn;
}) {
  if (params.booking.payout_status === 'paid') {
    await markSoloRefundFailed({
      supabaseAdmin: params.supabaseAdmin,
      booking: params.booking,
      triggerBookingId: params.triggerBookingId,
      refundAmount: params.refundAmount,
      errorMessage: '이미 정산 완료된 예약입니다. 수동 확인이 필요합니다.',
    });
    return 'failed' as const;
  }

  if (!params.booking.tid) {
    await markSoloRefundFailed({
      supabaseAdmin: params.supabaseAdmin,
      booking: params.booking,
      triggerBookingId: params.triggerBookingId,
      refundAmount: params.refundAmount,
      errorMessage: '카드 환불 거래 식별값이 없어 자동 환불할 수 없습니다.',
    });
    return 'failed' as const;
  }

  const { data: lockedRow, error: lockError } = await params.supabaseAdmin
    .from('bookings')
    .update({
      solo_guarantee_refund_status: 'processing',
      solo_guarantee_refund_error: null,
      solo_guarantee_refund_trigger_booking_id: params.triggerBookingId,
    })
    .eq('id', params.booking.id)
    .in('solo_guarantee_refund_status', ['not_applicable', 'failed'])
    .select(
      'id, order_id, user_id, amount, total_price, total_experience_price, price_at_booking, solo_guarantee_price, solo_guarantee_refund_amount, refund_amount, tid, payout_status'
    )
    .maybeSingle();

  if (lockError) throw lockError;
  if (!lockedRow) return 'skipped' as const;

  try {
    await params.cancelCardPaymentFn({
      providerTransactionId: String(params.booking.tid),
      orderId: params.booking.order_id || params.booking.id,
      cancelAmount: params.refundAmount,
      cancelReason: '1인 진행 추가금 환불',
      totalAmount: toNumber(params.booking.amount),
      requireMerchantKey: true,
      acceptedResultCodes: ['2001', '2211'],
    });

    const lockedBooking = { ...params.booking, ...(lockedRow as SoloGuaranteeRefundSlotBooking) };
    const snapshot = buildSoloRefundSettlementSnapshot(lockedBooking, params.refundAmount);
    const nextRefundAmount = Math.min(
      toNumber(params.booking.amount),
      toNumber(lockedBooking.refund_amount) + params.refundAmount
    );
    const refundedAt = new Date().toISOString();
    const { data: updatedRow, error: updateError } = await params.supabaseAdmin
      .from('bookings')
      .update({
        solo_guarantee_refund_status: 'refunded',
        solo_guarantee_refund_amount: params.refundAmount,
        solo_guarantee_refunded_at: refundedAt,
        solo_guarantee_refund_error: null,
        refund_amount: nextRefundAmount,
        ...snapshot,
      })
      .eq('id', params.booking.id)
      .eq('status', 'completed')
      .eq('solo_guarantee_refund_status', 'processing')
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedRow) {
      throw new Error('예약 상태가 변경되어 1인 진행 추가금 환불 확정 저장이 중단되었습니다. 관리자 확인이 필요합니다.');
    }

    await notifyGuestSoloRefundStatus({
      supabaseAdmin: params.supabaseAdmin,
      booking: params.booking,
      status: 'refunded',
      refundAmount: params.refundAmount,
    });

    return 'refunded' as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : '자동 환불 처리 중 오류가 발생했습니다.';
    await markSoloRefundFailed({
      supabaseAdmin: params.supabaseAdmin,
      booking: params.booking,
      triggerBookingId: params.triggerBookingId,
      refundAmount: params.refundAmount,
      errorMessage: message,
    });
    return 'failed' as const;
  }
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
      experiences(title, host_id)
    `)
    .eq('experience_id', slot.experience_id)
    .eq('date', slot.date);

  query = slot.time == null ? query.is('time', null) : query.eq('time', slot.time);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as SoloGuaranteeRefundSlotBooking[];
}

export async function processSoloGuaranteeRefundsForCompletedBookings(params: {
  supabaseAdmin: SupabaseClient;
  completedBookingIds: Array<string | number | null | undefined>;
  cancelCardPaymentFn?: CancelCardPaymentFn;
}): Promise<ProcessSoloGuaranteeRefundResult> {
  const uniqueBookingIds = Array.from(
    new Set(params.completedBookingIds.map((id) => String(id || '').trim()).filter(Boolean))
  );
  const result: ProcessSoloGuaranteeRefundResult = {
    processed: 0,
    refunded: 0,
    pendingManual: 0,
    failed: 0,
    skipped: 0,
  };

  if (uniqueBookingIds.length === 0) return result;

  const slots = await fetchCompletedSlotRows(params.supabaseAdmin, uniqueBookingIds);
  const uniqueSlots = Array.from(new Map(slots.map((slot) => [buildSlotKey(slot), slot])).values());

  for (const slot of uniqueSlots) {
    const rows = await fetchSlotBookings(params.supabaseAdmin, slot);
    const rowMap = new Map(rows.map((row) => [row.id, row]));
    const candidates = findSoloGuaranteeRefundCandidatesInSlot(rows);

    for (const candidate of candidates) {
      const booking = rowMap.get(candidate.bookingId);
      if (!booking) {
        result.skipped += 1;
        continue;
      }

      result.processed += 1;
      const paymentMethod = String(booking.payment_method || '').toLowerCase();
      const outcome = paymentMethod === 'card'
        ? await processCardSoloRefund({
            supabaseAdmin: params.supabaseAdmin,
            booking,
            triggerBookingId: candidate.triggerBookingId,
            refundAmount: candidate.refundAmount,
            cancelCardPaymentFn: params.cancelCardPaymentFn || cancelCardPayment,
          })
        : await processManualSoloRefund({
            supabaseAdmin: params.supabaseAdmin,
            booking,
            triggerBookingId: candidate.triggerBookingId,
            refundAmount: candidate.refundAmount,
          });

      if (outcome === 'refunded') result.refunded += 1;
      else if (outcome === 'pending_manual') result.pendingManual += 1;
      else if (outcome === 'failed') result.failed += 1;
      else result.skipped += 1;
    }
  }

  return result;
}

export async function markSoloGuaranteeManualRefundCompleted(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
  adminId?: string | null;
  adminEmail?: string | null;
}) {
  const { data: booking, error } = await params.supabaseAdmin
    .from('bookings')
    .select(`
      id,
      user_id,
      amount,
      total_price,
      total_experience_price,
      price_at_booking,
      solo_guarantee_price,
      refund_amount,
      solo_guarantee_refund_status,
      solo_guarantee_refund_amount,
      payout_status,
      experiences(title)
    `)
    .eq('id', params.bookingId)
    .maybeSingle();

  if (error) throw error;
  const row = booking as SoloGuaranteeRefundSlotBooking | null;
  if (!row) {
    return { success: false as const, status: 404, error: '예약 정보를 찾을 수 없습니다.' };
  }

  const currentStatus = normalizeSoloGuaranteeRefundStatus(row.solo_guarantee_refund_status);
  const completionGuard = getSoloManualRefundCompletionGuard(row);
  if (!completionGuard.ok) {
    return {
      success: false as const,
      status: 409,
      error: completionGuard.reason === 'not_waiting'
        ? '수동 환불 대기 상태가 아닙니다.'
        : completionGuard.reason === 'already_paid'
        ? '이미 정산 완료된 예약입니다. 별도 정산 조정이 필요합니다.'
        : '정산 대기 상태의 예약만 수동 환불 완료 처리할 수 있습니다.',
    };
  }

  const refundAmount = toNumber(row.solo_guarantee_refund_amount);
  if (refundAmount <= 0) {
    return { success: false as const, status: 409, error: '환불 처리할 1인 진행 추가금이 없습니다.' };
  }

  const refundedAt = new Date().toISOString();
  const snapshot = buildSoloRefundSettlementSnapshot(row, refundAmount, {
    existingSoloRefundAlreadyApplied: currentStatus !== 'failed',
  });
  const nextRefundAmount = Math.min(toNumber(row.amount), toNumber(row.refund_amount) + refundAmount);
  const { data: updatedRow, error: updateError } = await params.supabaseAdmin
    .from('bookings')
    .update({
      solo_guarantee_refund_status: 'refunded',
      solo_guarantee_refunded_at: refundedAt,
      solo_guarantee_refund_error: null,
      refund_amount: nextRefundAmount,
      ...snapshot,
    })
    .eq('id', params.bookingId)
    .eq('payout_status', 'pending')
    .in('solo_guarantee_refund_status', ['pending_manual', 'failed'])
    .select('id')
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updatedRow) {
    return { success: false as const, status: 409, error: '다른 관리자에 의해 환불 상태가 변경되었습니다.' };
  }

  await notifyGuestSoloRefundStatus({
    supabaseAdmin: params.supabaseAdmin,
    booking: row,
    status: 'refunded',
    refundAmount,
  });

  return {
    success: true as const,
    bookingId: params.bookingId,
    refundAmount,
    refundedAt,
    adminId: params.adminId || null,
    adminEmail: params.adminEmail || null,
  };
}
