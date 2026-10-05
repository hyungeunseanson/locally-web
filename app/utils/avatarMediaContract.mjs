import { sha256Hex } from './publicExperienceMediaSourceContract.mjs';

export const AVATAR_BUCKET = 'locally-public-avatars';
export const AVATAR_BASE_URL = 'https://avatars-media.locally-travel.com';
export const AVATAR_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;
export const SUPABASE_AVATAR_BASE = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

export function avatarOwnerScope(ownerId) {
  if (typeof ownerId !== 'string' || !UUID.test(ownerId)) throw new Error('avatar_invalid_owner');
  return sha256Hex(`avatar-media-owner:${ownerId}`);
}
export function avatarContentType(value) {
  const mime = typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : '';
  if (!Object.hasOwn(EXTENSIONS, mime)) throw new Error('avatar_unsupported_mime');
  return mime;
}
export function avatarKey(ownerId, assetId, mime) {
  if (!UUID.test(assetId)) throw new Error('avatar_invalid_asset');
  return `avatars/v1/${avatarOwnerScope(ownerId)}/${assetId}/avatar.${EXTENSIONS[avatarContentType(mime)]}`;
}
export function avatarWriteAuthority(environment, processFlag) {
  const flag = environment?.AVATAR_R2_SOURCE_ENABLED ?? processFlag;
  if (flag === undefined || flag === 'false') return 'supabase';
  if (flag !== 'true' || environment?.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' || !environment?.PUBLIC_AVATAR_R2) {
    throw new Error('avatar_r2_unavailable');
  }
  return 'r2';
}
export function isManagedAvatarUrl(value) {
  return typeof value === 'string' && value.startsWith(AVATAR_BASE_URL + '/avatars/v1/');
}
/** Exact canonical origin; no aliases, credentials, queries, fragments or traversal. */
export function legacyAvatarKey(value) {
  if (typeof value !== 'string' || !value.startsWith(SUPABASE_AVATAR_BASE)) return null;
  let parsed, key;
  try { parsed = new URL(value); key = parsed.pathname.slice(new URL(SUPABASE_AVATAR_BASE).pathname.length).split('/').map(decodeURIComponent).join('/'); }
  catch { throw new Error('avatar_invalid_legacy_locator'); }
  if (parsed.search || parsed.hash || !key || /[\x00-\x1f\\]/.test(key) || key.split('/').some(part => !part || part === '.' || part === '..') || value !== SUPABASE_AVATAR_BASE + key.split('/').map(encodeURIComponent).join('/')) {
    throw new Error('avatar_invalid_legacy_locator');
  }
  return key;
}
