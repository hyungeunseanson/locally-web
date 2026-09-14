import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildBoundedRecoveryPlan,
  buildRecoveryInventory,
  assertRecoverySnapshotStable,
  sanitizeRecoveryPlan,
  selectRotatingCandidates,
  validateRecoveryBudget,
} from './recover-public-experience-media.mjs';
import { buildSourceScopes, normalizeSupabaseExperienceObjectKey } from './audit-public-experience-media.mjs';
import { buildExpectedManifests, parseCardManifest } from './reconcile-public-experience-images.mjs';

const baseUrl = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const owner = '11111111-1111-4111-8111-111111111111';
const sourceUrl = `${baseUrl}/storage/v1/object/public/experiences/experience/${owner}/hero/current.jpg`;
const sourceKey = normalizeSupabaseExperienceObjectKey(sourceUrl);
const sourceKeySha = 'ced79a186b49620f85bceb6be18d7f6bf23a0c7e828162a0b77ec5665ddb2b76';
const cardIdentity = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12);

function fixture() {
  const rows = [{ id: 77, status: 'active', is_active: true, photos: [sourceUrl], itinerary: [], image_url: null }];
  const storage = [{ key: sourceKey, size: 12, contentType: 'image/jpeg', etag: 'source-etag', cacheControl: '3600' }];
  const source = buildSourceScopes(rows, storage, baseUrl);
  const currentCards = parseCardManifest(`export const PUBLIC_EXPERIENCE_CARD_IMAGES = {
  "77": {
    originUrl: "${sourceUrl}",
    smallKey: "cards/experience-77-primary-${cardIdentity}-w384-q65.webp",
    largeKey: "cards/experience-77-primary-${cardIdentity}-w640-q65.webp",
  },
} as const;`);
  const currentDetails = buildExpectedManifests(source.reconciliationInventory, currentCards).details;
  return buildRecoveryInventory(source, storage, currentCards, currentDetails);
}

function missingInspection(inventory) {
  return {
    r2StateDigest: 'a'.repeat(64),
    derivatives: inventory.sources.flatMap((source) => source.derivatives.map((item) => ({ key: item.key, classification: 'missing' }))),
    originalsBySourceKeySha256: {},
  };
}

async function planWith(inspection, options = {}) {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'media-recovery-'));
  const calls = { fetch: 0, transform: 0 };
  try {
    const inventory = fixture();
    const plan = await buildBoundedRecoveryPlan({
      inventory,
      r2Inspection: inspection || missingInspection(inventory),
      budget: options.budget,
      cursor: options.cursor || 0,
      outputDirectory,
      fetchSource: async () => {
        calls.fetch += 1;
        return { bytes: Buffer.from('source-bytes'), contentType: 'image/jpeg', etag: 'source-etag' };
      },
      transform: async ({ specification }) => {
        calls.transform += 1;
        return Buffer.from(`webp-${specification.width}`);
      },
    });
    return { inventory, plan, calls, files: await Promise.all([...plan.originals, ...plan.derivatives].map((item) => readFile(path.join(outputDirectory, item.path)))) };
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

test('finds derivative and original gaps even when static manifest drift is zero', async () => {
  const inventory = fixture();
  assert.equal(inventory.manifestDrift.missingManifestDerivativeKeyCount, 0);
  const result = await planWith(missingInspection(inventory));
  assert.equal(result.plan.originals.length, 1);
  assert.equal(result.plan.derivatives.length, 5);
  assert.equal(result.calls.fetch, 1);
  assert.equal(result.calls.transform, 5);
  assert.equal(result.plan.progress.conflictCount, 0);
  assert.equal(result.plan.progress.partial, false);
});

test('wrong same-origin static card keys cannot hide deterministic R2 gaps', () => {
  const rows = [{ id: 77, status: 'active', is_active: true, photos: [sourceUrl], itinerary: [], image_url: null }];
  const storage = [{ key: sourceKey, size: 12, contentType: 'image/jpeg', etag: 'source-etag', cacheControl: '3600' }];
  const source = buildSourceScopes(rows, storage, baseUrl);
  const wrongCards = { 77: { originUrl: sourceUrl, smallKey: 'cards/wrong-small.webp', largeKey: 'cards/wrong-large.webp' } };
  const inventory = buildRecoveryInventory(source, storage, wrongCards, {});
  const cardKeys = inventory.sources[0].derivatives.filter((item) => item.role === 'card').map((item) => item.key);
  assert.deepEqual(cardKeys, [
    `cards/experience-77-primary-${cardIdentity}-w384-q65.webp`,
    `cards/experience-77-primary-${cardIdentity}-w640-q65.webp`,
  ]);
  assert.equal(inventory.manifestDrift.missingManifestDerivativeKeyCount, 5);
});

test('a DB image with no Queue event is found from current public-active inventory', async () => {
  const result = await planWith();
  assert.equal(result.plan.progress.candidateSourceCount, 1);
  assert.equal(result.plan.progress.plannedOriginalCreates, 1);
  assert.equal(result.plan.progress.plannedDerivativeCreates, 5);
});

test('finds an original-only gap while exact derivatives remain untouched', async () => {
  const inventory = fixture();
  const sourceSha = '7f28ba79acf8e757e8245300024fe24ba8f5459bb096cfa7b4af6acb8ff43163';
  const inspection = {
    r2StateDigest: 'c'.repeat(64),
    derivatives: inventory.sources[0].derivatives.map((item) => ({ key: item.key, classification: 'existing_metadata_consistent', metadata: {
      source_key_sha256: sourceKeySha, source_byte_sha256: sourceSha, source_size: '12', transform_width: String(item.width), transform_quality: String(item.quality), transform_format: item.format, derivative_role: item.role,
    } })),
    originalsBySourceKeySha256: {},
  };
  const result = await planWith(inspection);
  assert.equal(result.plan.originals.length, 1);
  assert.equal(result.plan.derivatives.length, 0);
  assert.equal(result.calls.transform, 0);
});

test('existing current provenance becomes an exact skip without transform', async () => {
  const inventory = fixture();
  const sourceSha = '7f28ba79acf8e757e8245300024fe24ba8f5459bb096cfa7b4af6acb8ff43163';
  const originalKey = `originals/v1/${sourceKeySha.slice(0, 2)}/${sourceKeySha}/${sourceSha}.jpg`;
  const inspection = {
    r2StateDigest: 'b'.repeat(64),
    derivatives: inventory.sources[0].derivatives.map((item) => ({
      key: item.key,
      classification: 'existing_metadata_consistent',
      metadata: {
        source_key_sha256: sourceKeySha,
        source_byte_sha256: sourceSha,
        source_size: '12',
        transform_width: String(item.width),
        transform_quality: String(item.quality),
        transform_format: item.format,
        derivative_role: item.role,
      },
    })),
    originalsBySourceKeySha256: {
      [sourceKeySha]: [{ key: originalKey, size: 12, contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable', customMetadata: {
        sha256: sourceSha, source_key_sha256: sourceKeySha, source_byte_sha256: sourceSha,
        output_byte_sha256: sourceSha, source_size: '12', provenance_status: 'verified',
        transform_schema_version: '1', transform_engine: 'source-copy',
      } }],
    },
  };
  const result = await planWith(inspection);
  assert.equal(result.plan.originals.length, 0);
  assert.equal(result.plan.derivatives.length, 0);
  assert.equal(result.calls.transform, 0);
  assert.equal(result.plan.progress.conflictCount, 0);
});

test('legacy original and derivative proof remain exact after current source bytes are verified', async () => {
  const inventory = fixture();
  const sourceSha = '7f28ba79acf8e757e8245300024fe24ba8f5459bb096cfa7b4af6acb8ff43163';
  const originalKey = `originals/v1/${sourceKeySha.slice(0, 2)}/${sourceKeySha}/${sourceSha}.jpg`;
  const inspection = {
    r2StateDigest: 'e'.repeat(64),
    derivatives: inventory.sources[0].derivatives.map((item) => ({
      key: item.key,
      classification: 'existing_metadata_consistent',
      metadata: {
        sha256: '1'.repeat(64), output_byte_sha256: '1'.repeat(64),
        source_key_sha256: sourceKeySha, source_byte_sha256: sourceSha,
        transform_width: String(item.width), transform_quality: String(item.quality),
        transform_format: item.format, provenance_status: 'legacy-observed',
      },
    })),
    originalsBySourceKeySha256: {
      [sourceKeySha]: [{
        key: originalKey, size: 12, contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable',
        customMetadata: {
          source_key_sha256: sourceKeySha, source_byte_sha256: sourceSha,
          output_byte_sha256: sourceSha, source_size: '12',
        },
      }],
    },
  };
  const result = await planWith(inspection);
  assert.equal(result.plan.originals.length, 0);
  assert.equal(result.plan.derivatives.length, 0);
  assert.equal(result.calls.transform, 0);
  assert.equal(result.plan.progress.conflictCount, 0);
});

test('same URL with changed bytes and conflicting metadata is never treated as complete', async () => {
  const inventory = fixture();
  const inspection = missingInspection(inventory);
  inspection.derivatives = inventory.sources[0].derivatives.map((item) => ({
    key: item.key,
    classification: 'existing_metadata_consistent',
    metadata: {
      source_key_sha256: sourceKeySha,
      source_byte_sha256: '0'.repeat(64),
      source_size: '12',
      transform_width: String(item.width),
      transform_quality: String(item.quality),
      transform_format: item.format,
      derivative_role: item.role,
    },
  }));
  const result = await planWith(inspection);
  assert.equal(result.plan.derivatives.length, 0);
  assert.equal(result.plan.progress.conflictCount, 5);
});

test('wrong metadata is a conflict and does not trigger overwrite', async () => {
  const inventory = fixture();
  const inspection = missingInspection(inventory);
  inspection.derivatives[0] = { ...inspection.derivatives[0], classification: 'conflict', metadata: { source_key_sha256: '0'.repeat(64) } };
  const result = await planWith(inspection);
  assert.equal(result.plan.derivatives.length, 4);
  assert.equal(result.plan.progress.conflictCount, 1);
});

test('unverifiable derivative and original provenance block a complete plan', async () => {
  const inventory = fixture();
  const sourceSha = '7f28ba79acf8e757e8245300024fe24ba8f5459bb096cfa7b4af6acb8ff43163';
  const inspection = {
    r2StateDigest: 'd'.repeat(64),
    derivatives: inventory.sources[0].derivatives.map((item) => ({
      key: item.key,
      classification: 'unverifiable',
      metadata: {
        source_key_sha256: sourceKeySha, source_byte_sha256: sourceSha, source_size: '12',
        transform_width: String(item.width), transform_quality: String(item.quality),
        transform_format: item.format, derivative_role: item.role, provenance_status: 'unknown',
      },
    })),
    originalsBySourceKeySha256: {
      [sourceKeySha]: [{
        key: `originals/v1/${sourceKeySha.slice(0, 2)}/${sourceKeySha}/${sourceSha}.jpg`,
        size: 12, contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable',
        customMetadata: { source_key_sha256: sourceKeySha, source_byte_sha256: sourceSha, output_byte_sha256: sourceSha, source_size: '12', provenance_status: 'verified' },
      }],
    },
  };
  const result = await planWith(inspection);
  assert.equal(result.plan.originals.length, 0);
  assert.equal(result.plan.derivatives.length, 0);
  assert.equal(result.plan.progress.conflictCount, 6);
  assert.equal(result.plan.progress.partial, true);
});

test('both missing are created only within the explicitly approved object budgets', async () => {
  const result = await planWith(undefined, { budget: { maxSourceDownloads: 1, maxSourceBytes: 1024, maxOriginalCreates: 1, maxDerivativeCreates: 1, maxTransforms: 1 } });
  assert.equal(result.plan.originals.length, 1);
  assert.equal(result.plan.derivatives.length, 1);
  assert.equal(result.plan.progress.derivativeBudgetSkippedCount, 4);
  assert.equal(result.plan.progress.partial, true);
});

test('private transition is excluded from the canonical recovery inventory', () => {
  const rows = [{ id: 77, status: 'pending', is_active: true, photos: [sourceUrl], itinerary: [], image_url: null }];
  const source = buildSourceScopes(rows, [{ key: sourceKey, size: 12, contentType: 'image/jpeg', etag: 'e' }], baseUrl);
  const inventory = buildRecoveryInventory(source, [], {}, {});
  assert.equal(inventory.sources.length, 0);
  assert.equal(inventory.expectedDerivativeCount, 0);
});

test('public-active source drift invalidates a planned apply before any write', () => {
  const inventory = fixture();
  assert.doesNotThrow(() => assertRecoverySnapshotStable(inventory, { sourceSnapshotDigest: inventory.sourceSnapshotDigest }));
  assert.throws(
    () => assertRecoverySnapshotStable(inventory, { sourceSnapshotDigest: '0'.repeat(64) }),
    /source snapshot changed/,
  );
});

test('budgets and rotating cursor preserve partial progress instead of hiding gaps', () => {
  assert.deepEqual(selectRotatingCandidates(['c', 'a', 'b'], 1, 1), { selected: ['b'], nextCursor: 2, partial: true });
  assert.deepEqual(selectRotatingCandidates(['c', 'a', 'b'], 2, 2), { selected: ['c', 'a'], nextCursor: 1, partial: true });
  assert.throws(() => validateRecoveryBudget({ maxSourceDownloads: 51 }), /budget/);
});

test('zero budget is read-only and reports partial without source GET or transform', async () => {
  const result = await planWith(undefined, { budget: { maxSourceDownloads: 0, maxSourceBytes: 0, maxOriginalCreates: 0, maxDerivativeCreates: 0, maxTransforms: 0 } });
  assert.equal(result.calls.fetch, 0);
  assert.equal(result.calls.transform, 0);
  assert.equal(result.plan.progress.partial, true);
  assert.equal(result.plan.originals.length + result.plan.derivatives.length, 0);
});

test('bounded read and transform failures are visible partial results', async () => {
  const inventory = fixture();
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'media-recovery-failure-'));
  try {
    const readFailure = await buildBoundedRecoveryPlan({ inventory, r2Inspection: missingInspection(inventory), outputDirectory, fetchSource: async () => { throw new Error(`secret ${sourceUrl}`); }, transform: async () => Buffer.from('never') });
    assert.equal(readFailure.progress.partial, true);
    assert.deepEqual(readFailure.conflicts.map((item) => item.reason), ['source_read_failed']);
    assert.equal(readFailure.progress.sourceDownloadCount, 1);
    assert.equal(readFailure.progress.sourceByteVerifiedCount, 0);
    assert.doesNotMatch(JSON.stringify(sanitizeRecoveryPlan(readFailure, inventory)), /secret|supabase\.co|11111111-1111/i);

    const transformFailure = await buildBoundedRecoveryPlan({ inventory, r2Inspection: missingInspection(inventory), outputDirectory, fetchSource: async () => ({ bytes: Buffer.from('source-bytes'), contentType: 'image/jpeg', etag: 'e' }), transform: async () => { throw new Error('provider credential'); } });
    assert.equal(transformFailure.progress.partial, true);
    assert.equal(transformFailure.conflicts.filter((item) => item.reason === 'transform_failed').length, 5);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('source byte budget is enforced before a download using Storage metadata', async () => {
  const result = await planWith(undefined, { budget: { maxSourceDownloads: 1, maxSourceBytes: 11, maxOriginalCreates: 1, maxDerivativeCreates: 5, maxTransforms: 5 } });
  assert.equal(result.calls.fetch, 0);
  assert.equal(result.plan.progress.sourceDownloadCount, 0);
  assert.equal(result.plan.progress.stoppedByByteBudget, true);
  assert.equal(result.plan.progress.partial, true);
});

test('public summary exposes only bounded counts and digests', async () => {
  const result = await planWith();
  const serialized = JSON.stringify(sanitizeRecoveryPlan(result.plan, result.inventory));
  assert.doesNotMatch(serialized, /supabase\.co|11111111-1111|current\.jpg|credential|secret/i);
  assert.match(result.plan.planDigest, /^[0-9a-f]{64}$/);
});
