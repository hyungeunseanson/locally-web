import { NextResponse } from 'next/server';

import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { getPortOnePayment } from '@/app/utils/portone/server';
import { getEligibleServiceHostIds } from '@/app/utils/serviceHostNotifications';

type ServiceNicePayCallbackBody = {
  imp_uid?: string;
  merchant_uid?: string;
  orderId?: string;
};

function parsePortOneAmount(value: number | string | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: Request) {
  console.log('🔒 [SERVICE] Payment Callback Received');

  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ServiceNicePayCallbackBody;
    const impUid = (body.imp_uid || '').trim();
    const orderId = (body.merchant_uid || body.orderId || '').trim();

    if (!impUid || !orderId) {
      return NextResponse.json(
        { success: false, error: 'Missing imp_uid or orderId' },
        { status: 400 }
      );
    }

    if (!orderId.startsWith('SVC-')) {
      console.error(`[SERVICE CALLBACK] Invalid order prefix: ${orderId}`);
      return NextResponse.json({ success: false, error: 'Invalid order type' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: serviceBooking, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select('*, service_requests(user_id, title, city, duration_hours, guest_count)')
      .eq('order_id', orderId)
      .maybeSingle();

    if (bookingError || !serviceBooking) {
      return NextResponse.json(
        { success: false, error: '서비스 예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (serviceBooking.customer_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (serviceBooking.status === 'PAID' || serviceBooking.status === 'confirmed') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    if (serviceBooking.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `현재 상태(${serviceBooking.status})에서는 결제를 확정할 수 없습니다.` },
        { status: 409 }
      );
    }

    if ((serviceBooking.payment_method || '').toLowerCase() === 'bank') {
      return NextResponse.json(
        { success: false, error: '무통장 입금 대기 예약에는 카드 결제를 확정할 수 없습니다.' },
        { status: 409 }
      );
    }

    const payment = await getPortOnePayment(impUid);
    const verifiedMerchantUid = String(payment.merchant_uid || '').trim();
    const verifiedAmount = parsePortOneAmount(payment.amount);

    if (String(payment.status || '').toLowerCase() !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'PortOne 결제 상태가 paid가 아닙니다.' },
        { status: 400 }
      );
    }

    if (verifiedMerchantUid !== serviceBooking.order_id) {
      return NextResponse.json(
        { success: false, error: 'PortOne 주문번호가 서비스 예약과 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (verifiedAmount !== Number(serviceBooking.amount || 0)) {
      return NextResponse.json(
        { success: false, error: 'PortOne 결제 금액이 서비스 예약 금액과 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    const requestInfo =
      serviceBooking.service_requests as
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
        payment_method: 'card',
        tid: payment.pg_tid || payment.imp_uid || impUid,
      })
      .eq('order_id', orderId);

    if (bookingUpdateErr) {
      throw new Error(`[SERVICE] Booking update failed: ${bookingUpdateErr.message}`);
    }

    const { error: requestUpdateErr } = await supabaseAdmin
      .from('service_requests')
      .update({ status: 'open' })
      .eq('id', serviceBooking.request_id);

    if (requestUpdateErr) {
      console.error('[SERVICE] Request status update failed:', requestUpdateErr);
    }

    void (async () => {
      try {
        const hostIds = await getEligibleServiceHostIds(supabaseAdmin, {
          requestCity: reqCity,
          customerId: serviceBooking.customer_id,
        });
        if (hostIds.length === 0) return;

        const notifications = hostIds.map((hostId) => ({
          user_id: hostId,
          type: 'service_request_new',
          title: `📋 새로운 맞춤 서비스 의뢰 — ${reqCity}`,
          message: `${requestTitle} (${reqDuration}시간, ${reqGuests}명)`,
          link: `/services/${serviceBooking.request_id}`,
          is_read: false,
        }));

        const { error: notiErr } = await supabaseAdmin.from('notifications').insert(notifications);
        if (notiErr) console.error('[SERVICE] Host Notification Error:', notiErr);
      } catch (hostNotificationError) {
        console.error('[SERVICE] eligible host notification error:', hostNotificationError);
      }
    })();

    supabaseAdmin
      .from('notifications')
      .insert({
        user_id: serviceBooking.customer_id,
        type: 'service_payment_confirmed',
        title: '✅ 결제 완료! 호스트 모집이 시작됩니다',
        message: `'${requestTitle}' 결제가 완료되었습니다. 현지 호스트들의 지원이 시작됩니다.`,
        link: `/services/${serviceBooking.request_id}`,
        is_read: false,
      })
      .then(({ error }) => {
        if (error) console.error('[SERVICE] Payment Notification Error:', error);
      });

    insertAdminAlerts({
      title: '서비스 결제가 완료되었습니다',
      message: `'${requestTitle}' 서비스 결제가 완료되어 호스트 모집이 시작되었습니다.`,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('[SERVICE] Payment Admin Alert Error:', adminAlertError);
    });

    console.log(`✅ [SERVICE] Payment confirmed. Order: ${orderId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[SERVICE] Payment Callback Error:', errMsg);
    return NextResponse.json(
      { success: false, error: '결제 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
