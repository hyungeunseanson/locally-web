import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 관리자 권한
    );
    
    const { bookingId } = await request.json();
    
// 1. 예약 정보 및 연결된 체험 정원 정보 함께 조회
const { data: booking, error: fetchError } = await supabase
.from('bookings')
.select(`*, experiences ( title, host_id, max_guests )`)
.eq('id', bookingId)
.single();

if (fetchError || !booking) throw new Error('예약 정보를 찾을 수 없습니다.');

// 🚨 [핵심 보안] 입금 확인(승인) 버튼을 누른 '이 순간'에 잔여 좌석 더블 체크
const { data: existingBookings } = await supabase
.from('bookings')
.select('guests, type')
.eq('experience_id', booking.experience_id)
.eq('date', booking.date)
.eq('time', booking.time)
.in('status', ['PAID', 'confirmed']);

const currentBookedCount = existingBookings?.reduce((sum, b) => sum + (b.guests || 0), 0) || 0;
const hasPrivateBooking = existingBookings?.some(b => b.type === 'private');
const maxGuests = booking.experiences?.max_guests || 10;

if (hasPrivateBooking || 
  (booking.type === 'private' && currentBookedCount > 0) || 
  (booking.type !== 'private' && (currentBookedCount + booking.guests > maxGuests))) {
throw new Error('해당 시간대의 정원이 이미 초과되어 입금을 승인할 수 없습니다.');
}

// 2. 상태를 'confirmed'로 변경 및 정산 데이터 확정 기록
    const basePrice = Number(booking.experiences?.price || 0);
    const totalExpPrice = basePrice * (booking.guests || 1);
    const payoutAmount = totalExpPrice * 0.8;
    const platformRev = Number(booking.amount || 0) - payoutAmount;

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        price_at_booking: basePrice,
        total_experience_price: totalExpPrice,
        host_payout_amount: payoutAmount,
        platform_revenue: platformRev,
        payout_status: 'pending'
      })
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