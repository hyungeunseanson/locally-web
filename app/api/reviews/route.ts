import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    // 1. 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { experienceId, bookingId, rating, content, photos } = body;

    // 2. 필수 값 체크
    if (!experienceId || !bookingId || !rating) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 🟢 [보안 핵심] 예약 유효성 검증 (Status Check & Ownership Check)
    const { data: booking } = await supabase
      .from('bookings')
      .select('status, user_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: '본인의 예약에만 후기를 작성할 수 있습니다.' }, { status: 403 });
    }

    if (booking.status !== 'completed') {
      return NextResponse.json({ error: '체험 완료(completed) 상태일 때만 후기를 작성할 수 있습니다.' }, { status: 400 });
    }

    // 🟢 [중복 방지] 이미 작성된 후기가 있는지 확인
    const { count: existingReviewCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', bookingId);

    if (existingReviewCount && existingReviewCount > 0) {
      return NextResponse.json({ error: '이미 후기를 작성하셨습니다.' }, { status: 409 });
    }

    // 3. 후기 저장 (Insert)
    const { error: insertError } = await supabase.from('reviews').insert({
      user_id: user.id,
      experience_id: experienceId,
      booking_id: bookingId,
      rating,
      content,
      photos: photos || [], // 🟢 누락되었던 photos 필드 추가
      created_at: new Date().toISOString()
    });

    if (insertError) throw insertError;

    // 🟢 [실시간 반영] 체험의 평균 평점 및 후기 수 업데이트 (Aggregation)
    // (1) 해당 체험의 모든 평점 가져오기
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('experience_id', experienceId);

    if (allReviews && allReviews.length > 0) {
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const newAverage = Number((totalRating / allReviews.length).toFixed(2)); // 소수점 2자리
      const newCount = allReviews.length;

      // (2) experiences 테이블 업데이트 (컬럼이 없다면 추가 필요: rating, review_count)
      await supabase
        .from('experiences')
        .update({
          rating: newAverage,
          review_count: newCount
        })
        .eq('id', experienceId);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Review Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}