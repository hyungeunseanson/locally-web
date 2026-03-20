import { NextResponse } from 'next/server';

import { readCardPaymentNotificationRequest } from '@/app/utils/payments/card/server';

export async function POST(request: Request) {
  const notification = await readCardPaymentNotificationRequest(request);

  // Reserved for the NICEPAY direct cutover.
  // Idempotency should continue to key off orderId first, then providerTransactionId.
  // service_bookings and service_requests status updates should stay inside the existing service callback flow.
  return NextResponse.json(
    {
      success: false,
      error: 'Service card payment notification handler is reserved for the NICEPAY cutover phase.',
      provider: notification.provider,
      idempotencyKey: notification.idempotencyKey,
      orderId: notification.orderId,
    },
    { status: 501 }
  );
}
