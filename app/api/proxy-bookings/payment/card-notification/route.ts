import { NextResponse } from 'next/server';

import { finalizeProxyCardPayment } from '@/app/api/proxy-bookings/payment/proxyCardConfirmation';
import {
  getCurrentCardPaymentProvider,
  readCardPaymentNotificationRequest,
  verifyCardPaymentNotification,
} from '@/app/utils/payments/card/server';
import type { ProxyCategory } from '@/app/types/proxy';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function POST(request: Request) {
  const notification = await readCardPaymentNotificationRequest(request);

  if (getCurrentCardPaymentProvider() !== 'nicepay') {
    return NextResponse.json(
      {
        success: true,
        ignored: true,
        provider: notification.provider,
        idempotencyKey: notification.idempotencyKey,
        orderId: notification.orderId,
      },
      { status: 202 }
    );
  }

  if (!notification.orderId && !notification.providerTransactionId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing orderId or providerTransactionId',
        provider: notification.provider,
      },
      { status: 400 }
    );
  }

  try {
    const supabaseAdmin = createAdminClient();
    let lookupQuery = supabaseAdmin.from('proxy_requests').select('*');

    if (notification.orderId) {
      lookupQuery = lookupQuery.eq('locally_order_id', notification.orderId);
    } else {
      lookupQuery = lookupQuery.eq('tid', notification.providerTransactionId);
    }

    const { data: proxyRequest, error } = await lookupQuery.maybeSingle();

    if (error || !proxyRequest) {
      return NextResponse.json(
        {
          success: false,
          error: '요청 정보를 찾을 수 없습니다.',
          orderId: notification.orderId,
          idempotencyKey: notification.idempotencyKey,
        },
        { status: 404 }
      );
    }

    if (proxyRequest.payment_channel !== 'LOCALLY') {
      return NextResponse.json(
        {
          success: false,
          error: '로컬리 결제 요청만 처리할 수 있습니다.',
        },
        { status: 409 }
      );
    }

    if (String(proxyRequest.payment_status || '').toUpperCase() === 'COMPLETED') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    const verificationResult = await verifyCardPaymentNotification({
      notification,
      orderId: proxyRequest.locally_order_id || proxyRequest.id,
      expectedAmount: getProxyRequestFeeKrw(
        String(proxyRequest.category || 'RESTAURANT') as ProxyCategory,
        (proxyRequest.form_data as Record<string, unknown> | null | undefined) ?? undefined
      ),
    });

    const confirmationResult = await finalizeProxyCardPayment({
      supabaseAdmin,
      proxyRequest,
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
      error instanceof Error ? error.message : '전화 예약 결제 통보 처리 중 서버 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        error: message,
        orderId: notification.orderId,
        idempotencyKey: notification.idempotencyKey,
      },
      { status: 400 }
    );
  }
}
