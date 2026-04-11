import { NextRequest, NextResponse } from 'next/server';

import { deliverReviewReplyNotification } from '@/app/utils/reviews/reviewReplyNotification';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ReviewReplyBody = {
  reviewId?: unknown;
  reply?: unknown;
};

type ReviewOwnershipRow = {
  id: number;
  user_id: string | null;
  experience_id: number;
  experiences: { host_id: string | null } | { host_id: string | null }[] | null;
};

function getHostId(relation: ReviewOwnershipRow['experiences']) {
  if (Array.isArray(relation)) return relation[0]?.host_id ?? null;
  return relation?.host_id ?? null;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ReviewReplyBody;
    const reviewId = Number(body.reviewId);
    const reply = asTrimmedString(body.reply);

    if (!Number.isFinite(reviewId) || reviewId <= 0 || !reply) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: reviewData, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('id, user_id, experience_id, experiences!inner(host_id)')
      .eq('id', reviewId)
      .maybeSingle();

    if (reviewError) throw reviewError;
    if (!reviewData) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    }

    const review = reviewData as ReviewOwnershipRow;
    const hostId = getHostId(review.experiences);

    if (hostId !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const replyAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('reviews')
      .update({
        reply,
        reply_at: replyAt,
      })
      .eq('id', reviewId)
      .eq('experience_id', review.experience_id); // [TOCTOU Guard] 소유권 재확인

    if (updateError) throw updateError;

    if (review.user_id) {
      try {
        await deliverReviewReplyNotification({
          actorId: user.id,
          recipientId: review.user_id,
          reviewId,
          replyText: reply,
          link: '/guest/trips',
          supabaseAdmin,
        });
      } catch (notificationError) {
        console.warn('Host review reply notification failed after reply save:', notificationError);
      }
    }

    return NextResponse.json({ success: true, recipientId: review.user_id, replyAt });
  } catch (error) {
    console.error('Host review reply route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save review reply.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
