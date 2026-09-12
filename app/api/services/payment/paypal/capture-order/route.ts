import { NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts, sendAdminPaymentConfirmedEmail } from '@/app/utils/adminAlertCenter';
import { capturePayPalOrder, getPayPalOrder } from '@/app/utils/paypal/server';
import { notifyServicePaymentOpened } from '@/app/utils/serviceNotificationFlows';
import { captureServerException } from '@/app/utils/monitoring/sentry';

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
    const bookingId = (body.bookingId || '').trim();
    const paypalOrderId = (body.paypalOrderId || '').trim();

    if (!bookingId || !paypalOrderId) {
      return NextResponse.json(
        { success: false, error: 'Missing bookingId or paypalOrderId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select(
        'id, order_id, request_id, customer_id, amount, status, payment_method, tid, service_requests(title, city, country, duration_hours, guest_count)'
      )
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: '서비스 예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (booking.customer_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const normalizedBookingStatus = String(booking.status || '').toUpperCase();
    const normalizedPaymentMethod = String(booking.payment_method || '').toLowerCase();

    if (booking.status === 'PAID' || booking.status === 'confirmed') {
      if (normalizedPaymentMethod === 'paypal') {
        const { data: healed, error: healError } = await supabaseAdmin
          .rpc('confirm_service_concierge_payment_atomic', {
            p_order_id: booking.order_id,
            p_payment_method: 'paypal',
            p_tid: booking.tid,
          })
          .maybeSingle<{ support_inquiry_id: string }>();
        if (healError || !healed?.support_inquiry_id) {
          return NextResponse.json({ success: false, error: '현지 담당자 문의 연결을 복구하지 못했습니다.' }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          message: 'Already processed',
          supportInquiryId: healed.support_inquiry_id,
          redirectUrl: `/guest/inbox?inquiryId=${encodeURIComponent(healed.support_inquiry_id)}`,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error:
            normalizedPaymentMethod === 'bank'
              ? '무통장 입금 대기 예약에는 PayPal 결제를 확정할 수 없습니다.'
              : normalizedPaymentMethod
                ? 'PayPal 결제 대기 예약만 PayPal 결제를 확정할 수 있습니다.'
                : `현재 상태(${booking.status})에서는 PayPal 결제를 확정할 수 없습니다.`,
        },
        { status: 409 }
      );
    }

    if (normalizedBookingStatus !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `현재 상태(${booking.status})에서는 PayPal 결제를 확정할 수 없습니다.` },
        { status: 409 }
      );
    }

    if (normalizedPaymentMethod && normalizedPaymentMethod !== 'paypal') {
      return NextResponse.json(
        {
          success: false,
          error:
            normalizedPaymentMethod === 'bank'
              ? '무통장 입금 대기 예약에는 PayPal 결제를 확정할 수 없습니다.'
              : 'PayPal 결제 대기 예약만 PayPal 결제를 확정할 수 있습니다.',
        },
        { status: 409 }
      );
    }

    const expectedOrderId = booking.order_id || booking.id;
    const expectedAmount = Number(booking.amount || 0);

    const paypalOrder = await getPayPalOrder(paypalOrderId);
    const purchaseUnit = paypalOrder.purchase_units?.[0];
    const unitOrderId = purchaseUnit?.custom_id || purchaseUnit?.reference_id || '';
    const orderAmount = parsePayPalAmount(purchaseUnit?.amount?.value);

    if (unitOrderId !== expectedOrderId) {
      return NextResponse.json({ success: false, error: 'PayPal 주문 참조가 일치하지 않습니다.' }, { status: 400 });
    }

    if (orderAmount !== expectedAmount) {
      return NextResponse.json({ success: false, error: 'PayPal 주문 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    const captured =
      paypalOrder.status === 'COMPLETED'
        ? {
            orderId: paypalOrder.id,
            status: paypalOrder.status,
            captureId: purchaseUnit?.payments?.captures?.[0]?.id || null,
            amount: purchaseUnit?.payments?.captures?.[0]?.amount || null,
            raw: paypalOrder,
          }
        : await capturePayPalOrder(paypalOrderId);

    const capturedAmount = parsePayPalAmount(captured.amount?.value);
    if (captured.status !== 'COMPLETED' || capturedAmount !== expectedAmount) {
      return NextResponse.json({ success: false, error: 'PayPal 결제 승인 검증에 실패했습니다.' }, { status: 400 });
    }

    const requestInfo =
      booking.service_requests as
        | { title?: string; city?: string; country?: string; duration_hours?: number; guest_count?: number }
        | null;
    const requestTitle = requestInfo?.title || '맞춤 서비스';
    const reqCity = requestInfo?.city ?? '';
    const reqCountry = requestInfo?.country ?? '';
    const reqDuration = requestInfo?.duration_hours ?? 0;
    const reqGuests = requestInfo?.guest_count ?? 0;

    const { data: confirmation, error: confirmationError } = await supabaseAdmin
      .rpc('confirm_service_concierge_payment_atomic', {
        p_order_id: booking.order_id,
        p_payment_method: 'paypal',
        p_tid: captured.captureId,
      })
      .maybeSingle<{ already_processed: boolean; support_inquiry_id: string }>();

    if (confirmationError || !confirmation) {
      throw new Error(`[SERVICE][PAYPAL] Atomic confirmation failed: ${confirmationError?.message || 'empty result'}`);
    }

    if (confirmation.already_processed) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        captureId: captured.captureId,
        bookingId,
        paypalOrderId: captured.orderId,
        supportInquiryId: confirmation.support_inquiry_id,
        redirectUrl: `/guest/inbox?inquiryId=${encodeURIComponent(confirmation.support_inquiry_id)}`,
      });
    }

    await notifyServicePaymentOpened({
      supabaseAdmin,
      requestId: booking.request_id,
      requestTitle,
      requestCity: reqCity,
      requestCountry: reqCountry,
      durationHours: reqDuration,
      guestCount: reqGuests,
      customerId: booking.customer_id,
      supportInquiryId: confirmation.support_inquiry_id,
    });

    insertAdminAlerts({
      title: '서비스 PayPal 결제가 완료되었습니다',
      message: `'${requestTitle}' 서비스 결제가 완료되어 현지 담당자 배정 대기로 전환되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('[SERVICE][PAYPAL] Payment Admin Alert Error:', adminAlertError);
    });

    try {
      await sendAdminPaymentConfirmedEmail({
        domain: 'service',
        title: requestTitle,
        orderId: booking.order_id || booking.id,
        amount: Number(booking.amount || 0),
        paymentMethod: 'paypal',
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
      });
    } catch (adminEmailError) {
      console.error('[SERVICE][PAYPAL] Payment Admin Email Error:', adminEmailError);
    }

    return NextResponse.json({
      success: true,
      captureId: captured.captureId,
      bookingId,
      paypalOrderId: captured.orderId,
      supportInquiryId: confirmation.support_inquiry_id,
      redirectUrl: `/guest/inbox?inquiryId=${encodeURIComponent(confirmation.support_inquiry_id)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    captureServerException(error, { route: '/api/services/payment/paypal/capture-order', method: 'POST' });
    console.error('[PAYPAL][SERVICE] capture-order error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
