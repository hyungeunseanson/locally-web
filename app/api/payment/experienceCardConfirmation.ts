import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import {
  confirmExperiencePayment,
  runExperiencePaymentConfirmationSideEffects,
} from '@/app/utils/bookings/confirmExperiencePayment';
import { ExperiencePaymentContractError } from '@/app/utils/bookings/experiencePaymentClaims';
import {
  CARD_APPROVAL_RELEASE_RACE_LOCK_REASON,
  CARD_APPROVAL_RELEASE_RACE_REFUNDED_REASON,
  EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
} from '@/app/utils/bookings/pendingBookingHolds';
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
  payment_claim_state?: string | null;
  payment_provider?: string | null;
  payment_provider_reference?: string | null;
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
  const expectedReference = originalBooking.order_id || originalBooking.id;
  const { data: latestBooking, error: latestBookingError } = await supabaseAdmin
    .from('bookings')
    .select('status, tid, cancel_reason, refund_amount, payment_claim_state, payment_provider, payment_provider_reference')
    .eq('id', originalBooking.id)
    .maybeSingle();

  if (latestBookingError) {
    throw new Error('결제 확정 상태 재조회에 실패했습니다.');
  }

  const latestStatus = String(latestBooking?.status || '').toLowerCase();
  const latestTid = String(latestBooking?.tid || '').trim();
  const exactAttempt =
    latestBooking?.payment_provider === verificationResult.provider &&
    latestBooking?.payment_provider_reference === expectedReference;

  if (
    latestStatus === 'cancelled' &&
    latestTid === verifiedTid &&
    exactAttempt &&
    latestBooking?.cancel_reason === CARD_APPROVAL_RELEASE_RACE_REFUNDED_REASON &&
    Number(latestBooking.refund_amount || 0) >= verificationResult.approvedAmount
  ) {
    return { success: true, alreadyProcessed: true, cancelledAndRefunded: true };
  }

  if (
    latestStatus !== 'cancelled' ||
    latestTid ||
    !exactAttempt ||
    latestBooking?.payment_claim_state !== 'released' ||
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
    .eq('payment_claim_state', 'released')
    .eq('payment_provider', verificationResult.provider)
    .eq('payment_provider_reference', expectedReference)
    .is('tid', null)
    .select('id')
    .maybeSingle();

  if (raceLockError) {
    throw new Error('결제 승인취소 경합 잠금에 실패했습니다.');
  }
  if (!raceLock) return null;

  try {
    await cancelCardPayment({
      providerTransactionId: verifiedTid,
      orderId: expectedReference,
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
      throw new Error('승인취소는 완료됐지만 예약 상태를 갱신하지 못했습니다.');
    }

    await insertAdminAlerts({
      title: '카드 결제 승인·취소 경합을 자동 정리했습니다',
      message: `예약 ${expectedReference}: 승인 직후 결제창 취소가 감지되어 전액 승인취소했습니다.`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch(() => undefined);

    return { success: true, cancelledAndRefunded: true };
  } catch (refundError) {
    await insertAdminAlerts({
      title: '[긴급] 카드 승인 후 자동 승인취소 처리 확인 필요',
      message: `예약 ${expectedReference}: 결제 승인·취소 경합 자동 정리를 완료하지 못했습니다. NICEPAY 거래내역과 예약 상태를 확인해주세요.`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch(() => undefined);
    throw refundError;
  }
}

export async function finalizeExperienceCardPayment(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  originalBooking: ExperienceCardBookingRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ExperienceCardConfirmationResult> {
  const releasedApprovalResolution = await reconcileExplicitReleasedNicePayApproval(params);
  if (releasedApprovalResolution) return releasedApprovalResolution;

  try {
    const confirmation = await confirmExperiencePayment({
      supabaseAdmin: params.supabaseAdmin,
      bookingId: params.originalBooking.id,
      provider: params.verificationResult.provider,
      providerReference: params.originalBooking.order_id || params.originalBooking.id,
      providerTransactionId: params.verificationResult.providerTransactionId,
      verifiedAmount: params.verificationResult.approvedAmount,
    });

    if (confirmation.outcome === 'already_processed') {
      return { success: true, alreadyProcessed: true };
    }

    await runExperiencePaymentConfirmationSideEffects({
      supabaseAdmin: params.supabaseAdmin,
      booking: confirmation.booking,
      paymentMethod: 'card',
    });
    return { success: true };
  } catch (error) {
    const releasedAfterConfirmationRace = await reconcileExplicitReleasedNicePayApproval(params);
    if (releasedAfterConfirmationRace) return releasedAfterConfirmationRace;

    if (error instanceof ExperiencePaymentContractError) {
      return {
        success: false,
        status: error.status === 404 ? 404 : 409,
        error: error.message,
      };
    }
    throw error;
  }
}
