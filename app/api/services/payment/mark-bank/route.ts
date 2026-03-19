import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 본인 소유 PENDING 예약인지 확인
    const { data: booking } = await supabaseAdmin
      .from('service_bookings')
      .select('id, customer_id, status, payment_method')
      .eq('order_id', orderId)
      .maybeSingle();

    // [Fix] status 대소문자 정규화 — DB가 lowercase 'pending' 저장 시 guard 우회 방지
    if (!booking || booking.customer_id !== user.id || booking.status?.toUpperCase() !== 'PENDING') {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const currentMethod = (booking.payment_method || '').toLowerCase();
    if (currentMethod === 'bank') {
      return NextResponse.json({ success: true, alreadyMarked: true });
    }

    if (currentMethod && currentMethod !== 'bank') {
      return NextResponse.json(
        { success: false, error: '이미 다른 결제수단으로 진행 중인 예약입니다.' },
        { status: 409 }
      );
    }

    // [Race Guard] status + payment_method 조건 포함 UPDATE — 동시 요청에서 체크-후-수정 불일치 방어
    const { error } = await supabaseAdmin
      .from('service_bookings')
      .update({ payment_method: 'bank' })
      .eq('order_id', orderId)
      .eq('customer_id', user.id)
      .filter('status', 'ilike', 'PENDING')
      .is('payment_method', null);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SERVICE] mark-bank error:', msg);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
