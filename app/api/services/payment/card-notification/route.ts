import { NextResponse } from 'next/server';

import { finalizeServiceCardPayment } from '@/app/api/services/payment/serviceCardConfirmation';
import {
  getCurrentCardPaymentProvider,
  readCardPaymentNotificationRequest,
  verifyCardPaymentNotification,
} from '@/app/utils/payments/card/server';
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
    let lookupQuery = supabaseAdmin
      .from('service_bookings')
      .select('*, service_requests(user_id, title, city, country, duration_hours, guest_count)');

    if (notification.orderId) {
      lookupQuery = lookupQuery.eq('order_id', notification.orderId);
    } else {
      lookupQuery = lookupQuery.eq('tid', notification.providerTransactionId);
    }

    const { data: serviceBooking, error } = await lookupQuery.maybeSingle();

    if (error || !serviceBooking) {
      return NextResponse.json(
        {
          success: false,
          error: '서비스 예약 정보를 찾을 수 없습니다.',
          orderId: notification.orderId,
          idempotencyKey: notification.idempotencyKey,
        },
        { status: 404 }
      );
    }

    if (serviceBooking.status === 'PAID' || serviceBooking.status === 'confirmed') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    if (serviceBooking.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: `현재 상태(${serviceBooking.status})에서는 결제를 확정할 수 없습니다.`,
        },
        { status: 409 }
      );
    }

    if ((serviceBooking.payment_method || '').toLowerCase() === 'bank') {
      return NextResponse.json(
        {
          success: false,
          error: '무통장 입금 대기 예약에는 카드 결제를 확정할 수 없습니다.',
        },
        { status: 409 }
      );
    }

    const verificationResult = await verifyCardPaymentNotification({
      notification,
      orderId: serviceBooking.order_id,
      expectedAmount: Number(serviceBooking.amount || 0),
    });

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
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '서비스 결제 통보 처리 중 서버 오류가 발생했습니다.';

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
