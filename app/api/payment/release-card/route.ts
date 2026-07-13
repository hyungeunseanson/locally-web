import { NextResponse } from 'next/server';

import { EXPLICIT_CARD_CHECKOUT_CANCEL_REASON } from '@/app/utils/bookings/pendingBookingHolds';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

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

    const body = (await request.json()) as { orderId?: string };
    const orderId = String(body.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, status, payment_method, tid, cancel_reason')
      .eq('order_id', orderId)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking || booking.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (
      String(booking.status || '').toLowerCase() === 'cancelled' &&
      booking.cancel_reason === EXPLICIT_CARD_CHECKOUT_CANCEL_REASON
    ) {
      return NextResponse.json({ success: true, alreadyReleased: true });
    }

    if (booking.tid || String(booking.status || '').toUpperCase() !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: '이미 결제가 처리되었거나 결제 대기 상태가 아닙니다.' },
        { status: 409 }
      );
    }

    if (String(booking.payment_method || '').toLowerCase() !== 'card') {
      return NextResponse.json(
        { success: false, error: '카드 결제 대기 예약만 해제할 수 있습니다.' },
        { status: 409 }
      );
    }

    const { data: releasedBooking, error: releaseError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancel_reason: EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
        refund_amount: 0,
      })
      .eq('id', booking.id)
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .eq('payment_method', 'card')
      .is('tid', null)
      .select('id')
      .maybeSingle();

    if (releaseError) throw releaseError;
    if (releasedBooking) {
      return NextResponse.json({ success: true });
    }

    const { data: latestBooking, error: latestError } = await supabaseAdmin
      .from('bookings')
      .select('status, tid, cancel_reason')
      .eq('id', booking.id)
      .maybeSingle();

    if (latestError) throw latestError;
    if (
      String(latestBooking?.status || '').toLowerCase() === 'cancelled' &&
      !latestBooking?.tid &&
      latestBooking?.cancel_reason === EXPLICIT_CARD_CHECKOUT_CANCEL_REASON
    ) {
      return NextResponse.json({ success: true, alreadyReleased: true });
    }

    return NextResponse.json(
      { success: false, error: '결제 상태가 변경되어 카드 결제 대기를 해제하지 못했습니다.' },
      { status: 409 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[EXPERIENCE] release-card error:', message);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
