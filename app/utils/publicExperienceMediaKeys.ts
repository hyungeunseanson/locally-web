import {
  normalizePublicExperienceSourceUrl as normalizeSourceContract,
  sha256Hex,
} from './publicExperienceMediaSourceContract.mjs';

export { sha256Hex };

const LEGACY_CARD_IDENTITIES = new Set(['4523:7922aaf9f75b']);

export const PUBLIC_EXPERIENCE_CARD_DERIVATIVES = [
  { name: 'small', width: 384, quality: 65 },
  { name: 'large', width: 640, quality: 65 },
] as const;

export const PUBLIC_EXPERIENCE_DETAIL_DERIVATIVES = [
  { name: 'small', width: 480, quality: 75 },
  { name: 'medium', width: 960, quality: 75 },
  { name: 'large', width: 1440, quality: 75 },
] as const;

export type PublicExperienceR2Eligibility = {
  status?: string | null;
  is_active?: boolean | null;
};

export type PublicExperienceSource = {
  sourceUrl: string;
  sourceKey: string;
  sourceKeySha256: string;
  sourceByteSha256: string | null;
  derivativeIdentity: string;
  sourceKind: 'supabase' | 'r2';
  r2Key: string | null;
};

export function normalizePublicExperienceSourceUrl(
  sourceUrl: string
): PublicExperienceSource {
  return normalizeSourceContract(sourceUrl) as PublicExperienceSource;
}

function normalizeExperienceId(experienceId: number | string) {
  const normalized = String(experienceId);
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Public experience media keys require a numeric experience ID.');
  }
  return normalized;
}

export function buildPublicExperienceCardKeys(
  experienceId: number | string,
  sourceUrl: string
) {
  const id = normalizeExperienceId(experienceId);
  const identity = normalizePublicExperienceSourceUrl(sourceUrl).derivativeIdentity;
  const prefix = LEGACY_CARD_IDENTITIES.has(`${id}:${identity}`)
    ? `experience-${id}-primary`
    : `cards/experience-${id}-primary-${identity}`;
  const [small, large] = PUBLIC_EXPERIENCE_CARD_DERIVATIVES;
  return {
    smallKey: `${prefix}-w${small.width}-q${small.quality}.webp`,
    largeKey: `${prefix}-w${large.width}-q${large.quality}.webp`,
  };
}

export function buildPublicExperienceDetailKeys(
  experienceId: number | string,
  sourceUrl: string
) {
  const id = normalizeExperienceId(experienceId);
  const identity = normalizePublicExperienceSourceUrl(sourceUrl).derivativeIdentity;
  const [small, medium, large] = PUBLIC_EXPERIENCE_DETAIL_DERIVATIVES;
  return {
    smallKey: `details/experience-${id}-${identity}-w${small.width}-q${small.quality}.webp`,
    mediumKey: `details/experience-${id}-${identity}-w${medium.width}-q${medium.quality}.webp`,
    largeKey: `details/experience-${id}-${identity}-w${large.width}-q${large.quality}.webp`,
  };
}

function extensionForContentType(contentType: string) {
  const extensions: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  const extension = extensions[normalized];
  if (!extension) throw new Error('Public experience original content type is unsupported.');
  return extension;
}

export function buildPublicExperienceOriginalKey(
  sourceObjectKey: string,
  sourceByteSha256: string,
  contentType: string
) {
  const source = `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/${sourceObjectKey}`;
  const normalized = normalizePublicExperienceSourceUrl(source);
  if (normalized.sourceKind !== 'supabase') {
    throw new Error('Public experience original source key is outside the approved namespace.');
  }
  if (!/^[0-9a-f]{64}$/.test(sourceByteSha256)) {
    throw new Error('Public experience original requires a lowercase SHA-256.');
  }
  return `originals/v1/${normalized.sourceKeySha256.slice(0, 2)}/${normalized.sourceKeySha256}/${sourceByteSha256}.${extensionForContentType(contentType)}`;
}

export function isPublicExperienceR2Eligible(
  experience?: PublicExperienceR2Eligibility | null
) {
  return experience?.status === 'active' && experience.is_active === true;
}
