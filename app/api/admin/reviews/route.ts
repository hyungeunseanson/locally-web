import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type ReviewRow = {
  id: number;
  rating: number | null;
  content: string | null;
  reply: string | null;
  created_at: string;
  photos: string[] | null;
  user_id: string | null;
  experience_id: number | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type ExperienceRow = {
  id: number;
  title: string | null;
  host_id: string | null;
};

export async function GET() {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

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

    const { data: reviewRows, error: reviewsError } = await supabaseAdmin
      .from('reviews')
      .select('id, rating, content, reply, created_at, photos, user_id, experience_id')
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;

    const reviews = (reviewRows || []) as ReviewRow[];
    const userIds = Array.from(new Set(reviews.map((review) => review.user_id).filter(Boolean) as string[]));
    const experienceIds = Array.from(new Set(reviews.map((review) => review.experience_id).filter(Boolean) as number[]));

    const [{ data: profileRows, error: profilesError }, { data: experienceRows, error: experiencesError }] =
      await Promise.all([
        userIds.length > 0
          ? supabaseAdmin.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
        experienceIds.length > 0
          ? supabaseAdmin.from('experiences').select('id, title, host_id').in('id', experienceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (profilesError) throw profilesError;
    if (experiencesError) throw experiencesError;

    const profileById = new Map<string, ProfileRow>();
    ((profileRows || []) as ProfileRow[]).forEach((profile) => {
      profileById.set(profile.id, profile);
    });

    const experienceById = new Map<number, ExperienceRow>();
    ((experienceRows || []) as ExperienceRow[]).forEach((experience) => {
      experienceById.set(experience.id, experience);
    });

    return NextResponse.json({
      success: true,
      data: reviews.map((review) => ({
        ...review,
        photos: review.photos || [],
        guest: review.user_id ? profileById.get(review.user_id) || null : null,
        experiences: review.experience_id ? experienceById.get(review.experience_id) || null : null,
      })),
    });
  } catch (error) {
    console.error('[admin/reviews] GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to load admin reviews' }, { status: 500 });
  }
}
