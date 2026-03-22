import { NextResponse } from 'next/server';

import { recordAuditLog } from '@/app/utils/supabase/admin';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import { notifyProxyPaymentEvent } from '@/app/utils/proxyBookingNotifications';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { getProxyPaymentMethodOrNull, requireAdminProxyBooking, updateProxyPaymentState } from '@/app/api/admin/proxy-bookings/shared';

type RefundPaymentBody = {
  requestId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefundPaymentBody;
    if (!body.requestId || typeof body.requestId !== 'string') {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 });
    }

    const access = await requireAdminProxyBooking(body.requestId);
    if ('error' in access) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const { user, supabaseAdmin, proxyRequest } = access;
    const paymentMethod = getProxyPaymentMethodOrNull(proxyRequest.form_data);

    if (proxyRequest.payment_status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: '결제 완료 상태에서만 환불할 수 있습니다.' }, { status: 409 });
    }

    const refundAmount = getProxyRequestFeeKrw(proxyRequest.category, proxyRequest.form_data);

    if (paymentMethod === 'card') {
      const providerTransactionId = typeof proxyRequest.tid === 'string' ? proxyRequest.tid.trim() : '';
      if (!providerTransactionId) {
        return NextResponse.json({ success: false, error: '카드 거래 정보가 없어 자동 환불할 수 없습니다.' }, { status: 409 });
      }

      await cancelCardPayment({
        providerTransactionId,
        orderId: proxyRequest.locally_order_id || proxyRequest.id,
        cancelAmount: refundAmount,
        cancelReason: body.reason || '전화 예약 환불 처리',
        totalAmount: refundAmount,
        requireMerchantKey: true,
        acceptedResultCodes: ['2001', '2030'],
      });
    }

    const updated = await updateProxyPaymentState({
      supabaseAdmin,
      requestId: proxyRequest.id,
      currentPaymentStatus: 'COMPLETED',
      paymentStatus: 'REFUNDED',
      refundedAt: new Date().toISOString(),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: '이미 처리된 결제입니다.' }, { status: 409 });
    }

    await notifyProxyPaymentEvent({
      event: 'refunded',
      request: proxyRequest,
    });

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_REFUND_PROXY_PAYMENT',
      target_type: 'proxy_request',
      target_id: proxyRequest.id,
      details: {
        payment_channel: proxyRequest.payment_channel,
        payment_method: paymentMethod,
        refund_amount: refundAmount,
        reason: body.reason || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    console.error('[ADMIN] proxy refund-payment error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
