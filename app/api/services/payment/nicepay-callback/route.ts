import { NextResponse } from 'next/server';

import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { getCurrentCardPaymentProvider, verifyApprovedCardPayment } from '@/app/utils/payments/card/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { notifyServicePaymentOpened } from '@/app/utils/serviceNotificationFlows';

type ServiceNicePayCallbackBody = {
  imp_uid?: string;
  approvalId?: string;
  merchant_uid?: string;
  orderId?: string;
};

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
    const impUid = (body.imp_uid || body.approvalId || '').trim();
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
      .select('*, service_requests(user_id, title, city, country, duration_hours, guest_count)')
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

    let verificationResult;
    try {
      verificationResult = await verifyApprovedCardPayment({
        provider: getCurrentCardPaymentProvider(),
        approvalId: impUid,
        orderId: serviceBooking.order_id,
        expectedAmount: Number(serviceBooking.amount || 0),
      });
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const requestInfo =
      serviceBooking.service_requests as
        | { title?: string; city?: string; country?: string; duration_hours?: number; guest_count?: number }
        | null;
    const requestTitle = requestInfo?.title || '맞춤 서비스';
    const reqCity = requestInfo?.city ?? '';
    const reqCountry = requestInfo?.country ?? '';
    const reqDuration = requestInfo?.duration_hours ?? 0;
    const reqGuests = requestInfo?.guest_count ?? 0;

    // [Race Guard] PENDING 상태일 때만 업데이트 — 중복 처리 방지
    const { data: updatedBooking, error: bookingUpdateErr } = await supabaseAdmin
      .from('service_bookings')
      .update({
        status: 'PAID',
        payment_method: 'card',
        tid: verificationResult.providerTransactionId,
      })
      .eq('order_id', orderId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (bookingUpdateErr) {
      throw new Error(`[SERVICE] Booking update failed: ${bookingUpdateErr.message}`);
    }
    if (!updatedBooking) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    const { error: requestUpdateErr } = await supabaseAdmin
      .from('service_requests')
      .update({ status: 'open' })
      .eq('id', serviceBooking.request_id);

    if (requestUpdateErr) {
      console.error('[SERVICE] Request status update failed:', requestUpdateErr);
    }

    await notifyServicePaymentOpened({
      supabaseAdmin,
      requestId: serviceBooking.request_id,
      requestTitle,
      requestCity: reqCity,
      requestCountry: reqCountry,
      durationHours: reqDuration,
      guestCount: reqGuests,
      customerId: serviceBooking.customer_id,
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
    captureServerException(error, { route: '/api/services/payment/nicepay-callback', method: 'POST' });
    console.error('[SERVICE] Payment Callback Error:', errMsg);
    return NextResponse.json(
      { success: false, error: '결제 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
