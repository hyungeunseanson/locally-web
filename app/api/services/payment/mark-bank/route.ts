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
      .select('id, customer_id, status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!booking || booking.customer_id !== user.id || booking.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('service_bookings')
      .update({ payment_method: 'bank' })
      .eq('order_id', orderId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SERVICE] mark-bank error:', msg);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
