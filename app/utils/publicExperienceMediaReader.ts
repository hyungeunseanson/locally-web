import {
  buildPublicExperienceCardKeys,
  buildPublicExperienceDetailKeys,
} from '@/app/utils/publicExperienceMediaKeys';

export const PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED_VARIABLE =
  'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED';
export const PUBLIC_EXPERIENCE_MEDIA_READER_IDS_VARIABLE =
  'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS';

type PublicExperienceMediaReaderConfiguration = {
  enabled?: string;
  experienceIds?: string;
};

function normalizeExperienceId(experienceId: number | string) {
  const normalized = String(experienceId);
  return /^\d+$/.test(normalized) && Number(normalized) > 0 ? normalized : null;
}

function readBuildTimeConfiguration(): PublicExperienceMediaReaderConfiguration {
  return {
    enabled: process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED,
    experienceIds: process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS,
  };
}

export function parsePublicExperienceMediaReaderAllowlist(
  configuration: PublicExperienceMediaReaderConfiguration
) {
  if (configuration.enabled !== 'true') return new Set<string>();

  const rawIds = configuration.experienceIds?.trim() ?? '';
  if (!rawIds) return new Set<string>();

  const ids = rawIds.split(',').map((value) => value.trim());
  if (ids.some((value) => !/^\d+$/.test(value) || Number(value) <= 0)) {
    return new Set<string>();
  }

  return new Set(ids);
}

export function isPublicExperienceDeterministicReaderTarget(
  experienceId: number | string,
  configuration = readBuildTimeConfiguration()
) {
  const normalizedId = normalizeExperienceId(experienceId);
  if (!normalizedId) return false;
  return parsePublicExperienceMediaReaderAllowlist(configuration).has(normalizedId);
}

export function getDeterministicPublicExperienceCardKeys(
  experienceId: number | string,
  originImageUrl: string,
  r2Eligible: boolean
) {
  if (!r2Eligible) return null;
  try {
    return buildPublicExperienceCardKeys(experienceId, originImageUrl);
  } catch {
    return null;
  }
}

export function getDeterministicPublicExperienceDetailKeys(
  experienceId: number | string,
  originImageUrl: string,
  r2Eligible: boolean
) {
  if (!r2Eligible) return null;
  try {
    return buildPublicExperienceDetailKeys(experienceId, originImageUrl);
  } catch {
    return null;
  }
}
