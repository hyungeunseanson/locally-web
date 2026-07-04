import { NextResponse } from 'next/server';

import { finalizeExperienceCardPayment } from '@/app/api/payment/experienceCardConfirmation';
import { finalizeProxyCardPayment } from '@/app/api/proxy-bookings/payment/proxyCardConfirmation';
import { finalizeServiceCardPayment } from '@/app/api/services/payment/serviceCardConfirmation';
import { isConfirmedBookingStatus } from '@/app/constants/bookingStatus';
import type { ProxyCategory } from '@/app/types/proxy';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';
import {
  getCurrentCardPaymentProvider,
  readCardPaymentNotificationRequest,
  verifyCardPaymentNotification,
} from '@/app/utils/payments/card/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

type NotificationTarget = 'experience' | 'service' | 'proxy';

function buildNotificationOkResponse() {
  return new NextResponse('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildIgnoredResponse(params: {
  provider: string;
  idempotencyKey: string | null;
  orderId: string | null;
}) {
  return NextResponse.json(
    {
      success: true,
      ignored: true,
      provider: params.provider,
      idempotencyKey: params.idempotencyKey,
      orderId: params.orderId,
    },
    { status: 202 }
  );
}

function buildMissingAnchorResponse(params: {
  provider: string;
}) {
  return NextResponse.json(
    {
      success: false,
      error: 'Missing orderId or providerTransactionId',
      provider: params.provider,
    },
    { status: 400 }
  );
}

function buildNotFoundResponse(params: {
  target: NotificationTarget | 'auto';
  orderId: string | null;
  idempotencyKey: string | null;
}) {
  const errorByTarget: Record<NotificationTarget | 'auto', string> = {
    auto: '결제 통보 대상 주문을 찾을 수 없습니다.',
    experience: '예약 정보를 찾을 수 없습니다.',
    service: '서비스 예약 정보를 찾을 수 없습니다.',
    proxy: '요청 정보를 찾을 수 없습니다.',
  };

  return NextResponse.json(
    {
      success: false,
      error: errorByTarget[params.target],
      orderId: params.orderId,
      idempotencyKey: params.idempotencyKey,
    },
    { status: 404 }
  );
}

function getAutoDispatchTargets(orderId: string | null): NotificationTarget[] {
  if (orderId?.startsWith('SVC-')) {
    return ['service', 'experience', 'proxy'];
  }

  if (orderId?.startsWith('LOCALLY-PROXY-')) {
    return ['proxy', 'experience', 'service'];
  }

  return ['experience', 'service', 'proxy'];
}

async function processExperienceNotification(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  notification: Awaited<ReturnType<typeof readCardPaymentNotificationRequest>>;
}) {
  const { supabaseAdmin, notification } = params;

  let lookupQuery = supabaseAdmin
    .from('bookings')
    .select('*, experiences (price, private_price, max_guests, host_id, title)');

  if (notification.orderId) {
    lookupQuery = lookupQuery.eq('order_id', notification.orderId);
  } else {
    lookupQuery = lookupQuery.eq('tid', notification.providerTransactionId);
  }

  const { data: booking, error } = await lookupQuery.maybeSingle();

  if (error) {
    throw new Error(error.message || '예약 조회 중 오류가 발생했습니다.');
  }

  if (!booking) {
    return null;
  }

  if (isConfirmedBookingStatus(String(booking.status || ''))) {
    return buildNotificationOkResponse();
  }

  if (String(booking.status || '').toUpperCase() !== 'PENDING') {
    return NextResponse.json(
      {
        success: false,
        error: '이미 처리된 예약이거나 결제 대기 상태가 아닙니다.',
      },
      { status: 409 }
    );
  }

  const normalizedPaymentMethod = String(booking.payment_method || '').toLowerCase();
  if (normalizedPaymentMethod && normalizedPaymentMethod !== 'card') {
    return NextResponse.json(
      {
        success: false,
        error: '카드 결제 대기 예약만 카드 결제를 확정할 수 있습니다.',
      },
      { status: 409 }
    );
  }

  const verificationResult = await verifyCardPaymentNotification({
    notification,
    orderId: booking.order_id || booking.id,
    expectedAmount: Number(booking.amount || 0),
  });

  const confirmationResult = await finalizeExperienceCardPayment({
    supabaseAdmin,
    originalBooking: booking,
    verificationResult,
  });

  if (!confirmationResult.success) {
    return NextResponse.json(
      { success: false, error: confirmationResult.error },
      { status: confirmationResult.status }
    );
  }

  if (confirmationResult.alreadyProcessed) {
    return buildNotificationOkResponse();
  }

  return buildNotificationOkResponse();
}

async function processServiceNotification(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  notification: Awaited<ReturnType<typeof readCardPaymentNotificationRequest>>;
}) {
  const { supabaseAdmin, notification } = params;

  let lookupQuery = supabaseAdmin
    .from('service_bookings')
    .select('*, service_requests(user_id, title, city, country, duration_hours, guest_count)');

  if (notification.orderId) {
    lookupQuery = lookupQuery.eq('order_id', notification.orderId);
  } else {
    lookupQuery = lookupQuery.eq('tid', notification.providerTransactionId);
  }

  const { data: serviceBooking, error } = await lookupQuery.maybeSingle();

  if (error) {
    throw new Error(error.message || '서비스 예약 조회 중 오류가 발생했습니다.');
  }

  if (!serviceBooking) {
    return null;
  }

  if (isConfirmedBookingStatus(String(serviceBooking.status || ''))) {
    return buildNotificationOkResponse();
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
    return buildNotificationOkResponse();
  }

  return buildNotificationOkResponse();
}

async function processProxyNotification(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  notification: Awaited<ReturnType<typeof readCardPaymentNotificationRequest>>;
}) {
  const { supabaseAdmin, notification } = params;

  let lookupQuery = supabaseAdmin.from('proxy_requests').select('*');

  if (notification.orderId) {
    lookupQuery = lookupQuery.eq('locally_order_id', notification.orderId);
  } else {
    lookupQuery = lookupQuery.eq('tid', notification.providerTransactionId);
  }

  const { data: proxyRequest, error } = await lookupQuery.maybeSingle();

  if (error) {
    throw new Error(error.message || '전화 예약 요청 조회 중 오류가 발생했습니다.');
  }

  if (!proxyRequest) {
    return null;
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
    return buildNotificationOkResponse();
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
    return buildNotificationOkResponse();
  }

  return buildNotificationOkResponse();
}

export async function handleNicePayCardNotification(
  request: Request,
  options?: {
    target?: NotificationTarget | 'auto';
  }
) {
  const notification = await readCardPaymentNotificationRequest(request);

  if (getCurrentCardPaymentProvider() !== 'nicepay') {
    return buildIgnoredResponse({
      provider: notification.provider,
      idempotencyKey: notification.idempotencyKey,
      orderId: notification.orderId,
    });
  }

  if (!notification.orderId && !notification.providerTransactionId) {
    return buildMissingAnchorResponse({
      provider: notification.provider,
    });
  }

  const target = options?.target || 'auto';
  const supabaseAdmin = createAdminClient();
  const dispatchTargets =
    target === 'auto' ? getAutoDispatchTargets(notification.orderId) : [target];

  try {
    for (const candidate of dispatchTargets) {
      const response =
        candidate === 'experience'
          ? await processExperienceNotification({ supabaseAdmin, notification })
          : candidate === 'service'
            ? await processServiceNotification({ supabaseAdmin, notification })
            : await processProxyNotification({ supabaseAdmin, notification });

      if (response) {
        return response;
      }
    }

    return buildNotFoundResponse({
      target,
      orderId: notification.orderId,
      idempotencyKey: notification.idempotencyKey,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '결제 통보 처리 중 서버 오류가 발생했습니다.';

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
