import {
  buildExperienceMediaSourceKey,
  createExperienceMediaR2Source,
  EXPERIENCE_MEDIA_SOURCE_BASE_URL,
  EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL,
  EXPERIENCE_MEDIA_SOURCE_MAX_BYTES,
  hasExpectedExperienceImageMagic,
  normalizeExperienceImageContentType,
  type ExperienceMediaSourceR2,
} from './experienceMediaSource';

export class MediaLifecycleError extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}
type Registry = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};
type Asset = {
  id: string; owner_id: string; object_key: string; public_url: string;
  expected_sha256: string; expected_size: number; mime: string;
  state: 'pending' | 'committed' | 'tombstoned';
};
export async function mediaByteSha(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function callRegistry(registry: Registry, name: string, args: Record<string, unknown>): Promise<Asset> {
  const { data, error } = await registry.rpc(name, args);
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row !== 'object' || !('id' in row)) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    throw new MediaLifecycleError(code === '23505' || code === '40001' ? 'media_asset_conflict' : 'media_registry_unavailable', code === '23505' || code === '40001' ? 409 : 503);
  }
  return row as Asset;
}

/** Register before PUT. Any failure leaves a traceable pending record, never a second writer. */
export async function uploadManagedExperienceMedia(input: {
  registry: Registry; binding: ExperienceMediaSourceR2; actorId: string; ownerId: string;
  folder: 'hero' | 'itinerary'; bytes: Uint8Array; contentType: string;
  parentId?: string | null; idempotencyKey?: string | null;
}) {
  const token = input.idempotencyKey ?? crypto.randomUUID();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token)) {
    throw new MediaLifecycleError('invalid_idempotency_key', 400);
  }
  const contentType = normalizeExperienceImageContentType(input.contentType);
  if (!input.bytes.byteLength || input.bytes.byteLength > EXPERIENCE_MEDIA_SOURCE_MAX_BYTES || !hasExpectedExperienceImageMagic(input.bytes, contentType)) {
    throw new MediaLifecycleError('invalid_image', 400);
  }
  const sha = await mediaByteSha(input.bytes);
  const idempotency = await mediaByteSha(new TextEncoder().encode([input.actorId, input.ownerId, input.folder, token].join('\0')));
  const proposedId = crypto.randomUUID();
  const proposedKey = buildExperienceMediaSourceKey({ ownerId: input.ownerId, assetId: proposedId, folder: input.folder, contentType });
  const asset = await callRegistry(input.registry, 'begin_experience_media_asset', {
    p_id: proposedId, p_owner_id: input.ownerId, p_key: proposedKey, p_url: EXPERIENCE_MEDIA_SOURCE_BASE_URL + '/' + proposedKey,
    p_sha256: sha, p_size: input.bytes.byteLength, p_mime: contentType, p_idempotency_key: idempotency, p_parent_id: input.parentId ?? null,
  });
  if (asset.owner_id !== input.ownerId || asset.expected_sha256 !== sha || Number(asset.expected_size) !== input.bytes.byteLength
    || asset.mime !== contentType || asset.state === 'tombstoned'
    || asset.object_key !== buildExperienceMediaSourceKey({ ownerId: input.ownerId, assetId: asset.id, folder: input.folder, contentType })
    || asset.public_url !== EXPERIENCE_MEDIA_SOURCE_BASE_URL + '/' + asset.object_key) {
    throw new MediaLifecycleError('media_asset_conflict', 409);
  }
  try {
    if (!(await input.binding.head(asset.object_key))) {
      try {
        await createExperienceMediaR2Source({ binding: input.binding, ownerId: input.ownerId, assetId: asset.id,
          folder: input.folder, bytes: input.bytes, contentType });
      } catch (error) {
        // A concurrent identical retry can win the conditional create. Verify its actual bytes below.
        if (!(error instanceof Error) || error.message !== 'experience_media_source_conflict') throw error;
      }
    }
    const head = await input.binding.head(asset.object_key);
    if (!head || head.size !== input.bytes.byteLength || head.httpMetadata?.contentType !== contentType
      || head.httpMetadata?.cacheControl !== EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL
      || head.customMetadata?.output_byte_sha256 !== sha || !input.binding.get) {
      throw new MediaLifecycleError('media_object_verification_failed');
    }
    const object = await input.binding.get(asset.object_key);
    if (!object || object.size !== input.bytes.byteLength || object.httpMetadata?.contentType !== contentType || await mediaByteSha(new Uint8Array(await object.arrayBuffer())) !== sha) {
      throw new MediaLifecycleError('media_object_byte_mismatch');
    }
  } catch (error) {
    if (error instanceof MediaLifecycleError) throw error;
    throw new MediaLifecycleError('media_provider_unavailable');
  }
  const verified = await callRegistry(input.registry, 'verify_experience_media_asset', {
    p_id: asset.id, p_owner_id: input.ownerId, p_sha256: sha, p_size: input.bytes.byteLength, p_mime: contentType,
  });
  return { assetId: asset.id, publicUrl: asset.public_url, state: verified.state, authority: 'r2' as const };
}

export type ManagedDeletion = {
  assetId: string; provider: 'supabase' | 'r2'; state: 'pending' | 'committed' | 'tombstoned';
  lifecycleManaged: boolean; createdAt: string; backupPinned: boolean; migrationPinned: boolean;
  expectedSha256: string; expectedSize: number;
};
export type DeletionDependencies = {
  journal(event: 'attempt' | 'tombstone' | 'object-deleted' | 'complete' | 'failed' | 'blocked', code?: string): Promise<void>;
  referenceCount(): Promise<number>;
  readBytes(): Promise<Uint8Array | null>;
  deleteObject(): Promise<void>;
  purgePublicCache(): Promise<void>;
};
/** An operator must supply explicit policy and a durable adapter. No production scheduler calls this. */
export async function executeManagedDeletion(asset: ManagedDeletion, deps: DeletionDependencies, policy: {
  enabled: boolean; minimumAgeMs?: number; now?: number;
}) {
  const block = async (code: string) => { await deps.journal('blocked', code); return { status: 'blocked', code }; };
  if (!policy.enabled || policy.minimumAgeMs === undefined || !Number.isFinite(policy.minimumAgeMs) || policy.minimumAgeMs <= 0) return block('delete_disabled');
  if (!asset.lifecycleManaged || !Number.isFinite(Date.parse(asset.createdAt))) return block('identity_mismatch');
  if ((policy.now ?? Date.now()) - Date.parse(asset.createdAt) < policy.minimumAgeMs) return block('delete_disabled');
  if (asset.backupPinned || asset.migrationPinned) return block('pinned');
  if (asset.state === 'committed' || await deps.referenceCount() !== 0) return block('reference_exists');
  await deps.journal('attempt');
  await deps.journal('tombstone');
  if (await deps.referenceCount() !== 0) return block('reference_exists');
  let objectDeleted = false;
  try {
    const bytes = await deps.readBytes();
    if (bytes && (bytes.byteLength !== asset.expectedSize || await mediaByteSha(bytes) !== asset.expectedSha256)) return block('identity_mismatch');
    if (bytes) await deps.deleteObject();
    objectDeleted = true;
    await deps.journal('object-deleted');
    await deps.purgePublicCache();
    await deps.journal('complete');
    return { status: 'complete' };
  } catch {
    const code = objectDeleted ? 'purge_failed' : 'provider_failed';
    await deps.journal('failed', code);
    return { status: 'failed', code };
  }
}


/** Read-only operator planning; no unregistered object can enter this input set. */
export async function planManagedPendingAssets(assets: ManagedDeletion[], referenceCount: (assetId: string) => Promise<number>, policy: {
  minimumAgeMs?: number; now?: number;
} = {}) {
  const summary = { managedPending: 0, pinned: 0, referenced: 0, ageEligible: 0, eligibleAssetIds: [] as string[], physicalDeletionEnabled: false };
  for (const asset of assets) {
    if (!asset.lifecycleManaged || asset.state !== 'pending') continue;
    summary.managedPending++;
    if (asset.backupPinned || asset.migrationPinned) { summary.pinned++; continue; }
    if (await referenceCount(asset.assetId) !== 0) { summary.referenced++; continue; }
    if (policy.minimumAgeMs === undefined || !Number.isFinite(policy.minimumAgeMs) || policy.minimumAgeMs <= 0) continue;
    const created = Date.parse(asset.createdAt);
    if (!Number.isFinite(created) || (policy.now ?? Date.now()) - created < policy.minimumAgeMs) continue;
    summary.ageEligible++;
    summary.eligibleAssetIds.push(asset.assetId);
  }
  return summary;
}

/** Connect the deletion executor to durable SQL. The provider adapter has one authority. */
export function durableMediaDeletionDependencies(registry: Registry, assetId: string, provider: Omit<DeletionDependencies, 'journal'>, policy: {
  enabled: boolean; minimumAgeMs?: number;
}): DeletionDependencies {
  return { ...provider, async journal(event, code) {
    if (event === 'tombstone') return; // Atomic with the claim, before any provider mutation.
    const result = event === 'attempt'
      ? await registry.rpc('claim_media_deletion', { p_asset_id: assetId, p_enabled: policy.enabled, p_minimum_age_ms: policy.minimumAgeMs ?? null })
      : await registry.rpc('record_media_deletion_step', { p_asset_id: assetId, p_event: event, p_code: code ?? null });
    if (result.error || (event === 'attempt' && result.data !== true)) throw new MediaLifecycleError('media_deletion_claim_denied');
  } };
}
