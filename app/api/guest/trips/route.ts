import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. 게스트의 모든 예약 가져오기 (체험 정보 + 후기 정보 포함)
    // 🟢 bookings 테이블과 reviews 테이블을 join해서 후기 작성 여부 확인
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        experiences (id, title, image_url, location),
        reviews (id)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) throw error;

    const now = new Date();
    const updatedTrips = [];

    // 2. 데이터 가공 및 '자동 완료' 로직
    for (const booking of bookings || []) {
      const expDate = new Date(`${booking.date}T${booking.time}`);
      let status = booking.status;

      // 🟢 [핵심] 날짜가 지났고, 상태가 'PAID'나 'confirmed'라면 -> 'completed'로 자동 업데이트
      // (DB 업데이트는 비동기로 던져두고, 사용자에게는 바로 보여줌)
      if (expDate < now && (status === 'PAID' || status === 'confirmed')) {
        status = 'completed';
        // 서버단에서 조용히 업데이트 실행 (await 안 함)
        supabase.from('bookings').update({ status: 'completed' }).eq('id', booking.id).then();
      }

      updatedTrips.push({
        id: booking.id,
        orderId: booking.order_id || booking.id.slice(0, 8),
        expId: booking.experiences?.id,
        title: booking.experiences?.title,
        image: booking.experiences?.image_url,
        location: booking.experiences?.location,
        date: booking.date,
        time: booking.time,
        guests: booking.guests,
        price: booking.amount,
        status: status, // 업데이트된 상태 사용
        paymentDate: booking.created_at,
        hostId: booking.experiences?.host_id, // 메시지 보내기용
        hasReview: booking.reviews && booking.reviews.length > 0 // 🟢 후기 작성 여부 (배열 길이로 체크)
      });
    }

    return NextResponse.json({ trips: updatedTrips });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}