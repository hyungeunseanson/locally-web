import { NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createPayPalOrder } from '@/app/utils/paypal/server';

type CreateOrderBody = {
  bookingId?: string;
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

    const body = (await request.json()) as CreateOrderBody;
    const bookingId = (body.bookingId || '').trim();

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Missing bookingId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select('id, order_id, customer_id, amount, status, payment_method, service_requests(title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: '서비스 예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (booking.customer_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (String(booking.status).toUpperCase() !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: '이미 처리된 예약이거나 결제 대기 상태가 아닙니다.' },
        { status: 409 }
      );
    }

    if ((booking.payment_method || '').toLowerCase() === 'bank') {
      return NextResponse.json(
        { success: false, error: '무통장 예약에는 PayPal 결제를 시작할 수 없습니다.' },
        { status: 400 }
      );
    }

    const amount = Number(booking.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: '유효하지 않은 결제 금액입니다.' }, { status: 400 });
    }

    const serviceRequestRelation =
      booking.service_requests as { title?: string } | Array<{ title?: string }> | null;
    const requestTitle = Array.isArray(serviceRequestRelation)
      ? serviceRequestRelation[0]?.title
      : serviceRequestRelation?.title;

    const paypalOrder = await createPayPalOrder({
      amount,
      currencyCode: 'KRW',
      orderId: booking.order_id || booking.id,
      description: requestTitle || 'Locally 맞춤 서비스 결제',
    });

    return NextResponse.json({
      success: true,
      paypalOrderId: paypalOrder.id,
      status: paypalOrder.status,
      approveLink: paypalOrder.links?.find((link) => link.rel === 'approve')?.href || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PAYPAL][SERVICE] create-order error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
