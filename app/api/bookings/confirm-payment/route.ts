import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 관리자 권한
    );
    
    const { bookingId } = await request.json();
    
    // 1. 예약 정보 조회 (알림 대상을 찾기 위해)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`*, experiences ( title, host_id )`)
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) throw new Error('예약 정보를 찾을 수 없습니다.');

    // 2. 상태를 'confirmed'로 변경
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // 3. 🟢 [추가] 호스트에게 알림 발송
    if (booking.experiences?.host_id) {
      await supabase.from('notifications').insert({
        user_id: booking.experiences.host_id,
        type: 'booking_confirmed',
        title: '💰 입금 확인 완료!',
        message: `'${booking.experiences.title}' 예약의 입금 확인이 완료되었습니다.`,
        link: '/host/dashboard',
        is_read: false
      });
    }

    // 4. 🟢 [추가] 게스트에게 알림 발송
    if (booking.user_id) {
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        type: 'booking_confirmed',
        title: '✅ 예약 확정 알림',
        message: `'${booking.experiences.title}' 입금이 확인되어 예약이 확정되었습니다. 즐거운 여행 되세요!`,
        link: '/guest/trips',
        is_read: false
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}