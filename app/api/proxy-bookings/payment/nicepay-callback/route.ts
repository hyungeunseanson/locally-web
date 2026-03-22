import { NextResponse } from 'next/server';

import { getCurrentCardPaymentProvider, verifyApprovedCardPayment } from '@/app/utils/payments/card/server';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import { notifyProxyPaymentEvent } from '@/app/utils/proxyBookingNotifications';
import type { ProxyCategory } from '@/app/types/proxy';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { updateProxyPaymentState } from '@/app/api/admin/proxy-bookings/shared';

type ProxyCardCallbackBody = {
  imp_uid?: string;
  approvalId?: string;
  merchant_uid?: string;
  orderId?: string;
};

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

    const contentType = request.headers.get('content-type') || '';
    let approvalId = '';
    let orderId = '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as ProxyCardCallbackBody;
      approvalId = String(body.imp_uid || body.approvalId || '').trim();
      orderId = String(body.merchant_uid || body.orderId || '').trim();
    } else {
      const formData = await request.formData();
      approvalId =
        formData.get('imp_uid')?.toString().trim() ||
        formData.get('approvalId')?.toString().trim() ||
        '';
      orderId =
        formData.get('merchant_uid')?.toString().trim() ||
        formData.get('orderId')?.toString().trim() ||
        formData.get('moid')?.toString().trim() ||
        '';
    }

    if (!approvalId || !orderId) {
      return NextResponse.json({ success: false, error: 'Missing approvalId or orderId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: originalRequest, error: requestError } = await supabaseAdmin
      .from('proxy_requests')
      .select('*')
      .eq('locally_order_id', orderId)
      .maybeSingle();

    if (requestError || !originalRequest) {
      return NextResponse.json({ success: false, error: '요청 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (originalRequest.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (originalRequest.payment_channel !== 'LOCALLY') {
      return NextResponse.json({ success: false, error: '로컬리 결제 요청만 처리할 수 있습니다.' }, { status: 409 });
    }

    if (String(originalRequest.payment_status || '').toUpperCase() === 'COMPLETED') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    let verificationResult;

    try {
      const expectedAmount = getProxyRequestFeeKrw(
        String(originalRequest.category || 'RESTAURANT') as ProxyCategory,
        (originalRequest.form_data as Record<string, unknown> | null | undefined) ?? undefined
      );

      verificationResult = await verifyApprovedCardPayment({
        provider: getCurrentCardPaymentProvider(),
        approvalId,
        orderId,
        expectedAmount,
      });
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const updated = await updateProxyPaymentState({
      supabaseAdmin,
      requestId: originalRequest.id,
      currentPaymentStatus: 'WAITING',
      paymentStatus: 'COMPLETED',
      tid: verificationResult.providerTransactionId,
      paidAt: new Date().toISOString(),
    });

    if (!updated) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    await notifyProxyPaymentEvent({
      event: 'confirmed',
      request: {
        id: originalRequest.id,
        user_id: originalRequest.user_id,
        category: originalRequest.category,
        form_data: originalRequest.form_data,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '결제 처리 중 서버 오류가 발생했습니다.';
    console.error('[proxy-bookings/payment/nicepay-callback] error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
