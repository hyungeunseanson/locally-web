import { NextResponse } from 'next/server';

import { finalizeProxyCardPayment } from '@/app/api/proxy-bookings/payment/proxyCardConfirmation';
import { getCurrentCardPaymentProvider, verifyApprovedCardPayment } from '@/app/utils/payments/card/server';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import type { ProxyCategory } from '@/app/types/proxy';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ProxyCardCallbackBody = {
  providerPayload?: Record<string, unknown>;
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
    let providerPayload: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as ProxyCardCallbackBody;
      approvalId = String(body.imp_uid || body.approvalId || '').trim();
      orderId = String(body.merchant_uid || body.orderId || '').trim();
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
      approvalId =
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
        providerPayload,
      });
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const confirmationResult = await finalizeProxyCardPayment({
      supabaseAdmin,
      proxyRequest: originalRequest,
      verificationResult,
    });

    if (!confirmationResult.success) {
      return NextResponse.json(
        { success: false, error: confirmationResult.error },
        { status: confirmationResult.status }
      );
    }

    if (confirmationResult.alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '결제 처리 중 서버 오류가 발생했습니다.';
    console.error('[proxy-bookings/payment/nicepay-callback] error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
