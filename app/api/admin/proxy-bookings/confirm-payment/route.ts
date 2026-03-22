import { NextResponse } from 'next/server';

import { recordAuditLog } from '@/app/utils/supabase/admin';
import { notifyProxyPaymentEvent } from '@/app/utils/proxyBookingNotifications';
import { getProxyPaymentMethodOrNull, requireAdminProxyBooking, updateProxyPaymentState } from '@/app/api/admin/proxy-bookings/shared';

type ConfirmPaymentBody = {
  requestId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmPaymentBody;
    if (!body.requestId || typeof body.requestId !== 'string') {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 });
    }

    const access = await requireAdminProxyBooking(body.requestId);
    if ('error' in access) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const { user, supabaseAdmin, proxyRequest } = access;
    const paymentMethod = getProxyPaymentMethodOrNull(proxyRequest.form_data);

    if (proxyRequest.payment_status !== 'WAITING') {
      return NextResponse.json({ success: false, error: '현재 상태에서는 입금 확인할 수 없습니다.' }, { status: 409 });
    }

    if (!(proxyRequest.payment_channel === 'NAVER' || paymentMethod === 'bank')) {
      return NextResponse.json({ success: false, error: '수동 입금 확인이 필요한 요청이 아닙니다.' }, { status: 409 });
    }

    if (proxyRequest.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: '취소된 요청은 입금 확인할 수 없습니다.' }, { status: 409 });
    }

    const updated = await updateProxyPaymentState({
      supabaseAdmin,
      requestId: proxyRequest.id,
      currentPaymentStatus: 'WAITING',
      paymentStatus: 'COMPLETED',
      paidAt: new Date().toISOString(),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: '이미 처리된 결제입니다.' }, { status: 409 });
    }

    await notifyProxyPaymentEvent({
      event: 'confirmed',
      request: proxyRequest,
    });

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_CONFIRM_PROXY_PAYMENT',
      target_type: 'proxy_request',
      target_id: proxyRequest.id,
      details: {
        payment_channel: proxyRequest.payment_channel,
        payment_method: paymentMethod,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    console.error('[ADMIN] proxy confirm-payment error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
