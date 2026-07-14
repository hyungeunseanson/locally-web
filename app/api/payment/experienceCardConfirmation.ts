import { revalidatePath } from 'next/cache';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { insertAdminAlerts, sendAdminPaymentConfirmedEmail } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshotForConfirmation } from '@/app/utils/bookingFinance';
import {
  CARD_APPROVAL_RELEASE_RACE_LOCK_REASON,
  CARD_APPROVAL_RELEASE_RACE_REFUNDED_REASON,
  EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
} from '@/app/utils/bookings/pendingBookingHolds';
import { notifyExperiencePaymentConfirmed } from '@/app/utils/experienceNotificationFlows';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import type { VerifiedCardPayment } from '@/app/utils/payments/card/types';
import { createAdminClient } from '@/app/utils/supabase/admin';

type ExperienceMeta = {
  price?: number | null;
  private_price?: number | null;
  max_guests?: number | null;
  host_id?: string | null;
  title?: string | null;
};

export type ExperienceCardBookingRow = {
  id: string;
  order_id: string | null;
  user_id: string | null;
  experience_id: string;
  status: string;
  payment_method: string | null;
  amount: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  price_at_booking?: number | null;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  refund_amount?: number | null;
  solo_guarantee_price?: number | null;
  solo_guarantee_refund_amount?: number | null;
  guests: number | null;
  type: string | null;
  date: string;
  time: string | null;
  contact_name: string | null;
  experiences?: ExperienceMeta | ExperienceMeta[] | null;
};

type ExperienceCardConfirmationResult =
  | {
      success: true;
      alreadyProcessed?: boolean;
      cancelledAndRefunded?: boolean;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

async function reconcileExplicitReleasedNicePayApproval(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  originalBooking: ExperienceCardBookingRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ExperienceCardConfirmationResult | null> {
  const { supabaseAdmin, originalBooking, verificationResult } = params;
  if (verificationResult.provider !== 'nicepay') return null;

  const verifiedTid = verificationResult.providerTransactionId.trim();
  const { data: latestBooking, error: latestBookingError } = await supabaseAdmin
    .from('bookings')
    .select('status, tid, cancel_reason, refund_amount')
    .eq('id', originalBooking.id)
    .maybeSingle();

  if (latestBookingError) {
    throw new Error(latestBookingError.message || '결제 확정 상태 재조회에 실패했습니다.');
  }

  const latestStatus = String(latestBooking?.status || '').toLowerCase();
  const latestTid = String(latestBooking?.tid || '').trim();

  if (
    latestStatus === 'cancelled' &&
    latestTid === verifiedTid &&
    latestBooking?.cancel_reason === CARD_APPROVAL_RELEASE_RACE_REFUNDED_REASON &&
    Number(latestBooking.refund_amount || 0) >= verificationResult.approvedAmount
  ) {
    return { success: true, alreadyProcessed: true, cancelledAndRefunded: true };
  }

  if (
    latestStatus !== 'cancelled' ||
    latestTid ||
    latestBooking?.cancel_reason !== EXPLICIT_CARD_CHECKOUT_CANCEL_REASON
  ) {
    return null;
  }

  const { data: raceLock, error: raceLockError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'cancellation_requested',
      tid: verifiedTid,
      cancel_reason: CARD_APPROVAL_RELEASE_RACE_LOCK_REASON,
      host_payout_amount: 0,
      platform_revenue: 0,
    })
    .eq('id', originalBooking.id)
    .eq('status', 'cancelled')
    .eq('cancel_reason', EXPLICIT_CARD_CHECKOUT_CANCEL_REASON)
    .is('tid', null)
    .select('id')
    .maybeSingle();

  if (raceLockError) {
    throw new Error(raceLockError.message || '결제 승인취소 경합 잠금에 실패했습니다.');
  }
  if (!raceLock) return null;

  try {
    await cancelCardPayment({
      providerTransactionId: verifiedTid,
      orderId: originalBooking.order_id || originalBooking.id,
      cancelAmount: verificationResult.approvedAmount,
      cancelReason: '결제창 취소와 승인 응답 경합 자동 승인취소',
      totalAmount: verificationResult.approvedAmount,
      requireMerchantKey: true,
      acceptedResultCodes: ['2001', '2211'],
    });

    const { data: refundedBooking, error: refundedBookingError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancel_reason: CARD_APPROVAL_RELEASE_RACE_REFUNDED_REASON,
        refund_amount: verificationResult.approvedAmount,
        host_payout_amount: 0,
        platform_revenue: 0,
      })
      .eq('id', originalBooking.id)
      .eq('status', 'cancellation_requested')
      .eq('tid', verifiedTid)
      .eq('cancel_reason', CARD_APPROVAL_RELEASE_RACE_LOCK_REASON)
      .select('id')
      .maybeSingle();

    if (refundedBookingError || !refundedBooking) {
      throw new Error(
        refundedBookingError?.message || '승인취소는 완료됐지만 예약 상태를 갱신하지 못했습니다.'
      );
    }

    await insertAdminAlerts({
      title: '카드 결제 승인·취소 경합을 자동 정리했습니다',
      message: `예약 ${originalBooking.order_id || originalBooking.id}: 승인 직후 결제창 취소가 감지되어 전액 승인취소했습니다.`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch((alertError) => {
      console.error('[EXPERIENCE] approval-release race alert failed:', alertError);
    });

    return { success: true, cancelledAndRefunded: true };
  } catch (refundError) {
    await insertAdminAlerts({
      title: '[긴급] 카드 승인 후 자동 승인취소 처리 확인 필요',
      message: `예약 ${originalBooking.order_id || originalBooking.id}, TID ${verifiedTid}: 결제 승인·취소 경합 자동 정리를 완료하지 못했습니다. NICEPAY 거래내역과 로컬리 예약 상태를 함께 확인해주세요.`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch((alertError) => {
      console.error('[EXPERIENCE] approval-release race urgent alert failed:', alertError);
    });
    throw refundError;
  }
}

export async function finalizeExperienceCardPayment(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  originalBooking: ExperienceCardBookingRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ExperienceCardConfirmationResult> {
  const { supabaseAdmin, originalBooking, verificationResult } = params;
  const experienceMeta = Array.isArray(originalBooking.experiences)
    ? originalBooking.experiences[0]
    : originalBooking.experiences;

  const releasedApprovalResolution = await reconcileExplicitReleasedNicePayApproval(params);
  if (releasedApprovalResolution) return releasedApprovalResolution;

  const { data: existingBookings } = await supabaseAdmin
    .from('bookings')
    .select('id, guests, type')
    .eq('experience_id', originalBooking.experience_id)
    .eq('date', originalBooking.date)
    .eq('time', originalBooking.time)
    .neq('id', originalBooking.id)
    .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

  const currentBookedCount =
    existingBookings?.reduce((sum, booking) => sum + Number(booking.guests || 0), 0) || 0;
  const hasPrivateBooking = existingBookings?.some((booking) => booking.type === 'private');
  const maxGuests = experienceMeta?.max_guests || 10;

  if (
    hasPrivateBooking ||
    (originalBooking.type === 'private' && currentBookedCount > 0) ||
    (originalBooking.type !== 'private' &&
      currentBookedCount + Number(originalBooking.guests || 0) > maxGuests)
  ) {
    const releasedDuringCapacityCheck = await reconcileExplicitReleasedNicePayApproval(params);
    if (releasedDuringCapacityCheck) return releasedDuringCapacityCheck;

    return {
      success: false,
      status: 409,
      error: '잔여 좌석이 부족하여 예약을 확정할 수 없습니다.',
    };
  }

  const snapshot = getBookingSettlementSnapshotForConfirmation({
    ...originalBooking,
    amount: Number(originalBooking.amount || 0),
  });

  const { data: bookingData, error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'PAID',
      payment_method: 'card',
      tid: verificationResult.providerTransactionId,
      price_at_booking: snapshot.basePrice,
      total_experience_price: snapshot.totalExperiencePrice,
      host_payout_amount: snapshot.hostPayout,
      platform_revenue: snapshot.platformRevenue,
      payout_status: 'pending',
    })
    .eq('id', originalBooking.id)
    .eq('status', 'PENDING')
    .select('*, experiences (host_id, title)')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || '결제 확정 업데이트에 실패했습니다.');
  }

  if (!bookingData) {
    const { data: latestBooking, error: latestBookingError } = await supabaseAdmin
      .from('bookings')
      .select('status, tid, cancel_reason, refund_amount')
      .eq('id', originalBooking.id)
      .maybeSingle();

    if (latestBookingError) {
      throw new Error(latestBookingError.message || '결제 확정 상태 재조회에 실패했습니다.');
    }

    const latestStatus = String(latestBooking?.status || '').toLowerCase();
    const latestTid = String(latestBooking?.tid || '').trim();
    const verifiedTid = verificationResult.providerTransactionId.trim();

    if (
      ['paid', 'confirmed', 'completed'].includes(latestStatus) &&
      latestTid === verifiedTid
    ) {
      return { success: true, alreadyProcessed: true };
    }

    const releasedAfterConfirmationRace = await reconcileExplicitReleasedNicePayApproval(params);
    if (releasedAfterConfirmationRace) return releasedAfterConfirmationRace;

    return {
      success: false,
      status: 409,
      error: '결제 처리 중 예약 상태가 변경되었습니다. 운영팀이 결제 상태를 확인합니다.',
    };
  }

  const bookingExperienceMeta = Array.isArray(bookingData.experiences)
    ? bookingData.experiences[0]
    : bookingData.experiences;
  const expTitle = bookingExperienceMeta?.title || 'Locally 체험';
  const resolvedHostId = bookingExperienceMeta?.host_id;
  const guestName = bookingData.contact_name || '게스트';

  await notifyExperiencePaymentConfirmed({
    supabaseAdmin,
    guestId: bookingData.user_id || null,
    hostId: resolvedHostId || null,
    experienceId: bookingData.experience_id || originalBooking.experience_id || null,
    experienceTitle: expTitle,
    guestName,
    guestsCount: Number(bookingData.guests || 1),
    bookingDate: bookingData.date,
    bookingTime: bookingData.time || null,
    guestPaidAmount: Number(bookingData.amount || originalBooking.amount || 0),
    hostBookingAmount: snapshot.totalExperiencePrice,
  });

  insertAdminAlerts({
    title: '체험 예약 결제가 완료되었습니다',
    message: `'${expTitle}' 예약 결제가 완료되었습니다. 게스트: ${guestName}`,
    link: '/admin/dashboard?tab=LEDGER',
  }).catch((adminAlertError) => {
    console.error('Booking Payment Admin Alert Error:', adminAlertError);
  });

  try {
    await sendAdminPaymentConfirmedEmail({
      domain: 'experience',
      title: expTitle,
      orderId: bookingData.order_id || bookingData.id,
      amount: Number(bookingData.amount || originalBooking.amount || 0),
      paymentMethod: 'card',
      link: '/admin/dashboard?tab=LEDGER',
      customerName: guestName,
    });
  } catch (adminEmailError) {
    console.error('Booking Payment Admin Email Error:', adminEmailError);
  }

  revalidatePath(`/experiences/${originalBooking.experience_id}`);

  return { success: true };
}
