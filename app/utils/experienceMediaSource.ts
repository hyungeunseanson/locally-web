import { sha256Hex } from './publicExperienceMediaKeys';

export const EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const EXPERIENCE_MEDIA_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const EXPERIENCE_MEDIA_SOURCE_BASE_URL = 'https://media-canary.locally-travel.com';
const CONTENT_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);

type R2Object = { size: number; httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> };
export type ExperienceMediaSourceR2 = {
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: Uint8Array, options: { onlyIf: { etagDoesNotMatch: '*' }; httpMetadata: { contentType: string; cacheControl: string }; customMetadata: Record<string, string>; sha256: string }): Promise<R2Object | null>;
};

export function experienceMediaSourceEnabled(environment: { CLOUDFLARE_DEPLOYMENT_ENV?: string; EXPERIENCE_MEDIA_R2_SOURCE_ENABLED?: string }) {
  return environment.CLOUDFLARE_DEPLOYMENT_ENV === 'production' && environment.EXPERIENCE_MEDIA_R2_SOURCE_ENABLED === 'true';
}

export function resolveExperienceMediaUploadOwner(input: {
  actorId: string;
  isAdmin: boolean;
  experienceHostId?: string | null;
}) {
  if (!input.experienceHostId) return input.actorId;
  if (!input.isAdmin && input.experienceHostId !== input.actorId) {
    throw new Error('experience_media_upload_forbidden');
  }
  return input.experienceHostId;
}

export function normalizeExperienceImageContentType(value: string) {
  const normalized = value.split(';', 1)[0].trim().toLowerCase();
  if (!CONTENT_TYPES.has(normalized)) throw new Error('experience_media_unsupported_content_type');
  return normalized;
}

function extensionForContentType(contentType: string) {
  return ({ 'image/avif': 'avif', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[contentType];
}

export function hasExpectedExperienceImageMagic(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (contentType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(new TextDecoder().decode(bytes.slice(0, 6)));
  if (contentType === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (contentType === 'image/avif') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 12)).includes('ftyp');
  return false;
}

export function buildExperienceMediaSourceKey(input: { ownerId: string; assetId: string; folder: 'hero' | 'itinerary'; contentType: string }) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.ownerId) || !uuid.test(input.assetId)) throw new Error('experience_media_invalid_identity');
  const ownerScope = sha256Hex(`experience-media-owner:${input.ownerId}`);
  return `sources/v1/experience/${ownerScope}/${input.assetId}/${input.folder}.${extensionForContentType(input.contentType)}`;
}

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function createExperienceMediaR2Source(input: { binding: ExperienceMediaSourceR2; ownerId: string; folder: 'hero' | 'itinerary'; bytes: Uint8Array; contentType: string; assetId?: string; now?: () => Date }) {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > EXPERIENCE_MEDIA_SOURCE_MAX_BYTES) throw new Error('experience_media_invalid_size');
  const contentType = normalizeExperienceImageContentType(input.contentType);
  if (!hasExpectedExperienceImageMagic(input.bytes, contentType)) throw new Error('experience_media_invalid_magic');
  const assetId = input.assetId ?? crypto.randomUUID();
  const key = buildExperienceMediaSourceKey({ ownerId: input.ownerId, assetId, folder: input.folder, contentType });
  const sha256 = await sha256Bytes(input.bytes);
  const created = await input.binding.put(key, input.bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType, cacheControl: EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL },
    customMetadata: { sha256, source_byte_sha256: sha256, output_byte_sha256: sha256, source_size: String(input.bytes.byteLength), source_key_sha256: sha256Hex(key), source_authority: 'r2-upload', provenance_status: 'verified', transform_schema_version: 'experience-source-v1', transform_engine: 'source-upload', owner_scope_sha256: sha256Hex(`experience-media-owner:${input.ownerId}`), uploaded_at: (input.now ?? (() => new Date()))().toISOString() },
    sha256,
  });
  if (!created) throw new Error('experience_media_source_conflict');
  const verified = await input.binding.head(key);
  if (!verified || verified.size !== input.bytes.byteLength || verified.customMetadata?.output_byte_sha256 !== sha256 || verified.httpMetadata?.contentType !== contentType || verified.httpMetadata?.cacheControl !== EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL) throw new Error('experience_media_source_verification_failed');
  return { key, sha256, publicUrl: `${EXPERIENCE_MEDIA_SOURCE_BASE_URL}/${key}` };
}
