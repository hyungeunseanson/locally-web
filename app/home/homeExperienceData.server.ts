import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

import {
  getVisiblePublicHostIdSet,
  isPublicExperienceVisible,
  pickLatestPublicHostApplicationsByUser,
} from '@/app/utils/hostVisibility';
import { PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS } from '@/app/search/searchContract';
import { isPublicExperienceR2Eligible } from '@/app/utils/publicExperienceMediaKeys';
import type { HomeExperienceRow, PublicHomeExperience } from './homeExperienceTypes';

type PublicHostApplicationRow = {
  id?: string | number | null;
  user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  is_superhost?: boolean | null;
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
const HOME_PUBLIC_QUERY_LIMIT = 1000;
const HOME_PUBLIC_CACHE_KEY = 'public-home-experiences-v1';
const HOME_PUBLIC_REVALIDATE_SECONDS = 300;

class PopularitySnapshotUnavailable extends Error {
  constructor(readonly fallbackData: PublicHomeExperience[], message: string) {
    super(message);
  }
}

function asComparableId(value: number | string | null | undefined) {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

function toIsoDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayIsoDate() {
  return toIsoDateString(new Date());
}

async function loadPublicHomeExperiences(): Promise<PublicHomeExperience[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [
    { data: publicHostApplications, error: applicationsError },
    { data: experiences, error: experiencesError },
    { data: availabilityRows, error: availabilityError },
    { data: popularityRows, error: popularityError },
  ] = await Promise.all([
    supabase.from('public_host_applications')
      .select('id, user_id, status, created_at, is_superhost')
      .limit(HOME_PUBLIC_QUERY_LIMIT),
    supabase.from('experiences')
      .select(HOME_EXPERIENCE_SELECT)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(HOME_PUBLIC_QUERY_LIMIT),
    supabase.from('experience_availability')
      .select('experience_id, date')
      .gte('date', getTodayIsoDate())
      .limit(HOME_PUBLIC_QUERY_LIMIT),
    supabase.from('experience_popularity_snapshot')
      .select('experience_id, wishlist_count')
      .limit(HOME_PUBLIC_QUERY_LIMIT),
  ]);

  if (applicationsError) {
    throw applicationsError;
  }
  if (experiencesError) {
    throw experiencesError;
  }
  if (availabilityError) {
    throw availabilityError;
  }
  if ([publicHostApplications, experiences, availabilityRows, popularityRows].some(
    (rows) => (rows?.length ?? 0) === HOME_PUBLIC_QUERY_LIMIT
  )) {
    throw new Error('[home/experiences] public dataset exceeded the safe query limit');
  }

  const publicHostApplicationRows = (publicHostApplications ?? []) as PublicHostApplicationRow[];
  const visibleHostIds = getVisiblePublicHostIdSet(publicHostApplicationRows);
  const latestHostApplications = pickLatestPublicHostApplicationsByUser(publicHostApplicationRows);
  const superhostIds = new Set(
    Array.from(latestHostApplications.entries())
      .filter(([hostId, application]) => visibleHostIds.has(hostId) && application.is_superhost === true)
      .map(([hostId]) => hostId)
  );

  const visibleExperiences = ((experiences ?? []) as unknown as HomeExperienceRow[]).filter((experience) =>
    visibleHostIds.has(String(experience.host_id || '')) && isPublicExperienceVisible(experience)
  );

  const visibleExperienceIds = new Set(visibleExperiences.map((experience) => String(experience.id)));

  if (popularityError) {
    console.warn('[home/experiences] popularity snapshot unavailable:', popularityError.message);
  }

  const availableDatesByExperienceId = new Map<string, string[]>();
  for (const row of (availabilityRows ?? []) as AvailabilityRow[]) {
    const experienceId = asComparableId(row.experience_id);
    if (!visibleExperienceIds.has(experienceId) || typeof row.date !== 'string' || row.date.length === 0) {
      continue;
    }

    const existing = availableDatesByExperienceId.get(experienceId) ?? [];
    existing.push(row.date);
    availableDatesByExperienceId.set(experienceId, existing);
  }

  const popularityByExperienceId = new Map<string, number>();
  for (const row of (popularityRows ?? []) as PopularitySnapshotRow[]) {
    const experienceId = asComparableId(row.experience_id);
    if (!visibleExperienceIds.has(experienceId)) {
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
      public_image_r2_eligible: isPublicExperienceR2Eligible(experience),
      is_superhost: superhostIds.has(String(experience.host_id || '')),
      card_image_url: experience.photos?.[0] ?? experience.image_url ?? null,
      available_dates: availableDatesByExperienceId.get(String(experience.id)) ?? [],
      wishlist_count: popularityByExperienceId.get(String(experience.id)) ?? 0,
    };
  });

  if (popularityError) {
    // Keep the existing non-fatal fallback, without caching a degraded snapshot.
    throw new PopularitySnapshotUnavailable(data, popularityError.message);
  }

  return data;
}

const getCachedPublicHomeExperiences = unstable_cache(
  loadPublicHomeExperiences,
  [HOME_PUBLIC_CACHE_KEY],
  { revalidate: HOME_PUBLIC_REVALIDATE_SECONDS }
);

export async function getPublicHomeExperiences(): Promise<{ data: PublicHomeExperience[]; updatedAt: number }> {
  let data: PublicHomeExperience[];
  try {
    data = process.env.NODE_ENV === 'production'
      ? await getCachedPublicHomeExperiences()
      : await loadPublicHomeExperiences();
  } catch (error) {
    if (!(error instanceof PopularitySnapshotUnavailable)) throw error;
    data = error.fallbackData;
  }

  return { data, updatedAt: Date.now() };
}
