import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await context.params;
    const reviewId = Number(params.id);
    if (!reviewId) return NextResponse.json({ error: '잘못된 후기 ID입니다.' }, { status: 400 });

    const body = await request.json();
    const { rating, content, photos } = body;

    if (!rating || !content) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }
    if (content.length < 10) {
      return NextResponse.json({ error: '후기는 10자 이상 작성해주세요.' }, { status: 400 });
    }

    // 후기 소유권 확인 + 수정 가능 기간 검증 (7일)
    const { data: existing } = await supabase
      .from('reviews')
      .select('id, user_id, experience_id, created_at')
      .eq('id', reviewId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: '후기를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: '본인의 후기만 수정할 수 있습니다.' }, { status: 403 });
    }

    const daysSinceCreation = (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 7) {
      return NextResponse.json({ error: '후기 작성 후 7일 이내에만 수정할 수 있습니다.' }, { status: 403 });
    }

    // 후기 수정
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        rating,
        content,
        photos: photos || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) throw updateError;

    // 체험 평점 재집계
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('experience_id', existing.experience_id);

    if (allReviews && allReviews.length > 0) {
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const newAverage = Number((totalRating / allReviews.length).toFixed(2));
      await supabase
        .from('experiences')
        .update({ rating: newAverage, review_count: allReviews.length })
        .eq('id', existing.experience_id);

      // 호스트 프로필 집계
      try {
        const { data: exp } = await supabase
          .from('experiences')
          .select('host_id')
          .eq('id', existing.experience_id)
          .maybeSingle();

        if (exp?.host_id) {
          const { data: hostReviews } = await supabase
            .from('reviews')
            .select('rating, experiences!inner(host_id)')
            .eq('experiences.host_id', exp.host_id);

          if (hostReviews && hostReviews.length > 0) {
            const hostTotal = hostReviews.reduce((s, r) => s + r.rating, 0);
            const hostAvg = Number((hostTotal / hostReviews.length).toFixed(2));
            await supabase
              .from('profiles')
              .update({ average_rating: hostAvg, total_review_count: hostReviews.length })
              .eq('id', exp.host_id);
          }
        }
      } catch {
        // 프로필 집계 실패는 수정 성공에 영향 없음
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Review PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
