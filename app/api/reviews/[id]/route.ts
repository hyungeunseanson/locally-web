import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { NextResponse } from 'next/server';
import { syncReviewAggregates } from '@/app/utils/reviews/reviewAggregates';

function parseReviewRating(value: unknown) {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized)) return null;
  if (normalized < 1 || normalized > 5) return null;
  return normalized;
}

function normalizeReviewContent(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await context.params;
    const reviewId = Number(params.id);
    if (!reviewId) return NextResponse.json({ error: '잘못된 후기 ID입니다.' }, { status: 400 });

    const body = await request.json();
    const { rating, content } = body;
    const normalizedRating = parseReviewRating(rating);
    const normalizedContent = normalizeReviewContent(content);

    if (normalizedRating === null) {
      return NextResponse.json({ error: '평점은 1점부터 5점까지 입력해주세요.' }, { status: 400 });
    }
    if (normalizedContent.length < 10) {
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
    const { error: updateError } = await supabaseAdmin
      .from('reviews')
      .update({
        rating: normalizedRating,
        content: normalizedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) throw updateError;

    await syncReviewAggregates({
      experienceId: existing.experience_id,
      supabaseAdmin,
    });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error('Review PATCH error:', err);
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
