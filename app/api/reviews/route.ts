import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';

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

    // [R1] 체험 정보 조회 (호스트 알림 + R6 프로필 집계용)
    const { data: experience } = await supabase
      .from('experiences')
      .select('host_id, title')
      .eq('id', experienceId)
      .maybeSingle();

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

    // [R1] 호스트에게 새 후기 알림 발송
    if (experience?.host_id) {
      await supabase.from('notifications').insert({
        user_id: experience.host_id,
        type: 'new_review',
        title: '새 후기가 등록되었습니다',
        message: `'${experience.title}'에 새 후기가 작성되었습니다.`,
        link: '/host/dashboard?tab=reviews',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      sendImmediateGenericEmail({
        recipientUserId: experience.host_id,
        subject: '[Locally] 새 후기가 등록되었습니다',
        title: '새 후기가 등록되었습니다',
        message: `'${experience.title}'에 새 후기가 작성되었습니다.`,
        link: '/host/dashboard?tab=reviews',
        ctaLabel: '후기 확인하기',
      }).catch((emailError) => {
        console.error('Review host email error:', emailError);
      });
    }

    if (experience?.title) {
      try {
        await insertAdminAlerts({
          title: '새 후기가 등록되었습니다',
          message: `'${experience.title}' 체험에 새 후기가 작성되었습니다.`,
        });
      } catch (adminAlertError) {
        console.error('Review admin alert error:', adminAlertError);
      }
    }

    // [R6] 호스트 프로필 전체 평점 집계 업데이트
    if (experience?.host_id) {
      try {
        const { data: hostReviews } = await supabase
          .from('reviews')
          .select('rating, experiences!inner(host_id)')
          .eq('experiences.host_id', experience.host_id);

        if (hostReviews && hostReviews.length > 0) {
          const hostTotal = hostReviews.reduce((sum, r) => sum + r.rating, 0);
          const hostAvg = Number((hostTotal / hostReviews.length).toFixed(2));
          await supabase
            .from('profiles')
            .update({
              average_rating: hostAvg,
              total_review_count: hostReviews.length,
            })
            .eq('id', experience.host_id);
        }
      } catch {
        // 프로필 집계 실패는 후기 등록 성공에 영향 없음
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error("Review Error:", err);
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
