import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const EXPERIENCE_MEDIA_MIGRATION_SCHEMA = 'locally.experience-media-source-migration.v1';
export const EXPERIENCE_MEDIA_DELETE_SCHEMA = 'locally.experience-media-source-delete.v1';
export const EXPERIENCE_MEDIA_DELETE_MAX_OBJECTS = 700;
export const EXPERIENCE_MEDIA_DELETE_MAX_BYTES = 300 * 1024 * 1024;
const SUPABASE_PREFIX = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/';
const R2_BASE = 'https://media-canary.locally-travel.com';
const ORIGINAL_PATTERN = /^originals\/v1\/[0-9a-f]{2}\/([0-9a-f]{64})\/([0-9a-f]{64})\.(avif|gif|jpe?g|png|webp)$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestPayload(value) {
  return sha256(stableJson(value));
}

export function parseLegacyExperienceSourceUrl(sourceUrl) {
  const parsed = new URL(sourceUrl);
  assert.equal(`${parsed.origin}${parsed.pathname.slice(0, parsed.pathname.indexOf('/experience/'))}`, SUPABASE_PREFIX.slice(0, -1));
  assert(!parsed.search && !parsed.hash, 'Legacy source URL must not contain query or hash.');
  const key = decodeURIComponent(parsed.pathname.slice('/storage/v1/object/public/experiences/'.length));
  assert(/^experience\/[^/]+\/(hero|itinerary)\/[A-Za-z0-9._-]+$/.test(key), 'Legacy source key is outside the approved namespace.');
  return { key, sourceKeySha256: sha256(key), legacyIdentity: sha256(sourceUrl).slice(0, 12) };
}

export function buildMigratedR2Locator({ sourceUrl, r2Key, sourceByteSha256 }) {
  const legacy = parseLegacyExperienceSourceUrl(sourceUrl);
  const match = r2Key.match(ORIGINAL_PATTERN);
  assert(match, 'R2 proof must identify an immutable original key.');
  assert.equal(match[1], legacy.sourceKeySha256, 'R2 original source identity does not match the legacy locator.');
  assert.equal(match[2], sourceByteSha256, 'R2 original byte identity does not match the approved proof.');
  return `${R2_BASE}/${r2Key}?legacy=${legacy.legacyIdentity}`;
}

function rewriteValue(value, replacements, path = '$', replaceStrings = false) {
  if (typeof value === 'string') {
    const replacement = replaceStrings ? replacements.get(value) : null;
    return replacement ? { value: replacement, changedPaths: [path] } : { value, changedPaths: [] };
  }
  if (Array.isArray(value)) {
    const changedPaths = [];
    const next = value.map((item, index) => {
      const result = rewriteValue(item, replacements, `${path}[${index}]`, replaceStrings);
      changedPaths.push(...result.changedPaths);
      return result.value;
    });
    return { value: next, changedPaths };
  }
  if (value && typeof value === 'object') {
    const changedPaths = [];
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'image_url') {
        const result = rewriteValue(item, replacements, `${path}.${key}`, true);
        changedPaths.push(...result.changedPaths);
        next[key] = result.value;
      } else if (Array.isArray(item) || (item && typeof item === 'object')) {
        const result = rewriteValue(item, replacements, `${path}.${key}`, false);
        changedPaths.push(...result.changedPaths);
        next[key] = result.value;
      } else {
        next[key] = item;
      }
    }
    return { value: next, changedPaths };
  }
  return { value, changedPaths: [] };
}

export function buildExperienceLocatorMigrationPlan({ rows, proofs, createdAt }) {
  const replacements = new Map();
  for (const proof of proofs) {
    assert.equal(proof.sourceSize, proof.r2Size, 'Source/R2 size mismatch.');
    assert.equal(proof.sourceByteSha256, proof.r2ByteSha256, 'Source/R2 SHA mismatch.');
    replacements.set(proof.sourceUrl, buildMigratedR2Locator(proof));
  }
  const approvedProofs = proofs.map((proof) => ({
    sourceUrl: proof.sourceUrl,
    r2Key: proof.r2Key,
    sourceByteSha256: proof.sourceByteSha256,
    r2ByteSha256: proof.r2ByteSha256,
    sourceSize: proof.sourceSize,
    r2Size: proof.r2Size,
  })).sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));
  const changes = [];
  for (const row of rows) {
    const next = { photos: row.photos, image_url: row.image_url, itinerary: row.itinerary, itinerary_i18n: row.itinerary_i18n };
    const changedPaths = [];
    for (const field of Object.keys(next)) {
      const result = rewriteValue(next[field], replacements, field, field === 'photos' || field === 'image_url');
      next[field] = result.value;
      changedPaths.push(...result.changedPaths);
    }
    if (changedPaths.length > 0) {
      const before = { photos: row.photos, image_url: row.image_url, itinerary: row.itinerary, itinerary_i18n: row.itinerary_i18n };
      changes.push({
        experienceId: String(row.id),
        rowIdentitySha256: sha256(`experiences:${row.id}`),
        expectedDigest: digestPayload(before),
        nextDigest: digestPayload(next),
        changedPaths: changedPaths.sort(),
        before,
        after: next,
      });
    }
  }
  const payload = {
    schema: EXPERIENCE_MEDIA_MIGRATION_SCHEMA,
    sourceAuthority: 'supabase-storage-experiences',
    targetAuthority: 'cloudflare-r2-locally-public-experience-canary',
    proofs: approvedProofs,
    changes,
  };
  return { ...payload, createdAt, planDigest: digestPayload(payload) };
}

export function validateExperienceLocatorMigrationPlan(plan) {
  assert.equal(plan.schema, EXPERIENCE_MEDIA_MIGRATION_SCHEMA);
  assert(Array.isArray(plan.changes));
  assert.equal(new Set(plan.changes.map((item) => item.experienceId)).size, plan.changes.length);
  const payload = {
    schema: plan.schema,
    sourceAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    proofs: plan.proofs,
    changes: plan.changes,
  };
  assert.equal(digestPayload(payload), plan.planDigest, 'Experience locator plan digest mismatch.');
  for (const change of plan.changes) {
    assert.equal(digestPayload(change.before), change.expectedDigest);
    assert.equal(digestPayload(change.after), change.nextDigest);
    assert.deepEqual(change.before.photos?.map((value) => Boolean(value)), change.after.photos?.map((value) => Boolean(value)), 'Photo order/count changed.');
  }
  return plan;
}

export function buildExperienceDeletePlan({ objects, createdAt }) {
  const sorted = [...objects].sort((left, right) => left.name.localeCompare(right.name));
  const payload = { schema: EXPERIENCE_MEDIA_DELETE_SCHEMA, bucket: 'experiences', objects: sorted };
  validateDeleteObjects(sorted);
  return { ...payload, createdAt, planDigest: digestPayload(payload) };
}

function validateDeleteObjects(objects) {
  assert(objects.length <= EXPERIENCE_MEDIA_DELETE_MAX_OBJECTS, 'Delete object ceiling exceeded.');
  const totalBytes = objects.reduce((sum, object) => sum + object.size, 0);
  assert(totalBytes <= EXPERIENCE_MEDIA_DELETE_MAX_BYTES, 'Delete byte ceiling exceeded.');
  for (const object of objects) {
    assert(/^experience\/[^/]+\/(hero|itinerary)\/[A-Za-z0-9._-]+$/.test(object.name));
    assert(Number.isSafeInteger(object.size) && object.size >= 0);
    assert(/^[0-9a-f]{64}$/.test(object.sourceByteSha256));
    assert.equal(object.currentDbRefCount, 0);
    assert(['referenced-migrated', 'orphan-proven'].includes(object.classification));
    assert(object.r2Exact === true || object.backupExact === true);
  }
}

export function validateExperienceDeletePlan(plan, liveObjects) {
  assert.equal(plan.schema, EXPERIENCE_MEDIA_DELETE_SCHEMA);
  assert.equal(plan.bucket, 'experiences');
  const payload = { schema: plan.schema, bucket: plan.bucket, objects: plan.objects };
  assert.equal(digestPayload(payload), plan.planDigest, 'Delete plan digest mismatch.');
  validateDeleteObjects(plan.objects);
  const live = new Map(liveObjects.map((object) => [object.name, object]));
  for (const object of plan.objects) {
    const current = live.get(object.name);
    assert(current, `Planned object disappeared: ${object.name}`);
    assert.equal(current.size, object.size, `Planned object size drift: ${object.name}`);
    assert.equal(current.sourceByteSha256, object.sourceByteSha256, `Planned object SHA drift: ${object.name}`);
    assert.equal(current.currentDbRefCount, 0, `Planned object became referenced: ${object.name}`);
  }
  return plan;
}
