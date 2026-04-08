import { NextResponse } from 'next/server';

import { isPublicHostApplicationStatus, pickLatestPublicHostApplication } from '@/app/utils/hostVisibility';
import { getCurrentLocale } from '@/app/utils/locale';
import {
  buildPublicReviewItems,
  resolvePublicReviewLocale,
  type PublicReviewItem,
  type PublicReviewProfileRow,
  type PublicReviewRow,
} from '@/app/utils/reviews/publicReview';
import { createAdminClient } from '@/app/utils/supabase/admin';

type PublicHostApplicationRow = {
  id: string | number;
  user_id: string | null;
  status: string | null;
  created_at?: string | null;
};

type PublicExperienceRow = {
  id: string | number;
  host_id: string | null;
  status: string | null;
  is_active?: boolean | null;
};

type PublicExperienceReviewPayload = {
  success: boolean;
  data?: PublicReviewItem[];
  error?: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ experienceId: string }> }
) {
  try {
    const { experienceId } = await context.params;
    if (!experienceId) {
      return NextResponse.json<PublicExperienceReviewPayload>(
        { success: false, error: 'Invalid experience id' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: experienceRow, error: experienceError } = await supabaseAdmin
      .from('experiences')
      .select('id, host_id, status, is_active')
      .eq('id', experienceId)
      .maybeSingle();

    if (experienceError) throw experienceError;

    const experience = experienceRow as PublicExperienceRow | null;
    if (!experience) {
      return NextResponse.json<PublicExperienceReviewPayload>(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );
    }

    if (experience.status !== 'active' || experience.is_active === false || !experience.host_id) {
      return NextResponse.json<PublicExperienceReviewPayload>(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );
    }

    const { data: hostAppRows, error: hostAppError } = await supabaseAdmin
      .from('public_host_applications')
      .select('id, user_id, status, created_at')
      .eq('user_id', experience.host_id)
      .order('created_at', { ascending: false });

    if (hostAppError) throw hostAppError;

    const hostApp = pickLatestPublicHostApplication((hostAppRows || []) as PublicHostApplicationRow[]);
    if (!hostApp || !isPublicHostApplicationStatus(hostApp.status)) {
      return NextResponse.json<PublicExperienceReviewPayload>(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );
    }

    const { data: reviewRows, error: reviewsError } = await supabaseAdmin
      .from('reviews')
      .select('id, user_id, rating, content, created_at, reply, reply_at, photos')
      .eq('experience_id', experienceId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;

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

    return NextResponse.json<PublicExperienceReviewPayload>({
      success: true,
      data: buildPublicReviewItems({
        reviews,
        profiles: (profileRows as PublicReviewProfileRow[] | null) || [],
        locale,
      }),
    });
  } catch (error) {
    console.error('[api/public/experiences/[experienceId]/reviews] GET failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to load public experience reviews';
    return NextResponse.json<PublicExperienceReviewPayload>({ success: false, error: message }, { status: 500 });
  }
}
