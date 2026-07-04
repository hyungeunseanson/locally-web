import type { SupabaseClient } from '@supabase/supabase-js';

import { isCancelledOnlyBookingStatus, isCompletedBookingStatus } from '@/app/constants/bookingStatus';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';
import { isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';
import { isSoloGuaranteeRefundUnresolvedStatus } from '@/app/utils/soloGuaranteeRefundStatus';

type BookingPayoutRow = {
  id: string;
  status: string | null;
  amount?: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  price_at_booking?: number | null;
  solo_guarantee_price?: number | null;
  solo_guarantee_refund_amount?: number | null;
  refund_amount?: number | null;
  payout_status: string | null;
  solo_guarantee_refund_status?: string | null;
};

const EXPERIENCE_PAYOUT_SETTLE_STATUSES = ['completed', 'COMPLETED', 'cancelled', 'CANCELLED'];

function canSettleExperienceBooking(row: BookingPayoutRow) {
  const status = String(row.status || '');
  const payoutAmount = getBookingHostPayout(row);

  if (payoutAmount <= 0) {
    return false;
  }

  if (isCompletedBookingStatus(status)) {
    return true;
  }

  return isCancelledOnlyBookingStatus(status) && row.host_payout_amount != null;
}

type SettleHostPayoutSuccess = {
  success: true;
  updatedIds: string[];
};

type SettleHostPayoutFailure = {
  success: false;
  error: string;
  alreadyPaidIds?: string[];
  invalidStatusIds?: string[];
  missingIds?: string[];
};

export type SettleHostPayoutResult = SettleHostPayoutSuccess | SettleHostPayoutFailure;

export async function settleExperienceBookingPayouts(
  supabaseAdmin: SupabaseClient,
  bookingIds: string[]
): Promise<SettleHostPayoutResult> {
  const uniqueBookingIds = Array.from(new Set(bookingIds.filter(Boolean)));

  if (uniqueBookingIds.length === 0) {
    return { success: false, error: 'No bookings provided' };
  }

  const { data: targetBookings, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select(
      [
        'id',
        'status',
        'amount',
        'total_price',
        'total_experience_price',
        'host_payout_amount',
        'platform_revenue',
        'price_at_booking',
        'solo_guarantee_price',
        'solo_guarantee_refund_amount',
        'refund_amount',
        'payout_status',
        'solo_guarantee_refund_status',
      ].join(', ')
    )
    .in('id', uniqueBookingIds);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const rows = ((targetBookings || []) as unknown) as BookingPayoutRow[];
  const foundIds = new Set(rows.map((row) => row.id));
  const missingIds = uniqueBookingIds.filter((bookingId) => !foundIds.has(bookingId));

  if (missingIds.length > 0) {
    return {
      success: false,
      error: '일부 예약 정보를 찾을 수 없습니다.',
      missingIds,
    };
  }

  const alreadyPaidIds = rows
    .filter((row) => row.payout_status === 'paid')
    .map((row) => row.id);

  if (alreadyPaidIds.length > 0) {
    return {
      success: false,
      error: `이미 정산 완료된 예약이 포함되어 있습니다. (${alreadyPaidIds.length}건)`,
      alreadyPaidIds,
    };
  }

  const invalidStatusIds = rows
    .filter((row) => row.payout_status !== 'pending')
    .map((row) => row.id);

  if (invalidStatusIds.length > 0) {
    return {
      success: false,
      error: '정산 대기 상태인 예약만 처리할 수 있습니다.',
      invalidStatusIds,
    };
  }

  const invalidSettlementIds = rows
    .filter((row) => !canSettleExperienceBooking(row))
    .map((row) => row.id);

  if (invalidSettlementIds.length > 0) {
    return {
      success: false,
      error: '정산 완료 처리할 수 없는 예약이 포함되어 있습니다.',
      invalidStatusIds: invalidSettlementIds,
    };
  }

  const unresolvedSoloRefundIds = rows
    .filter((row) => isSoloGuaranteeRefundUnresolvedStatus(row.solo_guarantee_refund_status))
    .map((row) => row.id);

  if (unresolvedSoloRefundIds.length > 0) {
    return {
      success: false,
      error: '1인 진행 추가금 환불 확인이 끝난 예약만 정산 완료 처리할 수 있습니다.',
      invalidStatusIds: unresolvedSoloRefundIds,
    };
  }

  const paidAt = new Date().toISOString();
  let { data: updatedRows, error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ payout_status: 'paid', payout_paid_at: paidAt })
    .in('id', uniqueBookingIds)
    .eq('payout_status', 'pending')
    .in('status', EXPERIENCE_PAYOUT_SETTLE_STATUSES)
    .select('id');

  if (updateError && isMissingPayoutPaidAtColumnError(updateError)) {
    const fallbackResult = await supabaseAdmin
      .from('bookings')
      .update({ payout_status: 'paid' })
      .in('id', uniqueBookingIds)
      .eq('payout_status', 'pending')
      .in('status', EXPERIENCE_PAYOUT_SETTLE_STATUSES)
      .select('id');

    updatedRows = fallbackResult.data;
    updateError = fallbackResult.error;
  }

  if (updateError) {
    throw new Error(updateError.message);
  }

  const updatedIds = (updatedRows || []).map((row) => String(row.id));

  if (updatedIds.length !== uniqueBookingIds.length) {
    return {
      success: false,
      error: '다른 관리자에 의해 정산 상태가 변경되었습니다. 새로고침 후 다시 확인해 주세요.',
    };
  }

  return {
    success: true,
    updatedIds,
  };
}
