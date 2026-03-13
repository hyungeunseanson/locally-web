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
      .from('bookings')
      .select('id, order_id, user_id, amount, status, payment_method, experiences(title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (booking.user_id !== user.id) {
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

    const experienceRelation = booking.experiences as { title?: string } | Array<{ title?: string }> | null;
    const experienceTitle = Array.isArray(experienceRelation)
      ? experienceRelation[0]?.title
      : experienceRelation?.title;

    const paypalOrder = await createPayPalOrder({
      amount,
      currencyCode: 'KRW',
      orderId: booking.order_id || booking.id,
      description: experienceTitle || 'Locally 체험 예약',
    });

    return NextResponse.json({
      success: true,
      paypalOrderId: paypalOrder.id,
      status: paypalOrder.status,
      approveLink: paypalOrder.links?.find((link) => link.rel === 'approve')?.href || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PAYPAL] create-order error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
