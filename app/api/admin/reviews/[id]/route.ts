import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type ReviewDeleteContext = {
  id: number;
  rating: number | null;
  content: string | null;
  user_id: string | null;
  experience_id: number | null;
};

function buildContentPreview(content: string | null) {
  if (!content) return '';
  return content.length > 120 ? `${content.slice(0, 117)}...` : content;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const reviewId = Number(id);

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return NextResponse.json({ success: false, error: '유효하지 않은 리뷰 ID입니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('id, rating, content, user_id, experience_id')
      .eq('id', reviewId)
      .maybeSingle<ReviewDeleteContext>();

    if (reviewError) {
      console.error('[admin/reviews/[id]] fetch error:', reviewError);
      return NextResponse.json({ success: false, error: '리뷰 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!review) {
      return NextResponse.json({ success: false, error: '리뷰를 찾을 수 없습니다.' }, { status: 404 });
    }

    const [profileResult, experienceResult] = await Promise.all([
      review.user_id
        ? supabaseAdmin.from('profiles').select('full_name').eq('id', review.user_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      review.experience_id
        ? supabaseAdmin.from('experiences').select('title').eq('id', review.experience_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileResult.error) {
      console.error('[admin/reviews/[id]] profile fetch error:', profileResult.error);
    }
    if (experienceResult.error) {
      console.error('[admin/reviews/[id]] experience fetch error:', experienceResult.error);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      console.error('[admin/reviews/[id]] delete error:', deleteError);
      return NextResponse.json({ success: false, error: '리뷰 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'DELETE_REVIEW',
      target_type: 'reviews',
      target_id: String(reviewId),
      details: {
        rating: review.rating,
        experience_id: review.experience_id,
        experience_title: experienceResult.data?.title || null,
        guest_name: profileResult.data?.full_name || null,
        content_preview: buildContentPreview(review.content),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reviews/[id]] unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
