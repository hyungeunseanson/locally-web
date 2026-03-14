import { NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { capturePayPalOrder, getPayPalOrder } from '@/app/utils/paypal/server';
import { getEligibleServiceHostIds } from '@/app/utils/serviceHostNotifications';

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
      .select('*, service_requests(user_id, title, city, duration_hours, guest_count)')
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

    if (booking.status === 'PAID' || booking.status === 'confirmed') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    if ((booking.payment_method || '').toLowerCase() === 'bank') {
      return NextResponse.json(
        { success: false, error: '무통장 입금 대기 예약에는 PayPal 결제를 확정할 수 없습니다.' },
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
        | { title?: string; city?: string; duration_hours?: number; guest_count?: number }
        | null;
    const requestTitle = requestInfo?.title || '맞춤 서비스';
    const reqCity = requestInfo?.city ?? '';
    const reqDuration = requestInfo?.duration_hours ?? 0;
    const reqGuests = requestInfo?.guest_count ?? 0;

    const { error: bookingUpdateErr } = await supabaseAdmin
      .from('service_bookings')
      .update({
        status: 'PAID',
        payment_method: 'paypal',
        tid: captured.captureId,
      })
      .eq('id', bookingId);

    if (bookingUpdateErr) {
      throw new Error(`[SERVICE][PAYPAL] Booking update failed: ${bookingUpdateErr.message}`);
    }

    const { error: requestUpdateErr } = await supabaseAdmin
      .from('service_requests')
      .update({ status: 'open' })
      .eq('id', booking.request_id);

    if (requestUpdateErr) {
      console.error('[SERVICE][PAYPAL] Request status update failed:', requestUpdateErr);
    }

    void (async () => {
      try {
        const hostIds = await getEligibleServiceHostIds(supabaseAdmin, {
          requestCity: reqCity,
          customerId: booking.customer_id,
        });
        if (hostIds.length === 0) return;

        const notifications = hostIds.map((hostId) => ({
          user_id: hostId,
          type: 'service_request_new',
          title: `📋 새로운 맞춤 서비스 의뢰 — ${reqCity}`,
          message: `${requestTitle} (${reqDuration}시간, ${reqGuests}명)`,
          link: `/services/${booking.request_id}`,
          is_read: false,
        }));

        const { error: notiErr } = await supabaseAdmin.from('notifications').insert(notifications);
        if (notiErr) console.error('[SERVICE][PAYPAL] Host Notification Error:', notiErr);
      } catch (hostNotificationError) {
        console.error('[SERVICE][PAYPAL] eligible host notification error:', hostNotificationError);
      }
    })();

    supabaseAdmin
      .from('notifications')
      .insert({
        user_id: booking.customer_id,
        type: 'service_payment_confirmed',
        title: '✅ 결제 완료! 호스트 모집이 시작됩니다',
        message: `'${requestTitle}' 결제가 완료되었습니다. 현지 호스트들의 지원이 시작됩니다.`,
        link: `/services/${booking.request_id}`,
        is_read: false,
      })
      .then(({ error }) => {
        if (error) console.error('[SERVICE][PAYPAL] Customer Notification Error:', error);
      });

    insertAdminAlerts({
      title: '서비스 PayPal 결제가 완료되었습니다',
      message: `'${requestTitle}' 서비스 결제가 완료되어 호스트 모집이 시작되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('[SERVICE][PAYPAL] Payment Admin Alert Error:', adminAlertError);
    });

    return NextResponse.json({
      success: true,
      captureId: captured.captureId,
      bookingId,
      paypalOrderId: captured.orderId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PAYPAL][SERVICE] capture-order error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
