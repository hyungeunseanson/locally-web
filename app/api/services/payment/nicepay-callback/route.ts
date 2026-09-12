import { NextResponse } from 'next/server';

import { finalizeServiceCardPayment } from '@/app/api/services/payment/serviceCardConfirmation';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { getCurrentCardPaymentProvider, verifyApprovedCardPayment } from '@/app/utils/payments/card/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ServiceNicePayCallbackBody = {
  providerPayload?: Record<string, unknown>;
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

    let impUid = '';
    let orderId = '';
    let providerPayload: Record<string, string> = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as ServiceNicePayCallbackBody;
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
        formData.get('TxTid')?.toString().trim() ||
        '';
      orderId =
        formData.get('merchant_uid')?.toString().trim() ||
        formData.get('orderId')?.toString().trim() ||
        formData.get('Moid')?.toString().trim() ||
        formData.get('moid')?.toString().trim() ||
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
      const { data: healed, error: healError } = await supabaseAdmin
        .rpc('confirm_service_concierge_payment_atomic', {
          p_order_id: serviceBooking.order_id,
          p_payment_method: serviceBooking.payment_method || 'card',
          p_tid: serviceBooking.tid,
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
        providerPayload,
      });
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const confirmationResult = await finalizeServiceCardPayment({
      supabaseAdmin,
      serviceBooking,
      verificationResult,
    });

    if (!confirmationResult.success) {
      return NextResponse.json(
        { success: false, error: confirmationResult.error },
        { status: confirmationResult.status }
      );
    }

    if (confirmationResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        supportInquiryId: confirmationResult.supportInquiryId,
        redirectUrl: confirmationResult.supportInquiryId
          ? `/guest/inbox?inquiryId=${encodeURIComponent(confirmationResult.supportInquiryId)}`
          : `/services/${serviceBooking.request_id}`,
      });
    }

    console.log(`✅ [SERVICE] Payment confirmed. Order: ${orderId}`);
    return NextResponse.json({
      success: true,
      supportInquiryId: confirmationResult.supportInquiryId,
      redirectUrl: confirmationResult.supportInquiryId
        ? `/guest/inbox?inquiryId=${encodeURIComponent(confirmationResult.supportInquiryId)}`
        : `/services/${serviceBooking.request_id}`,
    });
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
