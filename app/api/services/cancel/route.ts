import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type CancelBody = {
  order_id?: string;
  cancel_reason?: string;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CancelBody;
    const { order_id, cancel_reason = '고객 요청 취소' } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: '주문 번호가 필요합니다.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. service_bookings 조회
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select('*, service_requests(title, user_id)')
      .eq('order_id', order_id)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 권한 검증 (고객 또는 호스트만)
    const isCustomer = booking.customer_id === user.id;
    const isHost = booking.host_id === user.id;

    if (!isCustomer && !isHost) {
      return NextResponse.json({ success: false, error: '취소 권한이 없습니다.' }, { status: 403 });
    }

    // 3. 이미 취소된 경우
    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: false, error: '이미 취소된 예약입니다.' }, { status: 409 });
    }

    // 4. PENDING 상태면 바로 취소 (결제 전)
    if (booking.status === 'PENDING') {
      await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancelled', cancel_reason })
        .eq('order_id', order_id);

      // service_requests 상태 open으로 복구
      await supabaseAdmin
        .from('service_requests')
        .update({
          status: 'open',
          selected_application_id: null,
          selected_host_id: null,
        })
        .eq('id', booking.request_id);

      // 선택됐던 지원서 pending 복구
      if (booking.application_id) {
        await supabaseAdmin
          .from('service_applications')
          .update({ status: 'pending' })
          .eq('id', booking.application_id);
      }

      return NextResponse.json({ success: true, message: '예약이 취소되었습니다.' });
    }

    // 5. PAID 이후 취소 요청 처리 (환불 로직은 관리자 수동 처리)
    await supabaseAdmin
      .from('service_bookings')
      .update({
        status: 'cancellation_requested',
        cancel_reason,
      })
      .eq('order_id', order_id);

    const requestTitle = (booking.service_requests as { title?: string; user_id?: string } | null)?.title || '맞춤 서비스';
    const otherPartyId = isCustomer ? booking.host_id : booking.customer_id;

    // 상대방 알림
    supabaseAdmin.from('notifications').insert({
      user_id: otherPartyId,
      type: 'service_cancelled',
      title: '취소 요청이 접수되었습니다.',
      message: `'${requestTitle}' 서비스에 대한 취소 요청이 접수되었습니다. 관리자가 검토 후 처리합니다.`,
      link: `/services/my`,
      is_read: false,
    }).then(({ error }) => {
      if (error) console.error('Cancel Notification Error:', error);
    });

    return NextResponse.json({ success: true, message: '취소 요청이 접수되었습니다. 관리자 검토 후 환불이 처리됩니다.' });

  } catch (error: unknown) {
    console.error('API Service Cancel Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
