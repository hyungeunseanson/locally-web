import { NextResponse } from 'next/server';

import { finalizeExperienceCardPayment } from '@/app/api/payment/experienceCardConfirmation';
import { EXPLICIT_CARD_CHECKOUT_CANCEL_REASON } from '@/app/utils/bookings/pendingBookingHolds';
import { PHASE2_SAFE_RELEASE_REASON } from '@/app/utils/payments/card/nicepayRecovery';
import { getCurrentCardPaymentProvider, queryNicePayPaymentState, verifyApprovedCardPayment, verifyNicePayAuthPayload } from '@/app/utils/payments/card/server';
import { beginNicePayApproval, observeNicePayAuth } from '@/app/utils/payments/card/nicepayRecovery';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import type { VerifiedCardPayment } from '@/app/utils/payments/card/types';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { isTargetedNicePayCloseout } from '@/app/utils/payments/card/targetedCloseoutTargets';

type BookingNicePayCallbackBody = {
  providerPayload?: Record<string, unknown>;
  imp_uid?: string;
  approvalId?: string;
  merchant_uid?: string;
  orderId?: string;
};

export async function POST(request: Request) {
  console.log('🔒 [SECURE] Experience Payment Callback Received');

  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let impUid = '';
    let orderId = '';
    let providerPayload: Record<string, string> = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as BookingNicePayCallbackBody;
      impUid = (body.imp_uid || body.approvalId || '').trim();
      orderId = (body.merchant_uid || body.orderId || '').trim();
      providerPayload = Object.entries({
        ...body,
        ...(body.providerPayload || {}),
      }).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value == null || typeof value === 'object') return acc;
        acc[key] = String(value);
        return acc;
      }, {});
    } else {
      const formData = await request.formData();
      impUid =
        formData.get('imp_uid')?.toString().trim() ||
        formData.get('approvalId')?.toString().trim() ||
        '';
      orderId =
        formData.get('merchant_uid')?.toString().trim() ||
        formData.get('moid')?.toString().trim() ||
        formData.get('orderId')?.toString().trim() ||
        '';
      providerPayload = Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
      );
    }

    if (!impUid || !orderId) {
      return NextResponse.json(
        { success: false, error: 'Missing imp_uid or orderId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: originalBooking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*, experiences (price, private_price, max_guests, host_id, title)')
      .eq('order_id', orderId)
      .maybeSingle();

    if (bookingError || !originalBooking) {
      return NextResponse.json(
        { success: false, error: '예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (originalBooking.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const isExplicitReleasedCardHold =
      String(originalBooking.status || '').toLowerCase() === 'cancelled' &&
      !originalBooking.tid &&
      [EXPLICIT_CARD_CHECKOUT_CANCEL_REASON, PHASE2_SAFE_RELEASE_REASON].includes(String(originalBooking.cancel_reason || ''));
    const isPaidLike = ['paid', 'confirmed', 'completed'].includes(
      String(originalBooking.status || '').toLowerCase()
    );

    if (
      String(originalBooking.status || '').toUpperCase() !== 'PENDING' &&
      !isPaidLike &&
      !isExplicitReleasedCardHold
    ) {
      return NextResponse.json(
        { success: false, error: '이미 처리된 예약이거나 결제 대기 상태가 아닙니다.' },
        { status: 409 }
      );
    }

    const normalizedPaymentMethod = String(originalBooking.payment_method || '').toLowerCase();
    if (normalizedPaymentMethod && normalizedPaymentMethod !== 'card') {
      return NextResponse.json(
        { success: false, error: '카드 결제 대기 예약만 카드 결제를 확정할 수 있습니다.' },
        { status: 409 }
      );
    }

    const expectedOrderId = originalBooking.order_id || originalBooking.id;
    const expectedAmount = Number(originalBooking.amount || 0);

    let verificationResult: VerifiedCardPayment | undefined;
    let approvalGateStarted = false;
    try {
      const storedProvider = String(originalBooking.payment_provider || '').toLowerCase();
      const provider = storedProvider === 'nicepay' || storedProvider === 'portone'
        ? storedProvider
        : getCurrentCardPaymentProvider();
      if (provider === 'nicepay' && !isTargetedNicePayCloseout(expectedOrderId)) {
        const auth = verifyNicePayAuthPayload({
          providerPayload, orderId: expectedOrderId, expectedAmount,
        });
        const { data: durableAttempt, error: attemptError } = await supabaseAdmin
          .from('experience_nicepay_recovery').select('booking_id')
          .eq('booking_id', originalBooking.id).maybeSingle();
        if (attemptError) throw attemptError;
        if (!durableAttempt) {
          // A claim made by the previous Worker may finish during rollout.
          // Never start another approval without the durable Phase 2 gate.
          const state = await queryNicePayPaymentState(auth.tid);
          if (state !== 'approved') {
            return NextResponse.json({ success: false,
              error: '이전 배포에서 시작한 결제 상태를 확인 중입니다. 다시 결제하지 마세요.' }, { status: 503 });
          }
          verificationResult = {
            provider: 'nicepay', approvedAmount: expectedAmount,
            providerTransactionId: auth.tid, raw: { recoveryStatusQuery: 'approved' },
          };
        } else if ((isPaidLike && originalBooking.tid === auth.tid) ||
            (isExplicitReleasedCardHold && originalBooking.cancel_reason === PHASE2_SAFE_RELEASE_REASON)) {
          const state = await queryNicePayPaymentState(auth.tid);
          if (state !== 'approved') throw new Error('완료된 예약과 NICEPAY 상태가 일치하지 않습니다.');
          verificationResult = {
            provider: 'nicepay', approvedAmount: expectedAmount,
            providerTransactionId: auth.tid, raw: { recoveryStatusQuery: 'approved' },
          };
        } else {
          await observeNicePayAuth({
            client: supabaseAdmin, bookingId: originalBooking.id,
            orderId: expectedOrderId, tid: auth.tid, mid: auth.mid, amount: auth.amount,
          });
          const gate = await beginNicePayApproval({
            client: supabaseAdmin, bookingId: originalBooking.id, tid: auth.tid,
          });
          if (gate !== 'started') {
            const state = await queryNicePayPaymentState(auth.tid);
            if (state !== 'approved') {
              return NextResponse.json({ success: false, error: '승인 상태를 확인 중입니다. 다시 결제하지 마세요.' }, { status: 503 });
            }
            verificationResult = {
              provider: 'nicepay', approvedAmount: expectedAmount,
              providerTransactionId: auth.tid, raw: { recoveryStatusQuery: 'approved' },
            };
          } else {
            approvalGateStarted = true;
          }
        }
      }
      if (!verificationResult) {
        verificationResult = await verifyApprovedCardPayment({
          provider,
          approvalId: impUid,
          orderId: expectedOrderId,
          expectedAmount,
          providerPayload,
        });
      }
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: approvalGateStarted ? '승인 결과 확인 중입니다. 다시 결제하지 마세요.' : message }, { status: approvalGateStarted ? 503 : 400 });
    }

    const confirmationResult = await finalizeExperienceCardPayment({
      supabaseAdmin,
      originalBooking,
      verificationResult,
    });

    if (!confirmationResult.success) {
      return NextResponse.json(
        { success: false, error: confirmationResult.error },
        { status: confirmationResult.status }
      );
    }

    if (confirmationResult.alreadyProcessed) {
      if (confirmationResult.cancelledAndRefunded) {
        return NextResponse.json(
          { success: false, error: '결제가 취소되어 승인 금액을 자동 환불했습니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    if (confirmationResult.cancelledAndRefunded) {
      return NextResponse.json(
        { success: false, error: '결제가 취소되어 승인 금액을 자동 환불했습니다.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '결제 처리 중 서버 오류가 발생했습니다.';
    captureServerException(error, { route: '/api/payment/nicepay-callback', method: 'POST' });
    console.error('🔥 [DEBUG] Experience payment callback error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
