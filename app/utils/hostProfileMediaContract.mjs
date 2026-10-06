import { sha256Hex } from './publicExperienceMediaSourceContract.mjs';
export const HOST_PROFILE_BUCKET = 'locally-public-host-profile-originals';
export const HOST_PROFILE_BASE_URL = 'https://host-profile-media.locally-travel.com';
export const HOST_PROFILE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const HOST_PROFILE_MAX_BYTES = 10 * 1024 * 1024;
export const HOST_PROFILE_LEGACY_BASE = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function hostProfileOwnerScope(owner) {
  if (!UUID.test(owner)) throw Error('host_profile_owner_invalid');
  return sha256Hex('host-profile-media-owner:' + owner);
}
export function hostProfileKey(owner, asset) {
  if (!UUID.test(asset)) throw Error('host_profile_asset_invalid');
  return `host-profiles/v1/${hostProfileOwnerScope(owner)}/${asset}/profile`;
}
export function hostProfileMime(value) {
  const mime = typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : '';
  // Preserve image.ts's image/* compression-fallback semantics, including SVG.
  if (!/^image\/[a-z0-9][a-z0-9.+-]{0,79}$/.test(mime) || ['image/heic','image/heif'].includes(mime)) throw Error('host_profile_mime_invalid');
  return mime;
}
export function hostProfileWriteAuthority(env, flag) {
  const enabled = env?.HOST_PROFILE_R2_SOURCE_ENABLED ?? flag;
  if (enabled === undefined || enabled === 'false') return 'supabase';
  if (enabled !== 'true' || env?.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' || !env?.PUBLIC_HOST_PROFILE_SOURCE_R2) throw Error('host_profile_r2_unavailable');
  return 'r2';
}
export function legacyHostProfileKey(value) {
  if (typeof value !== 'string' || !value.startsWith(HOST_PROFILE_LEGACY_BASE)) return null;
  const key = value.slice(HOST_PROFILE_LEGACY_BASE.length);
  if (!key.startsWith('profile/')) return null;
  if (!/^profile\/[a-f0-9-]{36}_[0-9]+$/.test(key)) throw Error('host_profile_locator_invalid');
  return key;
}
export function isManagedHostProfileUrl(value) {
  return typeof value === 'string' && value.startsWith(HOST_PROFILE_BASE_URL + '/host-profiles/v1/');
}
