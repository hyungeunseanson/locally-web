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
        experiences (id, host_id, title, image_url, photos, location),
        reviews (id, rating, content, photos, created_at)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) throw error;

    const now = new Date();
    const updatedTrips = [];

    // 2. 데이터 가공 및 '자동 완료' 로직
    const bookingsToUpdate: string[] = [];

    for (const booking of bookings || []) {
      const expDate = new Date(`${booking.date}T${booking.time}`);
      let status = booking.status;

      // 🟢 시간이 지난 활성 예약(PAID, confirmed)은 런타임에 즉시 DB를 동기화하여 상태 불일치를 방지합니다. (Lazy Update)
      if (expDate < now && BOOKING_ACTIVE_STATUS_FOR_CAPACITY.includes(status)) {
        status = 'completed';
        bookingsToUpdate.push(booking.id);
      }

      const firstReview = booking.reviews?.[0] || null;

      updatedTrips.push({
        id: booking.id,
        orderId: booking.order_id || booking.id.slice(0, 8),
        expId: booking.experiences?.id,
        title: booking.experiences?.title,
        image: booking.experiences?.image_url,
        photos: booking.experiences?.photos, // 🟢 누락되었던 체험 사진 배열 추가 매핑
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

    // 3. Fake 'completed' 상태 물리적 동기화 (Lazy Update)
    if (bookingsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .in('id', bookingsToUpdate);

      if (updateError) {
        console.error('Failed to sync completed status:', updateError);
      }
    }

    return NextResponse.json({ trips: updatedTrips });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
