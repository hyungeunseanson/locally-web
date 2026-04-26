import { getHostPublicProfile } from '@/app/utils/profile';
import {
  EXPERIENCE_LOCALES,
  type ExperienceLocale,
} from '@/app/utils/experienceTranslation';
import {
  normalizeLanguageLevels,
  type LanguageLevelEntry,
} from '@/app/utils/languageLevels';
import type {
  ExperienceDetail,
  ExperienceItineraryItem,
  ExperienceRules,
  HostProfileDetail,
} from './types';

export type ExperienceRawRow = Record<string, unknown>;

export type PublicHostApplicationViewModel = {
  id: string | null;
  user_id: string | null;
  created_at: string | null;
  status: string | null;
  name: string | null;
  profile_photo: string | null;
  self_intro: string | null;
  languages: string[];
  is_superhost: boolean;
};

export type HostProfileSourceViewModel = {
  created_at: string | null;
  avatar_url: string | null;
  full_name: string | null;
  introduction: string | null;
  languages: string[];
  job: string | null;
  dream_destination: string | null;
  favorite_song: string | null;
  nationality: string | null;
  host_nationality: string | null;
  average_rating: number | null;
  total_review_count: number | null;
};

export type ExperienceMetadataViewModel = {
  id: string;
  host_id: string | null;
  title: string;
  description: string;
  title_ko: string | null;
  description_ko: string | null;
  title_en: string | null;
  description_en: string | null;
  title_ja: string | null;
  description_ja: string | null;
  title_zh: string | null;
  description_zh: string | null;
  photos: string[];
  image_url: string | null;
  status: string | null;
  is_active: boolean | null;
};

type ExperienceReviewAggregate = {
  reviewCount: number;
  averageRating: number | null;
};

type LocalizedTextMap = Partial<Record<ExperienceLocale, string>>;
type LocalizedStringListMap = Partial<Record<ExperienceLocale, string[]>>;
type LocalizedItineraryMap = Partial<Record<ExperienceLocale, ExperienceItineraryItem[]>>;
type LocalizedRulesMap = Partial<Record<ExperienceLocale, ExperienceRules>>;

const EXPERIENCE_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1540206395-688085723adb';

export function isExperienceRawRow(value: unknown): value is ExperienceRawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toExperienceRawRow(value: unknown): ExperienceRawRow | null {
  return isExperienceRawRow(value) ? value : null;
}

export function toExperienceRawRows(value: unknown): ExperienceRawRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isExperienceRawRow);
}

function isExperienceLocale(value: string): value is ExperienceLocale {
  return EXPERIENCE_LOCALES.includes(value as ExperienceLocale);
}

function readStringField(row: ExperienceRawRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function readTrimmedStringField(row: ExperienceRawRow, key: string): string | null {
  const value = readStringField(row, key)?.trim();
  return value ? value : null;
}

export function normalizeIdentifierValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readIdentifierField(row: ExperienceRawRow, key: string): string | null {
  return normalizeIdentifierValue(row[key]);
}

function readNumberField(row: ExperienceRawRow, key: string): number | null {
  const value = row[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readBooleanField(row: ExperienceRawRow, key: string): boolean | null {
  const value = row[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return null;
}

function readStringArrayField(row: ExperienceRawRow, key: string): string[] {
  const value = row[key];

  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.reduce<string[]>((acc, entry) => {
    if (typeof entry !== 'string') {
      return acc;
    }

    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return acc;
    }

    seen.add(trimmed);
    acc.push(trimmed);
    return acc;
  }, []);
}

function readObjectField(row: ExperienceRawRow, key: string): ExperienceRawRow | null {
  const value = row[key];
  return isExperienceRawRow(value) ? value : null;
}

function normalizeExperienceItineraryItem(value: unknown): ExperienceItineraryItem | null {
  if (!isExperienceRawRow(value)) {
    return null;
  }

  return {
    title: readTrimmedStringField(value, 'title') ?? '',
    description: readTrimmedStringField(value, 'description') ?? '',
    type: readTrimmedStringField(value, 'type') ?? 'spot',
    image_url: readTrimmedStringField(value, 'image_url') ?? '',
  };
}

function normalizeExperienceItineraryArray(value: unknown): ExperienceItineraryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeExperienceItineraryItem(entry))
    .filter((entry): entry is ExperienceItineraryItem => entry !== null);
}

function normalizeExperienceRules(value: unknown): ExperienceRules {
  const row = isExperienceRawRow(value) ? value : null;

  return {
    age_limit: row ? readTrimmedStringField(row, 'age_limit') ?? '' : '',
    activity_level: row ? readTrimmedStringField(row, 'activity_level') ?? '' : '',
    refund_policy: row ? readTrimmedStringField(row, 'refund_policy') ?? '' : '',
    host_notice: row ? readTrimmedStringField(row, 'host_notice') ?? '' : '',
  };
}

function readLocalizedTextMap(row: ExperienceRawRow, key: string): LocalizedTextMap {
  const source = readObjectField(row, key);
  if (!source) {
    return {};
  }

  const normalized: LocalizedTextMap = {};

  for (const [localeKey, localeValue] of Object.entries(source)) {
    if (!isExperienceLocale(localeKey) || typeof localeValue !== 'string') {
      continue;
    }

    const trimmed = localeValue.trim();
    if (trimmed) {
      normalized[localeKey] = trimmed;
    }
  }

  return normalized;
}

function readLocalizedStringListMap(
  row: ExperienceRawRow,
  key: string
): LocalizedStringListMap {
  const source = readObjectField(row, key);
  if (!source) {
    return {};
  }

  const normalized: LocalizedStringListMap = {};

  for (const localeKey of EXPERIENCE_LOCALES) {
    const localeValue = source[localeKey];
    if (!localeValue) {
      continue;
    }

    const values = Array.isArray(localeValue)
      ? localeValue
      : [];

    const nextValues = values.reduce<string[]>((acc, entry) => {
      if (typeof entry !== 'string') {
        return acc;
      }

      const trimmed = entry.trim();
      if (trimmed) {
        acc.push(trimmed);
      }
      return acc;
    }, []);

    if (nextValues.length > 0) {
      normalized[localeKey] = nextValues;
    }
  }

  return normalized;
}

function readLocalizedItineraryMap(row: ExperienceRawRow, key: string): LocalizedItineraryMap {
  const source = readObjectField(row, key);
  if (!source) {
    return {};
  }

  const normalized: LocalizedItineraryMap = {};

  for (const localeKey of EXPERIENCE_LOCALES) {
    const nextValue = normalizeExperienceItineraryArray(source[localeKey]);
    if (nextValue.length > 0) {
      normalized[localeKey] = nextValue;
    }
  }

  return normalized;
}

function readLocalizedRulesMap(row: ExperienceRawRow, key: string): LocalizedRulesMap {
  const source = readObjectField(row, key);
  if (!source) {
    return {};
  }

  const normalized: LocalizedRulesMap = {};

  for (const localeKey of EXPERIENCE_LOCALES) {
    const nextValue = normalizeExperienceRules(source[localeKey]);
    if (
      nextValue.age_limit ||
      nextValue.activity_level ||
      nextValue.refund_policy ||
      nextValue.host_notice
    ) {
      normalized[localeKey] = nextValue;
    }
  }

  return normalized;
}

function readLanguageLevelEntries(row: ExperienceRawRow): LanguageLevelEntry[] {
  return normalizeLanguageLevels(row.language_levels, row.languages, 3);
}

function readExperienceBaseFields(row: ExperienceRawRow): ExperienceMetadataViewModel | null {
  const id = readIdentifierField(row, 'id');
  if (!id) {
    return null;
  }

  return {
    id,
    host_id: readTrimmedStringField(row, 'host_id'),
    title: readTrimmedStringField(row, 'title') ?? '체험',
    description: readStringField(row, 'description') ?? '',
    title_ko: readStringField(row, 'title_ko'),
    description_ko: readStringField(row, 'description_ko'),
    title_en: readStringField(row, 'title_en'),
    description_en: readStringField(row, 'description_en'),
    title_ja: readStringField(row, 'title_ja'),
    description_ja: readStringField(row, 'description_ja'),
    title_zh: readStringField(row, 'title_zh'),
    description_zh: readStringField(row, 'description_zh'),
    photos: readStringArrayField(row, 'photos'),
    image_url: readTrimmedStringField(row, 'image_url'),
    status: readTrimmedStringField(row, 'status'),
    is_active: readBooleanField(row, 'is_active'),
  };
}

export function normalizePublicHostApplicationRow(
  raw: unknown
): PublicHostApplicationViewModel | null {
  const row = toExperienceRawRow(raw);
  if (!row) {
    return null;
  }

  return {
    id: readIdentifierField(row, 'id'),
    user_id: readTrimmedStringField(row, 'user_id'),
    created_at: readTrimmedStringField(row, 'created_at'),
    status: readTrimmedStringField(row, 'status'),
    name: readTrimmedStringField(row, 'name'),
    profile_photo: readTrimmedStringField(row, 'profile_photo'),
    self_intro: readStringField(row, 'self_intro'),
    languages: readStringArrayField(row, 'languages'),
    is_superhost: readBooleanField(row, 'is_superhost') ?? false,
  };
}

export function normalizePublicHostApplicationRows(
  raw: unknown
): PublicHostApplicationViewModel[] {
  return toExperienceRawRows(raw)
    .map((row) => normalizePublicHostApplicationRow(row))
    .filter((row): row is PublicHostApplicationViewModel => row !== null);
}

export function normalizeExperienceMetadataRow(
  raw: unknown
): ExperienceMetadataViewModel | null {
  const row = toExperienceRawRow(raw);
  return row ? readExperienceBaseFields(row) : null;
}

export function normalizeExperienceDetailRow(raw: unknown): ExperienceDetail | null {
  const row = toExperienceRawRow(raw);
  if (!row) {
    return null;
  }

  const base = readExperienceBaseFields(row);
  if (!base) {
    return null;
  }

  return {
    ...base,
    city: readTrimmedStringField(row, 'city'),
    subCity: readTrimmedStringField(row, 'subCity'),
    country: readTrimmedStringField(row, 'country'),
    category: readTrimmedStringField(row, 'category'),
    category_en: readStringField(row, 'category_en'),
    category_ja: readStringField(row, 'category_ja'),
    category_zh: readStringField(row, 'category_zh'),
    languages: readStringArrayField(row, 'languages'),
    language_levels: readLanguageLevelEntries(row),
    meeting_point: readStringField(row, 'meeting_point') ?? '',
    meeting_point_i18n: readLocalizedTextMap(row, 'meeting_point_i18n'),
    location: readStringField(row, 'location') ?? '',
    rating: readNumberField(row, 'rating') ?? 0,
    review_count: readNumberField(row, 'review_count') ?? 0,
    price: readNumberField(row, 'price') ?? 0,
    private_price: readNumberField(row, 'private_price'),
    is_private_enabled: readBooleanField(row, 'is_private_enabled') ?? false,
    max_guests: readNumberField(row, 'max_guests') ?? 10,
    duration: readNumberField(row, 'duration'),
    supplies: readStringField(row, 'supplies') ?? '',
    supplies_i18n: readLocalizedTextMap(row, 'supplies_i18n'),
    inclusions: readStringArrayField(row, 'inclusions'),
    inclusions_i18n: readLocalizedStringListMap(row, 'inclusions_i18n'),
    exclusions: readStringArrayField(row, 'exclusions'),
    exclusions_i18n: readLocalizedStringListMap(row, 'exclusions_i18n'),
    itinerary: normalizeExperienceItineraryArray(row.itinerary),
    itinerary_i18n: readLocalizedItineraryMap(row, 'itinerary_i18n'),
    rules: normalizeExperienceRules(row.rules),
    rules_i18n: readLocalizedRulesMap(row, 'rules_i18n'),
  };
}

export function normalizeHostProfileRow(raw: unknown): HostProfileSourceViewModel | null {
  const row = toExperienceRawRow(raw);
  if (!row) {
    return null;
  }

  return {
    created_at: readTrimmedStringField(row, 'created_at'),
    avatar_url: readTrimmedStringField(row, 'avatar_url'),
    full_name: readTrimmedStringField(row, 'full_name'),
    introduction: readStringField(row, 'introduction'),
    languages: readStringArrayField(row, 'languages'),
    job: readTrimmedStringField(row, 'job'),
    dream_destination: readTrimmedStringField(row, 'dream_destination'),
    favorite_song: readTrimmedStringField(row, 'favorite_song'),
    nationality: readTrimmedStringField(row, 'nationality'),
    host_nationality: readTrimmedStringField(row, 'host_nationality'),
    average_rating: readNumberField(row, 'average_rating'),
    total_review_count: readNumberField(row, 'total_review_count'),
  };
}

export function normalizeReviewRatingRows(raw: unknown): number[] {
  return toExperienceRawRows(raw).reduce<number[]>((acc, row) => {
    const rating = readNumberField(row, 'rating');
    if (rating !== null) {
      acc.push(rating);
    }
    return acc;
  }, []);
}

export function getHostReviewAggregateFromRatings(
  ratings: number[]
): ExperienceReviewAggregate {
  if (ratings.length === 0) {
    return {
      reviewCount: 0,
      averageRating: null,
    };
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);

  return {
    reviewCount: ratings.length,
    averageRating: Number((total / ratings.length).toFixed(2)),
  };
}

export function buildHostProfileDetail(params: {
  hostId: string | null;
  profile: HostProfileSourceViewModel | null;
  publicHostApplication: PublicHostApplicationViewModel | null;
  fallbackName?: string;
  reviewAggregate: ExperienceReviewAggregate;
}): HostProfileDetail {
  if (!params.hostId) {
    return null;
  }

  const publicProfile = getHostPublicProfile(
    params.profile,
    params.publicHostApplication,
    params.fallbackName ?? 'Locally Host'
  );

  return {
    id: params.hostId,
    name: publicProfile.name,
    avatar_url: publicProfile.avatarUrl ?? undefined,
    nationality: publicProfile.location ?? undefined,
    languages: publicProfile.languages,
    introduction: publicProfile.bio || '안녕하세요! 로컬리 호스트입니다.',
    job: publicProfile.job ?? undefined,
    dream_destination: publicProfile.dreamDestination ?? undefined,
    favorite_song: publicProfile.favoriteSong ?? undefined,
    is_superhost: Boolean(params.publicHostApplication?.is_superhost),
    joined_year: getJoinedYear(publicProfile.createdAt),
    review_count: params.reviewAggregate.reviewCount,
    rating: params.reviewAggregate.averageRating,
  };
}

export function getJoinedYear(createdAt: string | null): number | null {
  if (!createdAt) {
    return null;
  }

  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(1, new Date().getFullYear() - new Date(timestamp).getFullYear());
}

export function isPublicExperienceViewModel(experience: {
  status: string | null;
  is_active: boolean | null;
}) {
  return experience.status === 'active' && experience.is_active !== false;
}

export function getExperiencePrimaryImage(experience: {
  photos: string[];
  image_url: string | null;
}) {
  return experience.photos[0] || experience.image_url || EXPERIENCE_FALLBACK_IMAGE;
}
