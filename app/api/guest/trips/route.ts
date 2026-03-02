import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';

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
        experiences (id, host_id, title, image_url, location),
        reviews (id, rating, content, photos, created_at)
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

      // 🟢 [M-2] 클라이언트 측 조회 API에서는 무거운 DB 덮어쓰기(Side-effect)를 제거합니다.
      // 단순히 날짜가 지났으면 클라이언트 화면에만 'completed'로 가공해서 내려주고,
      // 실제 DB 업데이트는 매 시간 도는 Cron Job 서버가 전담하여 서버 부하와 Vercel 타임아웃을 방지합니다.
      if (expDate < now && BOOKING_ACTIVE_STATUS_FOR_CAPACITY.includes(status)) {
        status = 'completed';
      }

      const firstReview = booking.reviews?.[0] || null;

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
        hasReview: booking.reviews && booking.reviews.length > 0, // 🟢 후기 작성 여부 (배열 길이로 체크)
        review: firstReview ? {  // [R5] 수정용 후기 데이터
          id: firstReview.id,
          rating: firstReview.rating,
          content: firstReview.content,
          photos: firstReview.photos || [],
          created_at: firstReview.created_at,
        } : null,
      });
    }

    return NextResponse.json({ trips: updatedTrips });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
