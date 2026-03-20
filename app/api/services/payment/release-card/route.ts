import { NextResponse } from 'next/server';

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

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking } = await supabaseAdmin
      .from('service_bookings')
      .select('id, customer_id, status, payment_method, tid, updated_at')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!booking || booking.customer_id !== user.id || booking.status?.toUpperCase() !== 'PENDING') {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (booking.tid) {
      return NextResponse.json(
        { success: false, error: '이미 결제가 처리된 예약입니다.' },
        { status: 409 }
      );
    }

    const currentMethod = (booking.payment_method || '').toLowerCase();
    if (!currentMethod) {
      return NextResponse.json({ success: true, alreadyReleased: true });
    }

    if (currentMethod === 'bank') {
      return NextResponse.json(
        { success: false, error: '이미 무통장 입금 대기 상태인 예약입니다.' },
        { status: 409 }
      );
    }

    if (currentMethod !== 'card') {
      return NextResponse.json(
        { success: false, error: '현재 결제수단 상태를 해제할 수 없습니다.' },
        { status: 409 }
      );
    }

    const nextUpdatedAt = new Date().toISOString();
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('service_bookings')
      .update({ payment_method: null, updated_at: nextUpdatedAt })
      .eq('order_id', orderId)
      .eq('customer_id', user.id)
      .filter('status', 'ilike', 'PENDING')
      .is('tid', null)
      .eq('payment_method', 'card')
      .eq('updated_at', booking.updated_at)
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedBooking) {
      const { data: latestBooking, error: latestError } = await supabaseAdmin
        .from('service_bookings')
        .select('status, payment_method, tid')
        .eq('order_id', orderId)
        .eq('customer_id', user.id)
        .maybeSingle();

      if (latestError) throw latestError;

      const latestMethod = (latestBooking?.payment_method || '').toLowerCase();
      if (!latestMethod && latestBooking?.status?.toUpperCase() === 'PENDING' && !latestBooking?.tid) {
        return NextResponse.json({ success: true, alreadyReleased: true });
      }

      if (latestMethod === 'bank') {
        return NextResponse.json(
          { success: false, error: '이미 무통장 입금 대기 상태인 예약입니다.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: '카드 결제 시작 상태를 해제하지 못했습니다. 다시 시도해주세요.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SERVICE] release-card error:', msg);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
