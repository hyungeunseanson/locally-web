import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createPublicServerClient } from '@/app/utils/supabase/public-server';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';
import type { ExperienceDetail, HostProfileDetail } from './types';
import {
  buildHostProfileDetail,
  getHostReviewAggregateFromRatings,
  isPublicExperienceViewModel,
  normalizeExperienceDetailRow,
  normalizeHostProfileRow,
  normalizeIdentifierValue,
  normalizePublicHostApplicationRows,
  normalizeReviewRatingRows,
  toExperienceRawRows,
  type PublicHostApplicationViewModel,
} from './experienceRowHelpers';

// Public copy may lag writes briefly, but availability and booking capacity never use this cache.
export const PUBLIC_EXPERIENCE_DETAIL_REVALIDATE_SECONDS = 60;

export const EXPERIENCE_DETAIL_SELECT = [
  'id',
  'host_id',
  'title',
  'description',
  'title_ko',
  'description_ko',
  'title_en',
  'description_en',
  'title_ja',
  'description_ja',
  'title_zh',
  'description_zh',
  'city',
  'country',
  'category',
  'category_en',
  'category_ja',
  'category_zh',
  'languages',
  'language_levels',
  'meeting_point',
  'meeting_point_i18n',
  'location',
  'rating',
  'review_count',
  'price',
  'private_price',
  'is_private_enabled',
  'solo_guarantee_price',
  'solo_guarantee_option_visible',
  'photos',
  'image_url',
  'max_guests',
  'duration',
  'supplies',
  'supplies_i18n',
  'inclusions',
  'inclusions_i18n',
  'exclusions',
  'exclusions_i18n',
  'itinerary',
  'itinerary_i18n',
  'rules',
  'rules_i18n',
  'status',
  'is_active',
].join(', ');

const HOST_PROFILE_SELECT = [
  'id',
  'created_at',
  'avatar_url',
  'full_name',
  'introduction',
  'languages',
  'job',
  'dream_destination',
  'favorite_song',
  'nationality',
  'host_nationality',
  'average_rating',
  'total_review_count',
].join(', ');

const PUBLIC_HOST_APPLICATION_SELECT = [
  'id',
  'user_id',
  'created_at',
  'status',
  'name',
  'profile_photo',
  'self_intro',
  'languages',
  'is_superhost',
].join(', ');

export type PublicExperienceDetailSnapshot = {
  experience: ExperienceDetail;
  hostProfile: HostProfileDetail;
  publicHostApplication: PublicHostApplicationViewModel;
};

async function loadPublicHostApplication(supabase: SupabaseClient, hostId: string) {
  const { data, error } = await supabase
    .from('public_host_applications')
    .select(PUBLIC_HOST_APPLICATION_SELECT)
    .eq('user_id', hostId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return pickLatestPublicHostApplication(normalizePublicHostApplicationRows(data));
}

async function loadHostReviewAggregate(supabase: SupabaseClient, hostId: string) {
  const { data: experienceRows, error: experienceError } = await supabase
    .from('experiences')
    .select('id')
    .eq('host_id', hostId);

  if (experienceError) {
    throw experienceError;
  }

  const targetExperienceIds = toExperienceRawRows(experienceRows).reduce<string[]>((ids, row) => {
    const id = normalizeIdentifierValue(row.id);
    if (id) ids.push(id);
    return ids;
  }, []);

  if (targetExperienceIds.length === 0) {
    return getHostReviewAggregateFromRatings([]);
  }

  const { data: reviewRows, error: reviewError } = await supabase
    .from('reviews')
    .select('rating')
    .in('experience_id', targetExperienceIds);

  if (reviewError) {
    throw reviewError;
  }

  return getHostReviewAggregateFromRatings(normalizeReviewRatingRows(reviewRows));
}

async function loadPublicExperienceDetailUncached(
  id: string
): Promise<PublicExperienceDetailSnapshot | null> {
  const supabase = createPublicServerClient();
  const { data: rawExperience, error: experienceError } = await supabase
    .from('experiences')
    .select(EXPERIENCE_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (experienceError) {
    throw experienceError;
  }

  const experience = normalizeExperienceDetailRow(rawExperience);
  if (!experience || !isPublicExperienceViewModel(experience) || !experience.host_id) {
    return null;
  }

  const publicHostApplication = await loadPublicHostApplication(supabase, experience.host_id);
  if (!publicHostApplication || !isPublicHostApplicationStatus(publicHostApplication.status)) {
    return null;
  }

  const { data: rawProfile, error: profileError } = await supabase
    .from('public_profiles')
    .select(HOST_PROFILE_SELECT)
    .eq('id', experience.host_id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const profile = normalizeHostProfileRow(rawProfile);
  const cachedReviewCount = profile?.total_review_count;
  const cachedAverageRating = profile?.average_rating;
  const reviewAggregate =
    cachedReviewCount !== null &&
    cachedReviewCount !== undefined &&
    cachedReviewCount >= 0 &&
    cachedAverageRating !== null &&
    cachedAverageRating !== undefined
      ? {
          reviewCount: cachedReviewCount,
          averageRating: Number(cachedAverageRating.toFixed(2)),
        }
      : await loadHostReviewAggregate(supabase, experience.host_id);

  const hostProfile = buildHostProfileDetail({
    hostId: experience.host_id,
    profile,
    publicHostApplication,
    fallbackName: 'Locally Host',
    reviewAggregate,
  });

  return {
    experience,
    hostProfile,
    publicHostApplication,
  };
}

async function loadPublicExperienceDetail(id: string) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return await loadPublicExperienceDetailUncached(id);
    }

    return await unstable_cache(
      () => loadPublicExperienceDetailUncached(id),
      ['public-experience-detail', id],
      {
        revalidate: PUBLIC_EXPERIENCE_DETAIL_REVALIDATE_SECONDS,
        tags: ['public-experience-detail', `public-experience-detail-${id}`],
      }
    )();
  } catch (error) {
    // Preserve the existing cookie-aware path during transient public-cache failures.
    console.error('[Experience detail] Public cache read failed; using dynamic fallback:', {
      id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// React cache deduplicates generateMetadata and page reads in one render.
export const getPublicExperienceDetail = cache(loadPublicExperienceDetail);
