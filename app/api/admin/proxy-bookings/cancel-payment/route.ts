import { NextResponse } from 'next/server';

import { recordAuditLog } from '@/app/utils/supabase/admin';
import { notifyProxyPaymentEvent } from '@/app/utils/proxyBookingNotifications';
import { getProxyPaymentMethodOrNull, requireAdminProxyBooking, updateProxyPaymentState } from '@/app/api/admin/proxy-bookings/shared';

type CancelPaymentBody = {
  requestId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelPaymentBody;
    if (!body.requestId || typeof body.requestId !== 'string') {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 });
    }

    const access = await requireAdminProxyBooking(body.requestId);
    if ('error' in access) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const { user, supabaseAdmin, proxyRequest } = access;

    if (proxyRequest.payment_status !== 'WAITING') {
      return NextResponse.json({ success: false, error: '결제 대기 상태에서만 취소할 수 있습니다.' }, { status: 409 });
    }

    const updated = await updateProxyPaymentState({
      supabaseAdmin,
      requestId: proxyRequest.id,
      currentPaymentStatus: 'WAITING',
      paymentStatus: 'FAILED',
      requestStatus: 'CANCELLED',
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: '이미 처리된 결제입니다.' }, { status: 409 });
    }

    await notifyProxyPaymentEvent({
      event: 'cancelled',
      request: proxyRequest,
    });

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_CANCEL_PROXY_PAYMENT',
      target_type: 'proxy_request',
      target_id: proxyRequest.id,
      details: {
        payment_channel: proxyRequest.payment_channel,
        payment_method: getProxyPaymentMethodOrNull(proxyRequest.form_data),
        reason: body.reason || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    console.error('[ADMIN] proxy cancel-payment error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
