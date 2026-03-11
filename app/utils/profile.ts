export type ProfileRole = 'guest' | 'host';

export type ProfileCompletionFieldKey =
  | 'avatar'
  | 'name'
  | 'bio'
  | 'languages'
  | 'nationality'
  | 'phone'
  | 'job'
  | 'school'
  | 'mbti';

export interface ProfileCompletionStatus {
  percent: number;
  missingFields: ProfileCompletionFieldKey[];
  requiredMissingFields: ProfileCompletionFieldKey[];
}

type AnyProfile = {
  avatar_url?: string | null;
  full_name?: string | null;
  name?: string | null;
  bio?: string | null;
  introduction?: string | null;
  languages?: string[] | string | null;
  nationality?: string | null;
  host_nationality?: string | null;
  phone?: string | null;
  job?: string | null;
  school?: string | null;
  mbti?: string | null;
};

type HostPublicProfileSource = {
  created_at?: string | null;
  avatar_url?: string | null;
  full_name?: string | null;
  bio?: string | null;
  introduction?: string | null;
  languages?: string[] | string | null;
  job?: string | null;
  dream_destination?: string | null;
  favorite_song?: string | null;
  nationality?: string | null;
  host_nationality?: string | null;
};

type HostApplicationPublicSource = {
  name?: string | null;
  profile_photo?: string | null;
  self_intro?: string | null;
  languages?: string[] | string | null;
  profession?: string | null;
  dream_destination?: string | null;
  favorite_song?: string | null;
  host_nationality?: string | null;
};

const COMPLETION_FIELDS: Record<
  ProfileRole,
  Array<{ key: ProfileCompletionFieldKey; required: boolean; getValue: (profile: AnyProfile) => unknown }>
> = {
  guest: [
    { key: 'avatar', required: true, getValue: (profile) => profile.avatar_url },
    { key: 'name', required: true, getValue: (profile) => profile.full_name || profile.name },
    { key: 'bio', required: true, getValue: (profile) => profile.bio || profile.introduction },
    { key: 'languages', required: true, getValue: (profile) => profile.languages },
    { key: 'nationality', required: true, getValue: (profile) => profile.nationality },
    { key: 'phone', required: true, getValue: (profile) => profile.phone },
    { key: 'job', required: false, getValue: (profile) => profile.job },
    { key: 'mbti', required: false, getValue: (profile) => profile.mbti },
  ],
  host: [
    { key: 'avatar', required: true, getValue: (profile) => profile.avatar_url },
    { key: 'name', required: true, getValue: (profile) => profile.full_name || profile.name },
    { key: 'bio', required: true, getValue: (profile) => profile.bio || profile.introduction },
    { key: 'languages', required: true, getValue: (profile) => profile.languages },
    { key: 'job', required: false, getValue: (profile) => profile.job },
  ],
};

export const PROFILE_COMPLETION_FIELD_LABELS: Record<ProfileCompletionFieldKey, string> = {
  avatar: '프로필 사진',
  name: '이름',
  bio: '자기소개',
  languages: '구사 언어',
  nationality: '국적',
  phone: '연락처',
  job: '직업',
  school: '학교',
  mbti: 'MBTI',
};

export function normalizeLanguageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

const PROFILE_LANGUAGE_ALIASES: Record<string, string> = {
  english: 'English',
  영어: 'English',
  korean: 'Korean',
  한국어: 'Korean',
  japanese: 'Japanese',
  일본어: 'Japanese',
  '日本語': 'Japanese',
  chinese: 'Chinese',
  중국어: 'Chinese',
  '中文': 'Chinese',
  spanish: 'Spanish',
  스페인어: 'Spanish',
  'español': 'Spanish',
  french: 'French',
  프랑스어: 'French',
  'français': 'French',
};

export function normalizeProfileLanguageValue(value: string): string {
  const trimmed = value.trim();
  const alias = PROFILE_LANGUAGE_ALIASES[trimmed.toLowerCase()];
  return alias || trimmed;
}

export function formatProfileLanguages(value: unknown, emptyLabel = '미입력'): string {
  const languages = normalizeLanguageList(value).map((language) => normalizeProfileLanguageValue(language));
  return languages.length > 0 ? languages.join(', ') : emptyLabel;
}

export function formatGenderLabel(value: string | null | undefined, emptyLabel = '비공개'): string {
  if (!value) return emptyLabel;
  if (value === 'Male') return '남성';
  if (value === 'Female') return '여성';
  if (value === 'Other') return '기타';
  return value;
}

export function getProfileDisplayName(
  profile: Pick<AnyProfile, 'full_name' | 'name'> | null | undefined,
  fallback = '로컬리 유저'
): string {
  if (!profile) return fallback;

  const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
  if (fullName) return fullName;

  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (name) return name;

  return fallback;
}

export function getProfileInitial(
  profile: Pick<AnyProfile, 'full_name' | 'name'> | null | undefined,
  fallback = '로'
): string {
  return getProfileDisplayName(profile, fallback).slice(0, 1).toUpperCase();
}

export function getHostPublicProfile(
  profile: HostPublicProfileSource | null | undefined,
  hostApplication: HostApplicationPublicSource | null | undefined,
  fallbackName = 'Locally Host'
) {
  const name = getProfileDisplayName(
    {
      full_name: profile?.full_name,
      name: hostApplication?.name,
    },
    fallbackName
  );

  return {
    name,
    avatarUrl: profile?.avatar_url || hostApplication?.profile_photo || null,
    bio: hostApplication?.self_intro || profile?.introduction || null,
    languages:
      normalizeLanguageList(profile?.languages).length > 0
        ? normalizeLanguageList(profile?.languages)
        : normalizeLanguageList(hostApplication?.languages),
    job: profile?.job || hostApplication?.profession || null,
    dreamDestination: profile?.dream_destination || hostApplication?.dream_destination || null,
    favoriteSong: profile?.favorite_song || hostApplication?.favorite_song || null,
    location: profile?.host_nationality || profile?.nationality || hostApplication?.host_nationality || null,
    createdAt: profile?.created_at || null,
  };
}

export function getProfileCompletion(profile: AnyProfile, role: ProfileRole): ProfileCompletionStatus {
  const fields = COMPLETION_FIELDS[role];
  const missingFields = fields
    .filter((field) => !hasProfileValue(field.getValue(profile)))
    .map((field) => field.key);
  const requiredMissingFields = fields
    .filter((field) => field.required && !hasProfileValue(field.getValue(profile)))
    .map((field) => field.key);
  const filledCount = fields.length - missingFields.length;

  return {
    percent: Math.round((filledCount / fields.length) * 100),
    missingFields,
    requiredMissingFields,
  };
}

function hasProfileValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => String(item).trim());
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== null && value !== undefined;
}
