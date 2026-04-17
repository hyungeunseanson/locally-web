import { NextResponse } from 'next/server';

import { isPublicHostApplicationStatus, pickLatestPublicHostApplication } from '@/app/utils/hostVisibility';
import { getCurrentLocale } from '@/app/utils/locale';
import {
  buildPublicReviewItems,
  buildPublicReviewSummary,
  resolvePublicReviewLocale,
  type PublicReviewItem,
  type PublicReviewProfileRow,
  type PublicReviewRow,
  type PublicReviewSummary,
} from '@/app/utils/reviews/publicReview';
import { createAdminClient } from '@/app/utils/supabase/admin';

type PublicHostApplicationRow = {
  id: string | number;
  user_id: string | null;
  status: string | null;
  created_at?: string | null;
};

type PublicHostReviewPayload = {
  success: boolean;
  data?: PublicReviewItem[];
  summary?: PublicReviewSummary;
  error?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await context.params;
    if (!hostId) {
      return NextResponse.json({ success: false, error: 'Invalid host id' }, { status: 400 });
    }
    if (!UUID_RE.test(hostId)) {
      return NextResponse.json({ success: false, error: 'Host not found' }, { status: 404 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: hostAppRows, error: hostAppError } = await supabaseAdmin
      .from('public_host_applications')
      .select('id, user_id, status, created_at')
      .eq('user_id', hostId)
      .order('created_at', { ascending: false });

    if (hostAppError) throw hostAppError;

    const hostApp = pickLatestPublicHostApplication((hostAppRows || []) as PublicHostApplicationRow[]);
    if (!hostApp || !isPublicHostApplicationStatus(hostApp.status)) {
      return NextResponse.json({ success: false, error: 'Host not found' }, { status: 404 });
    }

    const [{ data: reviewRows, error: reviewsError }, { data: hostProfile, error: hostProfileError }] = await Promise.all([
      supabaseAdmin
        .from('reviews')
        .select('id, user_id, rating, content, created_at, reply, reply_at, experiences!inner(host_id)')
        .eq('experiences.host_id', hostId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('profiles')
        .select('average_rating, total_review_count')
        .eq('id', hostId)
        .maybeSingle(),
    ]);

    if (reviewsError) throw reviewsError;
    if (hostProfileError) throw hostProfileError;

    const reviews = (reviewRows as PublicReviewRow[] | null) || [];
    const userIds = Array.from(
      new Set(reviews.map((review) => review.user_id).filter((userId): userId is string => Boolean(userId)))
    );

    const { data: profileRows, error: profilesError } = userIds.length > 0
      ? await supabaseAdmin
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds)
      : { data: [], error: null };

    if (profilesError) throw profilesError;

    const requestLocale = resolvePublicReviewLocale(new URL(request.url).searchParams.get('lang'));
    const locale = requestLocale || await getCurrentLocale();

    return NextResponse.json<PublicHostReviewPayload>({
      success: true,
      summary: buildPublicReviewSummary({
        reviews,
        averageRating: hostProfile?.average_rating,
        reviewCount: hostProfile?.total_review_count,
      }),
      data: buildPublicReviewItems({
        reviews,
        profiles: (profileRows as PublicReviewProfileRow[] | null) || [],
        locale,
      }),
    });
  } catch (error) {
    console.error('[api/public-hosts/[hostId]/reviews] GET failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to load public host reviews';
    return NextResponse.json<PublicHostReviewPayload>({ success: false, error: message }, { status: 500 });
  }
}
