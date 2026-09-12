import { NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('service_bookings')
    .select('order_id, customer_id, status, payment_method, tid')
    .eq('request_id', requestId)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ success: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!['PAID', 'confirmed', 'completed'].includes(booking.status)) {
    return NextResponse.json({ success: false, error: '결제 확인 후 현지 담당자 문의가 열립니다.' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .rpc('confirm_service_concierge_payment_atomic', {
      p_order_id: booking.order_id,
      p_payment_method: booking.payment_method || 'card',
      p_tid: booking.tid,
    })
    .maybeSingle<{ support_inquiry_id: string }>();

  if (error || !data?.support_inquiry_id) {
    console.error('[service concierge] support-thread ensure failed:', error);
    return NextResponse.json({ success: false, error: '현지 담당자 문의 연결에 실패했습니다.' }, { status: 500 });
  }

  const redirectUrl = `/guest/inbox?inquiryId=${encodeURIComponent(data.support_inquiry_id)}`;
  return NextResponse.json({
    success: true,
    inquiryId: data.support_inquiry_id,
    redirectUrl,
  });
}
