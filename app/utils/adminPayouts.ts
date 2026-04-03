import type { SupabaseClient } from '@supabase/supabase-js';

import { isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';

type BookingPayoutRow = {
  id: string;
  payout_status: string | null;
};

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
    .select('id, payout_status')
    .in('id', uniqueBookingIds);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const rows = (targetBookings || []) as BookingPayoutRow[];
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

  const paidAt = new Date().toISOString();
  let { data: updatedRows, error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ payout_status: 'paid', payout_paid_at: paidAt })
    .in('id', uniqueBookingIds)
    .eq('payout_status', 'pending')
    .select('id');

  if (updateError && isMissingPayoutPaidAtColumnError(updateError)) {
    const fallbackResult = await supabaseAdmin
      .from('bookings')
      .update({ payout_status: 'paid' })
      .in('id', uniqueBookingIds)
      .eq('payout_status', 'pending')
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
