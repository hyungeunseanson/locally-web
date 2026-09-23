import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type GuestReviewRow = {
  id: number;
  host_id: string | null;
  guest_id: string | null;
  booking_id: string | null;
  rating: number | null;
  content: string | null;
  created_at: string;
};

type ProfileRow = { id: string; full_name: string | null };
type BookingRow = { id: string; order_id: string | null; experience_id: number | null };
type ExperienceRow = { id: number; title: string | null };

function parsePageNumber(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = parsePageNumber(searchParams.get('from'), 0, 1_000_000);
    const pageSize = Math.max(1, parsePageNumber(searchParams.get('pageSize'), 50, 100));
    const { data: reviewRows, error: reviewsError } = await supabaseAdmin
      .from('guest_reviews')
      .select('id, host_id, guest_id, booking_id, rating, content, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (reviewsError) throw reviewsError;

    const reviews = (reviewRows || []) as GuestReviewRow[];
    const profileIds = [...new Set(reviews.flatMap((review) => [review.host_id, review.guest_id]).filter((id): id is string => Boolean(id)))];
    const bookingIds = [...new Set(reviews.map((review) => review.booking_id).filter((id): id is string => Boolean(id)))];

    const [profilesResult, bookingsResult] = await Promise.all([
      profileIds.length
        ? supabaseAdmin.from('profiles').select('id, full_name').in('id', profileIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      bookingIds.length
        ? supabaseAdmin.from('bookings').select('id, order_id, experience_id').in('id', bookingIds)
        : Promise.resolve({ data: [] as BookingRow[], error: null }),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (bookingsResult.error) throw bookingsResult.error;

    const bookings = (bookingsResult.data || []) as BookingRow[];
    const experienceIds = [...new Set(bookings.map((booking) => booking.experience_id).filter((id): id is number => id != null))];
    const experiencesResult = experienceIds.length
      ? await supabaseAdmin.from('experiences').select('id, title').in('id', experienceIds)
      : { data: [] as ExperienceRow[], error: null };
    if (experiencesResult.error) throw experiencesResult.error;

    const profileById = new Map(((profilesResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile]));
    const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
    const experienceById = new Map(((experiencesResult.data || []) as ExperienceRow[]).map((experience) => [experience.id, experience]));

    return NextResponse.json({
      success: true,
      data: reviews.map((review) => {
        const booking = review.booking_id ? bookingById.get(review.booking_id) : null;
        const experience = booking?.experience_id ? experienceById.get(booking.experience_id) : null;
        return {
          id: review.id,
          host_name: review.host_id ? profileById.get(review.host_id)?.full_name || null : null,
          guest_name: review.guest_id ? profileById.get(review.guest_id)?.full_name || null : null,
          experience_title: experience?.title || null,
          booking_number: booking?.order_id || booking?.id || review.booking_id,
          rating: review.rating,
          content: review.content,
          created_at: review.created_at,
        };
      }),
    });
  } catch (error) {
    console.error('[admin/guest-reviews] GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to load guest reviews' }, { status: 500 });
  }
}
