import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getVisiblePublicHostIdSet, isPublicExperienceVisible } from '@/app/utils/hostVisibility';
import { PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS } from '@/app/search/searchContract';

type PublicHostApplicationRow = {
  id?: string | number | null;
  user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type HomeExperienceRow = {
  id: number;
  host_id: string | null;
  status?: string | null;
  is_active?: boolean | null;
  title?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  category?: string | null;
  category_en?: string | null;
  category_ja?: string | null;
  category_zh?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  languages?: string[] | null;
  image_url?: string | null;
  photos?: string[] | null;
  rating?: number | null;
  review_count?: number | null;
  price?: number | null;
  duration?: number | null;
  created_at?: string | null;
};

type AvailabilityRow = {
  experience_id: number | string | null;
  date: string | null;
};

type PopularitySnapshotRow = {
  experience_id: number | string | null;
  wishlist_count: number | null;
};

const HOME_EXPERIENCE_SELECT = ['host_id', 'status', 'is_active', ...PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS, 'created_at'].join(', ');

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
} as const;

function asComparableId(value: number | string | null | undefined) {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

function toIsoDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayIsoDate() {
  return toIsoDateString(new Date());
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: publicHostApplications, error: applicationsError } = await supabase
      .from('public_host_applications')
      .select('id, user_id, status, created_at');

    if (applicationsError) {
      throw applicationsError;
    }

    const visibleHostIds = getVisiblePublicHostIdSet(
      ((publicHostApplications ?? []) as PublicHostApplicationRow[])
    );

    if (visibleHostIds.size === 0) {
      return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS });
    }

    const visibleHostIdList = Array.from(visibleHostIds);

    const { data: experiences, error: experiencesError } = await supabase
      .from('experiences')
      .select(HOME_EXPERIENCE_SELECT)
      .in('host_id', visibleHostIdList)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (experiencesError) {
      throw experiencesError;
    }

    const visibleExperiences = ((experiences ?? []) as unknown as HomeExperienceRow[]).filter((experience) =>
      visibleHostIds.has(String(experience.host_id || '')) && isPublicExperienceVisible(experience)
    );

    if (visibleExperiences.length === 0) {
      return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS });
    }

    const experienceIds = visibleExperiences.map((experience) => experience.id);

    const [{ data: availabilityRows, error: availabilityError }, { data: popularityRows, error: popularityError }] =
      await Promise.all([
        supabase
          .from('experience_availability')
          .select('experience_id, date')
          .in('experience_id', experienceIds)
          .gte('date', getTodayIsoDate()),
        supabase
          .from('experience_popularity_snapshot')
          .select('experience_id, wishlist_count')
          .in('experience_id', experienceIds),
      ]);

    if (availabilityError) {
      throw availabilityError;
    }

    if (popularityError) {
      console.warn('[home/experiences] popularity snapshot unavailable:', popularityError.message);
    }

    const availableDatesByExperienceId = new Map<string, string[]>();
    for (const row of (availabilityRows ?? []) as AvailabilityRow[]) {
      const experienceId = asComparableId(row.experience_id);
      if (!experienceId || typeof row.date !== 'string' || row.date.length === 0) {
        continue;
      }

      const existing = availableDatesByExperienceId.get(experienceId) ?? [];
      existing.push(row.date);
      availableDatesByExperienceId.set(experienceId, existing);
    }

    const popularityByExperienceId = new Map<string, number>();
    for (const row of (popularityRows ?? []) as PopularitySnapshotRow[]) {
      const experienceId = asComparableId(row.experience_id);
      if (!experienceId) {
        continue;
      }

      popularityByExperienceId.set(
        experienceId,
        Number.isFinite(row.wishlist_count) ? Number(row.wishlist_count) : 0
      );
    }

    const data = visibleExperiences.map((experience) => {
      const publicExperience = { ...experience };
      delete publicExperience.status;
      delete publicExperience.is_active;

      return {
        ...publicExperience,
        card_image_url: experience.image_url ?? null,
        available_dates: availableDatesByExperienceId.get(String(experience.id)) ?? [],
        wishlist_count: popularityByExperienceId.get(String(experience.id)) ?? 0,
      };
    });

    return NextResponse.json({ data }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('[home/experiences] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load home experiences.' }, { status: 500 });
  }
}
