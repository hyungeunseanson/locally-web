import type { Experience } from '../../types';
import { createClient } from '../supabase/client';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplicationsByUser,
} from '../hostVisibility';

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

type PopularitySnapshotRow = {
  experience_id: number | string | null;
  wishlist_count: number | null;
};

export const fetchActiveExperiences = async (): Promise<Experience[]> => {
  const supabase = createClient();

  const { data: publicHostApplications, error: applicationError } = await supabase
    .from('public_host_applications')
    .select('id, user_id, status, created_at');

  if (applicationError) {
    throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  }

  const visibleHostIds = Array.from(
    pickLatestPublicHostApplicationsByUser((publicHostApplications || []) as PublicHostApplicationRow[])
      .values()
  )
    .filter((row) => isPublicHostApplicationStatus(row.status))
    .map((row) => row.user_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (visibleHostIds.length === 0) {
    return [];
  }

  const { data: experiences, error: experiencesError } = await supabase
    .from('experiences')
    .select('*')
    .eq('status', 'active')
    .in('host_id', visibleHostIds)
    .order('created_at', { ascending: false });

  if (experiencesError) {
    throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  }

  const experienceRows = (experiences || []) as Experience[];
  if (experienceRows.length === 0) {
    return [];
  }

  const experienceIds = experienceRows.map((experience) => experience.id);
  const { data: availabilityRows, error: availabilityError } = await supabase
    .from('experience_availability')
    .select('experience_id, date')
    .in('experience_id', experienceIds);

  if (availabilityError) {
    throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  }

  let popularityByExperienceId = new Map<string, number>();
  const { data: popularityRows, error: popularityError } = await supabase
    .from('experience_popularity_snapshot')
    .select('experience_id, wishlist_count')
    .in('experience_id', experienceIds);

  if (popularityError) {
    console.warn('[Home Experiences] Failed to load popularity snapshot:', popularityError.message);
  } else {
    popularityByExperienceId = new Map(
      ((popularityRows || []) as PopularitySnapshotRow[]).map((row) => [
        String(row.experience_id),
        Number.isFinite(row.wishlist_count) ? Number(row.wishlist_count) : 0,
      ])
    );
  }

  return experienceRows.map((experience) => ({
    ...experience,
    wishlist_count: popularityByExperienceId.get(String(experience.id)) ?? 0,
    available_dates:
      ((availabilityRows || []) as AvailabilityRow[])
        .filter((row) => String(row.experience_id) === String(experience.id))
        .map((row) => row.date)
        .filter((date): date is string => typeof date === 'string' && date.length > 0),
  }));
};
