import { sha256Hex } from './publicExperienceMediaSourceContract.mjs';
export const COMMUNITY_BUCKET = 'locally-public-community-originals';
export const COMMUNITY_BASE_URL = 'https://community-media.locally-travel.com';
export const COMMUNITY_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const COMMUNITY_MAX_BYTES = 10 * 1024 * 1024;
export const COMMUNITY_LEGACY_BASE = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/';
export const COMMUNITY_RASTER_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function communityOwnerScope(owner) {
  if (!UUID.test(owner)) throw Error('community_owner_invalid');
  return sha256Hex('community-media-owner:' + owner);
}
export function communityKey(owner, asset) {
  if (!UUID.test(asset)) throw Error('community_asset_invalid');
  return `community/v1/${communityOwnerScope(owner)}/${asset}/image`;
}
export function communityMime(value) {
  const mime = typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : '';
  if (!COMMUNITY_RASTER_MIMES.includes(mime)) throw Error('community_mime_invalid');
  return mime;
}
export function communityWriteAuthority(env, flag) {
  const enabled = env?.COMMUNITY_R2_SOURCE_ENABLED ?? flag;
  if (enabled === undefined || enabled === 'false') return 'supabase';
  if (enabled !== 'true' || env?.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' || !env?.PUBLIC_COMMUNITY_SOURCE_R2 || !env?.IMAGES) throw Error('community_r2_unavailable');
  return 'r2';
}
export function legacyCommunityKey(value) {
  if (typeof value !== 'string' || !value.startsWith(COMMUNITY_LEGACY_BASE)) return null;
  const key = value.slice(COMMUNITY_LEGACY_BASE.length);
  if (!key.startsWith('community/')) return null;
  // Retained flat filenames and newer owner folders are both existing source contracts.
  if (!/^community\/(?:[a-f0-9-]{36}\/)?[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(key) || key.includes('..')) throw Error('community_locator_invalid');
  return key;
}
export function isManagedCommunityUrl(value) {
  return typeof value === 'string' && /^https:\/\/community-media\.locally-travel\.com\/community\/v1\/[a-f0-9]{64}\/[a-f0-9-]{36}\/image$/.test(value);
}
