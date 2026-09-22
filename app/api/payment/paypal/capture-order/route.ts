import { NextResponse } from 'next/server';

import {
  confirmExperiencePayment,
  runExperiencePaymentConfirmationSideEffects,
} from '@/app/utils/bookings/confirmExperiencePayment';
import {
  beginExperiencePaymentCaptureAtomic,
  ExperiencePaymentContractError,
} from '@/app/utils/bookings/experiencePaymentClaims';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { capturePayPalOrder, getPayPalOrder } from '@/app/utils/paypal/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type CaptureOrderBody = {
  bookingId?: string;
  paypalOrderId?: string;
};

function parsePayPalAmount(value: string | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CaptureOrderBody;
    const bookingId = String(body.bookingId || '').trim();
    const paypalOrderId = String(body.paypalOrderId || '').trim();
    if (!bookingId || !paypalOrderId) {
      return NextResponse.json(
        { success: false, error: 'Missing bookingId or paypalOrderId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, order_id, user_id, amount, status, payment_method')
      .eq('id', bookingId)
      .maybeSingle();
    if (bookingError || !booking) {
      throw new ExperiencePaymentContractError(404, 'PAYMENT_CAPTURE_BOOKING_LOOKUP_FAILED');
    }
    if (booking.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const bookingStatus = String(booking.status || '').toLowerCase();
    if (!['pending', 'paid', 'confirmed', 'completed'].includes(bookingStatus)) {
      return NextResponse.json(
        { success: false, error: `현재 상태(${booking.status})에서는 PayPal 결제를 확정할 수 없습니다.` },
        { status: 409 }
      );
    }
    const paymentMethod = String(booking.payment_method || '').toLowerCase();
    if (paymentMethod === 'bank') {
      return NextResponse.json(
        { success: false, error: '무통장 입금 대기 예약에는 PayPal 결제를 확정할 수 없습니다.' },
        { status: 409 }
      );
    }
    if (paymentMethod && paymentMethod !== 'paypal') {
      return NextResponse.json(
        { success: false, error: 'PayPal 결제 대기 예약만 PayPal 결제를 확정할 수 있습니다.' },
        { status: 409 }
      );
    }

    const captureClaim = await beginExperiencePaymentCaptureAtomic({
      supabaseAdmin,
      bookingId,
      userId: user.id,
      providerReference: paypalOrderId,
    });

    const expectedOrderId = booking.order_id || booking.id;
    const expectedAmount = Number(booking.amount || 0);
    const paypalOrder = await getPayPalOrder(paypalOrderId);
    const purchaseUnit = paypalOrder.purchase_units?.[0];
    const unitOrderId = purchaseUnit?.custom_id || purchaseUnit?.reference_id || '';
    const orderAmount = parsePayPalAmount(purchaseUnit?.amount?.value);

    if (unitOrderId !== expectedOrderId || orderAmount !== expectedAmount) {
      return NextResponse.json(
        { success: false, error: 'PayPal 주문 정보가 예약과 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (captureClaim.outcome === 'already_processing' && paypalOrder.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'PayPal 결제 승인이 이미 처리 중입니다.' },
        { status: 409 }
      );
    }

    const captured = paypalOrder.status === 'COMPLETED'
      ? {
          orderId: paypalOrder.id,
          status: paypalOrder.status,
          captureId: purchaseUnit?.payments?.captures?.[0]?.id || null,
          amount: purchaseUnit?.payments?.captures?.[0]?.amount || null,
        }
      : await capturePayPalOrder(paypalOrderId);

    const capturedAmount = parsePayPalAmount(captured.amount?.value);
    const captureId = String(captured.captureId || '').trim();
    if (captured.status !== 'COMPLETED' || capturedAmount !== expectedAmount || !captureId) {
      return NextResponse.json(
        { success: false, error: 'PayPal 결제 승인 검증에 실패했습니다.' },
        { status: 400 }
      );
    }

    const confirmation = await confirmExperiencePayment({
      supabaseAdmin,
      bookingId,
      provider: 'paypal',
      providerReference: paypalOrderId,
      providerTransactionId: captureId,
      verifiedAmount: capturedAmount,
    });

    if (confirmation.outcome === 'confirmed_now') {
      await runExperiencePaymentConfirmationSideEffects({
        supabaseAdmin,
        booking: confirmation.booking,
        paymentMethod: 'paypal',
      });
    }

    return NextResponse.json({
      success: true,
      captureId,
      paypalOrderId: captured.orderId,
      alreadyProcessed: confirmation.outcome === 'already_processed',
    });
  } catch (error: unknown) {
    if (error instanceof ExperiencePaymentContractError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.diagnosticCode },
        { status: error.status }
      );
    }

    captureServerException(error, { route: '/api/payment/paypal/capture-order', method: 'POST' });
    console.error(JSON.stringify({
      event: 'experience_paypal_capture',
      status: 'failed',
      diagnosticCode: 'provider_or_internal_error',
    }));
    return NextResponse.json(
      { success: false, error: 'PayPal 결제 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
