import { createHash } from 'node:crypto';
import { AVATAR_BASE_URL, AVATAR_BUCKET, AVATAR_MAX_BYTES, avatarKey, avatarContentType, legacyAvatarKey } from '../../app/utils/avatarMediaContract.mjs';

export const MAX_AVATAR_MIGRATION_OBJECTS = 100;
export const MAX_AVATAR_MIGRATION_BYTES = 128 * 1024 * 1024;
const sha = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const avatarPlanDigest = value => sha(canonical(value));
const fail = code => { throw new Error(code); };
function identity(owner, oldUrl, byteSha) {
  const h = sha(`avatar-legacy-migration-v1\0${owner}\0${oldUrl}\0${byteSha}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function selectLiveAvatars(inventory) {
  if (inventory.bucketPublic !== true || !Array.isArray(inventory.objects) || !Array.isArray(inventory.profiles)
    || inventory.objects.length > 1000 || inventory.profiles.length > 5000) fail('avatar_inventory_invalid');
  const objects = new Map(inventory.objects.map(object => [object.key, object]));
  if (objects.size !== inventory.objects.length || new Set(inventory.profiles.map(row => row.id)).size !== inventory.profiles.length) fail('avatar_inventory_collision');
  const selected = [], keys = new Set();
  for (const profile of [...inventory.profiles].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = legacyAvatarKey(profile.avatar_url);
    if (key === null) continue;
    const object = objects.get(key);
    // Legacy key prefix is deliberately irrelevant to this authority check.
    if (!object || object.ownerId !== profile.id) fail('avatar_source_owner_or_missing');
    if (keys.has(key)) fail('avatar_source_collision');
    keys.add(key); selected.push({ ownerId: profile.id, oldUrl: profile.avatar_url, source: object });
  }
  if (selected.length > MAX_AVATAR_MIGRATION_OBJECTS || selected.reduce((n, row) => n + row.source.size, 0) > MAX_AVATAR_MIGRATION_BYTES) fail('avatar_migration_budget_exceeded');
  for (const row of selected) {
    if (!Number.isSafeInteger(row.source.size) || row.source.size <= 0 || row.source.size > AVATAR_MAX_BYTES) fail('avatar_source_size_invalid');
    avatarContentType(row.source.mime);
  }
  return { selected, legacy_unreferenced_retained: inventory.objects.length - keys.size,
    unreferencedBytes: inventory.objects.filter(row => !keys.has(row.key)).reduce((n, row) => n + row.size, 0),
    externalLocatorDigest: avatarPlanDigest(inventory.profiles.filter(row => legacyAvatarKey(row.avatar_url) === null)) };
}
/** Payload-read-only plan: no registry registration, destination copy or locator write. */
export async function planAvatarMigration(inventory, readSource, validateImage) {
  const selection = selectLiveAvatars(inventory), entries = [];
  for (const item of selection.selected) {
    const bytes = await readSource(item);
    const mime = validateImage(bytes, item.source.mime);
    if (bytes.length !== item.source.size) fail('avatar_source_drift');
    const byteSha = sha(bytes), assetId = identity(item.ownerId, item.oldUrl, byteSha);
    const key = avatarKey(item.ownerId, assetId, mime);
    entries.push({ ...item, sha256: byteSha, mime, assetId, bucket: AVATAR_BUCKET, key, newUrl: AVATAR_BASE_URL + '/' + key,
      idempotencyKey: sha(`avatar-migration:${assetId}`) });
  }
  const payload = { schema: 'avatar-migration-v1', inventoryDigest: avatarPlanDigest(inventory), entries,
    legacy_unreferenced_retained: selection.legacy_unreferenced_retained, unreferencedBytes: selection.unreferencedBytes,
    externalLocatorDigest: selection.externalLocatorDigest, sourceWrites: 0, sourceDeletes: 0 };
  return { ...payload, planDigest: avatarPlanDigest(payload) };
}
export function validateAvatarPlan(plan, expectedDigest) {
  const { planDigest, ...payload } = plan;
  if (plan.schema !== 'avatar-migration-v1' || expectedDigest !== planDigest || avatarPlanDigest(payload) !== planDigest
    || plan.sourceWrites !== 0 || plan.sourceDeletes !== 0 || !Array.isArray(plan.entries)
    || plan.entries.length > MAX_AVATAR_MIGRATION_OBJECTS || plan.entries.reduce((n, item) => n + item.source.size, 0) > MAX_AVATAR_MIGRATION_BYTES) fail('avatar_plan_digest_mismatch');
  const seen = new Set();
  for (const item of plan.entries) {
    if (legacyAvatarKey(item.oldUrl) !== item.source.key || item.source.ownerId !== item.ownerId || item.mime !== avatarContentType(item.source.mime)
      || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.source.size) || item.source.size <= 0 || item.source.size > AVATAR_MAX_BYTES
      || item.assetId !== identity(item.ownerId, item.oldUrl, item.sha256) || item.bucket !== AVATAR_BUCKET
      || item.key !== avatarKey(item.ownerId, item.assetId, item.mime) || item.newUrl !== AVATAR_BASE_URL + '/' + item.key
      || item.idempotencyKey !== sha(`avatar-migration:${item.assetId}`) || seen.has(item.ownerId)) fail('avatar_plan_identity_mismatch');
    seen.add(item.ownerId);
  }
  return plan;
}
function sourceMatches(item, inventory) {
  const profile = inventory.profiles.find(row => row.id === item.ownerId);
  const object = inventory.objects.find(row => row.key === item.source.key);
  return profile?.avatar_url === item.oldUrl && object && avatarPlanDigest(object) === avatarPlanDigest(item.source);
}
/** prepare = pending/copy/verify only (G); apply adds profile CAS (I). */
export async function executeAvatarPlan(plan, expectedDigest, deps, mode = 'prepare') {
  validateAvatarPlan(plan, expectedDigest);
  if (!['prepare', 'apply'].includes(mode)) fail('avatar_mode_invalid');
  const summary = { mode, prepared: 0, committed: 0, drift: 0, verified: 0, sourceWrites: 0, sourceDeletes: 0, remoteDeletes: 0 };
  const initial = await deps.inventory();
  const normalized = structuredClone(initial);
  if (mode === 'apply') {
    for (const item of plan.entries) {
      const row = normalized.profiles.find(row => row.id === item.ownerId);
      if (row?.avatar_url === item.newUrl) row.avatar_url = item.oldUrl;
    }
  }
  if (avatarPlanDigest(normalized) !== plan.inventoryDigest) fail('avatar_inventory_drift');
  for (const item of plan.entries) {
    const current = await deps.inventory();
    // A successful prior CAS can be independently verified when resuming apply.
    if (mode === 'apply' && current.profiles.find(row => row.id === item.ownerId)?.avatar_url === item.newUrl) {
      await deps.verifyCommitted(item); summary.verified++; continue;
    }
    if (!sourceMatches(item, current)) { summary.drift++; await deps.record(summary); fail('avatar_source_or_locator_drift'); }
    const bytes = await deps.readSource(item);
    if (bytes.length !== item.source.size || sha(bytes) !== item.sha256 || deps.validateImage(bytes, item.mime) !== item.mime) fail('avatar_source_byte_drift');
    const asset = await deps.prepare(item, bytes);
    if (asset.id !== item.assetId || asset.public_url !== item.newUrl || asset.state !== 'pending' || !asset.verified_at) fail('avatar_preparation_unconfirmed');
    summary.prepared++;
    if (!sourceMatches(item, await deps.inventory())) { summary.drift++; await deps.record(summary); fail('avatar_source_or_locator_drift_pending_retained'); }
    if (mode === 'apply') {
      try { await deps.commit(asset, item.oldUrl); }
      catch { summary.drift++; await deps.record(summary); fail('avatar_commit_drift_pending_retained'); }
      await deps.verifyCommitted(item); summary.committed++; summary.verified++;
    }
    await deps.record(summary);
  }
  return summary;
}
export async function rollbackAvatarPlan(plan, expectedDigest, deps) {
  validateAvatarPlan(plan, expectedDigest);
  const summary = { rolledBack: 0, drift: 0, sourceWrites: 0, sourceDeletes: 0, remoteDeletes: 0 };
  for (const item of plan.entries) {
    const current = await deps.inventory();
    if (!sourceMatches({ ...item, oldUrl: item.newUrl }, current)) { summary.drift++; await deps.record(summary); fail('avatar_rollback_drift'); }
    try { await deps.rollback(item); } catch { summary.drift++; await deps.record(summary); fail('avatar_rollback_cas_conflict'); }
    const after = await deps.inventory();
    if (after.profiles.find(row => row.id === item.ownerId)?.avatar_url !== item.oldUrl) fail('avatar_rollback_unconfirmed');
    summary.rolledBack++; await deps.record(summary);
  }
  return summary;
}
