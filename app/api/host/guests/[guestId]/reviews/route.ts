import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type BookingOwnershipRow = {
  id: string | number;
  experiences: { host_id: string | null } | { host_id: string | null }[] | null;
};

type GuestReviewRow = {
  id: number;
  rating: number | null;
  content: string | null;
  created_at: string;
  host_id: string | null;
};

type HostProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

function getHostId(relation: BookingOwnershipRow['experiences']) {
  if (Array.isArray(relation)) return relation[0]?.host_id ?? null;
  return relation?.host_id ?? null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ guestId: string }> }
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

    const { guestId } = await context.params;
    if (!guestId) {
      return NextResponse.json({ success: false, error: 'Invalid guest id' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, experiences!inner(host_id)')
      .eq('user_id', guestId)
      .eq('experiences.host_id', user.id)
      .limit(1)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const relatedBooking = bookingData as BookingOwnershipRow | null;
    if (!relatedBooking || getHostId(relatedBooking.experiences) !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: guestReviewRows, error: guestReviewsError } = await supabaseAdmin
      .from('guest_reviews')
      .select('id, rating, content, created_at, host_id')
      .eq('guest_id', guestId)
      .order('created_at', { ascending: false });

    if (guestReviewsError) throw guestReviewsError;

    const guestReviews = (guestReviewRows as GuestReviewRow[] | null) || [];
    const hostIds = Array.from(
      new Set(guestReviews.map((review) => review.host_id).filter((hostId): hostId is string => Boolean(hostId)))
    );

    const { data: hostProfilesData, error: hostProfilesError } = hostIds.length > 0
      ? await supabaseAdmin
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', hostIds)
      : { data: [], error: null };

    if (hostProfilesError) throw hostProfilesError;

    const hostProfileById = new Map<string, HostProfileRow>(
      ((hostProfilesData as HostProfileRow[] | null) || []).map((profile) => [profile.id, profile])
    );

    return NextResponse.json({
      success: true,
      data: guestReviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        created_at: review.created_at,
        host: review.host_id ? hostProfileById.get(review.host_id) || null : null,
      })),
    });
  } catch (error) {
    console.error('[api/host/guests/[guestId]/reviews] GET failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to load guest reviews';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
