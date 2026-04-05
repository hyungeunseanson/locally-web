import { NextResponse } from 'next/server';

import type { Experience } from '@/app/types';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplicationsByUser,
} from '@/app/utils/hostVisibility';

export const dynamic = 'force-dynamic';

const HOME_EXPERIENCE_SELECT_FIELDS = [
  'id',
  'host_id',
  'title',
  'title_ko',
  'title_en',
  'title_ja',
  'title_zh',
  'city',
  'subCity',
  'country',
  'description',
  'description_ko',
  'description_en',
  'description_ja',
  'description_zh',
  'price',
  'category',
  'category_en',
  'category_ja',
  'category_zh',
  'tags',
  'languages',
  'photos',
  'image_url',
  'max_guests',
  'duration',
  'meeting_point',
  'meeting_point_i18n',
  'location',
  'status',
  'created_at',
  'rating',
  'review_count',
] as const;

type PublicHostApplicationRow = {
  id?: string | number | null;
  user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AvailabilityRow = {
  experience_id: number | string | null;
  date: string | null;
};

type WishlistRow = {
  experience_id: number | string | null;
};

type HomeExperience = Experience & {
  title_ko?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  description_ko?: string | null;
  description_en?: string | null;
  description_ja?: string | null;
  description_zh?: string | null;
  category_en?: string | null;
  category_ja?: string | null;
  category_zh?: string | null;
  location?: string | null;
  subCity?: string | null;
  meeting_point_i18n?: Record<string, string> | null;
  rating?: number | null;
  review_count?: number | null;
  wishlist_count?: number | null;
};

function asExperienceKey(value: number | string | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    const { data: publicHostApplications, error: hostError } = await supabaseAdmin
      .from('public_host_applications')
      .select('id, user_id, status, created_at');

    if (hostError) {
      throw hostError;
    }

    const visibleHostIds = Array.from(
      pickLatestPublicHostApplicationsByUser((publicHostApplications || []) as PublicHostApplicationRow[])
        .values()
    )
      .filter((row) => isPublicHostApplicationStatus(row.status))
      .map((row) => String(row.user_id || ''))
      .filter(Boolean);

    if (visibleHostIds.length === 0) {
      return NextResponse.json({ data: [] satisfies HomeExperience[] });
    }

    const { data: experiences, error: experiencesError } = await supabaseAdmin
      .from('experiences')
      .select(HOME_EXPERIENCE_SELECT_FIELDS.join(', '))
      .eq('status', 'active')
      .in('host_id', visibleHostIds)
      .order('created_at', { ascending: false });

    if (experiencesError) {
      throw experiencesError;
    }

    const experienceRows = ((experiences || []) as HomeExperience[]).filter(Boolean);
    if (experienceRows.length === 0) {
      return NextResponse.json({ data: [] satisfies HomeExperience[] });
    }

    const experienceIds = experienceRows.map((item) => item.id);

    const [{ data: availabilityRows, error: availabilityError }, { data: wishlistRows, error: wishlistError }] =
      await Promise.all([
        supabaseAdmin
          .from('experience_availability')
          .select('experience_id, date')
          .in('experience_id', experienceIds),
        supabaseAdmin
          .from('wishlists')
          .select('experience_id')
          .in('experience_id', experienceIds),
      ]);

    if (availabilityError) {
      throw availabilityError;
    }

    if (wishlistError) {
      throw wishlistError;
    }

    const datesByExperience = new Map<string, string[]>();
    for (const row of (availabilityRows || []) as AvailabilityRow[]) {
      const key = asExperienceKey(row.experience_id);
      if (!key || !row.date) {
        continue;
      }

      const currentDates = datesByExperience.get(key) || [];
      currentDates.push(row.date);
      datesByExperience.set(key, currentDates);
    }

    const wishlistCountsByExperience = new Map<string, number>();
    for (const row of (wishlistRows || []) as WishlistRow[]) {
      const key = asExperienceKey(row.experience_id);
      if (!key) {
        continue;
      }

      wishlistCountsByExperience.set(key, (wishlistCountsByExperience.get(key) || 0) + 1);
    }

    const mergedExperiences = experienceRows.map((experience) => {
      const experienceKey = asExperienceKey(experience.id);
      return {
        ...experience,
        available_dates: datesByExperience.get(experienceKey) || [],
        wishlist_count: wishlistCountsByExperience.get(experienceKey) || 0,
      };
    });

    return NextResponse.json({ data: mergedExperiences satisfies HomeExperience[] });
  } catch (error) {
    console.error('[Home experiences] Failed to load experiences:', error);
    return NextResponse.json(
      { error: 'Failed to load home experiences.' },
      { status: 500 }
    );
  }
}
