import { AVATAR_BASE_URL, AVATAR_BUCKET, AVATAR_CACHE_CONTROL, AVATAR_MAX_BYTES, avatarContentType, avatarKey, avatarOwnerScope } from './avatarMediaContract.mjs';
import { hasExpectedExperienceImageMagic, type ExperienceMediaSourceR2 } from './experienceMediaSource';
import { mediaByteSha } from './mediaLifecycle';

export class AvatarMediaError extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}
export type AvatarRegistry = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};
export type AvatarAsset = {
  id: string; owner_id: string; object_key: string; public_url: string;
  expected_sha256: string; expected_size: number; mime: string;
  provider: string; bucket: string; business_scope: string; parent_id: string;
  state: 'pending' | 'committed' | 'tombstoned'; verified_at?: string | null;
};
export function validateAvatarImage(bytes: Uint8Array, value: string) {
  let mime: string;
  try { mime = avatarContentType(value); } catch { throw new AvatarMediaError('avatar_unsupported_mime', 400); }
  // Match the existing raster contract; SVG/HEIC are never accepted. AVIF must
  // identify an AVIF brand, rather than merely being any ISO base media file.
  const avif = mime !== 'image/avif' || (bytes.length >= 16 && new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp'
    && /avif|avis/.test(new TextDecoder().decode(bytes.slice(8, Math.min(bytes.length, 64)))));
  if (!bytes.length || bytes.length > AVATAR_MAX_BYTES || !hasExpectedExperienceImageMagic(bytes, mime) || !avif) {
    throw new AvatarMediaError('avatar_invalid_image', 400);
  }
  return mime;
}
export function requireAvatarOwner(actorId: string | null, ownerId: string) {
  if (!actorId) throw new AvatarMediaError('avatar_auth_required', 401);
  if (actorId !== ownerId) throw new AvatarMediaError('avatar_owner_required', 403);
  try { avatarOwnerScope(ownerId); } catch { throw new AvatarMediaError('avatar_owner_required', 403); }
}
async function registryCall(registry: AvatarRegistry, name: string, args: Record<string, unknown>): Promise<AvatarAsset> {
  const { data, error } = await registry.rpc(name, args);
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row !== 'object' || !('id' in row)) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    throw new AvatarMediaError(['40001', '23505', '23514'].includes(code) ? 'avatar_cas_or_identity_conflict' : 'avatar_registry_unavailable', ['40001', '23505', '23514'].includes(code) ? 409 : 503);
  }
  return row as AvatarAsset;
}
function assertAsset(asset: AvatarAsset, ownerId: string, sha: string, size: number, mime: string) {
  if (asset.owner_id !== ownerId || asset.expected_sha256 !== sha || Number(asset.expected_size) !== size || asset.mime !== mime
    || asset.provider !== 'r2' || asset.bucket !== AVATAR_BUCKET || asset.business_scope !== 'avatar' || asset.parent_id !== ownerId
    || asset.state === 'tombstoned' || asset.object_key !== avatarKey(ownerId, asset.id, mime) || asset.public_url !== AVATAR_BASE_URL + '/' + asset.object_key) {
    throw new AvatarMediaError('avatar_identity_mismatch', 409);
  }
}
export async function verifyAvatarR2Bytes(binding: ExperienceMediaSourceR2, asset: AvatarAsset) {
  const metadata = { schema: 'avatar-source-v1', asset_id: asset.id, owner_scope_sha256: avatarOwnerScope(asset.owner_id), source_authority: 'r2', source_byte_sha256: asset.expected_sha256 };
  const exact = (object: Awaited<ReturnType<ExperienceMediaSourceR2['head']>>) => object && object.size === Number(asset.expected_size)
    && object.httpMetadata?.contentType === asset.mime && object.httpMetadata?.cacheControl === AVATAR_CACHE_CONTROL
    && Object.entries(metadata).every(([name, value]) => object.customMetadata?.[name] === value);
  if (!exact(await binding.head(asset.object_key)) || !binding.get) throw new AvatarMediaError('avatar_head_identity_mismatch');
  const object = await binding.get(asset.object_key);
  if (!exact(object) || !object) throw new AvatarMediaError('avatar_get_identity_mismatch');
  const actual = new Uint8Array(await object.arrayBuffer());
  if (actual.length !== Number(asset.expected_size) || await mediaByteSha(actual) !== asset.expected_sha256) throw new AvatarMediaError('avatar_byte_mismatch');
}
/** Pending before PUT. Verification remains state=pending + verified_at until CAS commits. */
export async function prepareManagedAvatar(input: {
  registry: AvatarRegistry; binding: ExperienceMediaSourceR2; actorId: string; ownerId: string;
  bytes: Uint8Array; contentType: string; assetId?: string; idempotencyKey?: string;
}) {
  requireAvatarOwner(input.actorId, input.ownerId);
  const mime = validateAvatarImage(input.bytes, input.contentType);
  const sha = await mediaByteSha(input.bytes);
  const assetId = input.assetId ?? crypto.randomUUID();
  const key = avatarKey(input.ownerId, assetId, mime);
  const token = input.idempotencyKey ?? await mediaByteSha(new TextEncoder().encode(`avatar-upload:${input.ownerId}:${assetId}`));
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AvatarMediaError('avatar_invalid_idempotency', 400);
  const asset = await registryCall(input.registry, 'begin_avatar_media_asset', {
    p_id: assetId, p_owner_id: input.ownerId, p_key: key, p_url: AVATAR_BASE_URL + '/' + key,
    p_sha256: sha, p_size: input.bytes.length, p_mime: mime, p_idempotency_key: token,
  });
  assertAsset(asset, input.ownerId, sha, input.bytes.length, mime);
  const metadata = { schema: 'avatar-source-v1', asset_id: asset.id, owner_scope_sha256: avatarOwnerScope(input.ownerId), source_authority: 'r2', source_byte_sha256: sha };
  try {
    const existing = await input.binding.head(asset.object_key);
    if (!existing) {
      // A conditional conflict (null) is accepted only after exact HEAD/GET.
      await input.binding.put(asset.object_key, input.bytes, { onlyIf: { etagDoesNotMatch: '*' }, sha256: sha,
        httpMetadata: { contentType: mime, cacheControl: AVATAR_CACHE_CONTROL }, customMetadata: metadata });
    }
    await verifyAvatarR2Bytes(input.binding, asset);
  } catch (error) {
    if (error instanceof AvatarMediaError) throw error;
    throw new AvatarMediaError('avatar_provider_unavailable');
  }
  const verified = await registryCall(input.registry, 'verify_avatar_media_asset', { p_id: asset.id, p_owner_id: input.ownerId, p_sha256: sha, p_size: input.bytes.length, p_mime: mime });
  assertAsset(verified, input.ownerId, sha, input.bytes.length, mime);
  if (!verified.verified_at) throw new AvatarMediaError('avatar_not_verified');
  return verified;
}
export async function commitManagedAvatar(registry: AvatarRegistry, asset: AvatarAsset, expectedUrl: string | null) {
  const committed = await registryCall(registry, 'commit_profile_avatar', {
    p_owner_id: asset.owner_id, p_asset_id: asset.id, p_expected_url: expectedUrl,
    p_sha256: asset.expected_sha256, p_size: Number(asset.expected_size),
  });
  assertAsset(committed, asset.owner_id, asset.expected_sha256, Number(asset.expected_size), asset.mime);
  if (committed.state !== 'committed') throw new AvatarMediaError('avatar_commit_unconfirmed');
  return { publicUrl: committed.public_url, assetId: committed.id, authority: 'r2' as const };
}
