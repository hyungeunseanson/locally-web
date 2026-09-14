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
  validateRecoveryPlanDocument,
  createRecoveryBudgetState,
  fetchBoundedSource,
  verifyRecoverySources,
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
    return { inventory, plan, calls, files: await Promise.all([...plan.execution.originals, ...plan.execution.derivatives].map((item) => readFile(path.join(outputDirectory, item.path)))) };
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

test('finds derivative and original gaps even when static manifest drift is zero', async () => {
  const inventory = fixture();
  assert.equal(inventory.manifestDrift.missingManifestDerivativeKeyCount, 0);
  const result = await planWith(missingInspection(inventory));
  assert.equal(result.plan.execution.originals.length, 1);
  assert.equal(result.plan.execution.derivatives.length, 5);
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
  assert.equal(result.plan.execution.originals.length, 1);
  assert.equal(result.plan.execution.derivatives.length, 0);
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
  assert.equal(result.plan.execution.originals.length, 0);
  assert.equal(result.plan.execution.derivatives.length, 0);
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
  assert.equal(result.plan.execution.originals.length, 0);
  assert.equal(result.plan.execution.derivatives.length, 0);
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
  assert.equal(result.plan.execution.derivatives.length, 0);
  assert.equal(result.plan.progress.conflictCount, 5);
});

test('wrong metadata is a conflict and does not trigger overwrite', async () => {
  const inventory = fixture();
  const inspection = missingInspection(inventory);
  inspection.derivatives[0] = { ...inspection.derivatives[0], classification: 'conflict', metadata: { source_key_sha256: '0'.repeat(64) } };
  const result = await planWith(inspection);
  assert.equal(result.plan.execution.derivatives.length, 4);
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
  assert.equal(result.plan.execution.originals.length, 0);
  assert.equal(result.plan.execution.derivatives.length, 0);
  assert.equal(result.plan.progress.conflictCount, 6);
  assert.equal(result.plan.progress.partial, true);
});

test('both missing are created only within the explicitly approved object budgets', async () => {
  const result = await planWith(undefined, { budget: { maxSourceDownloads: 1, maxSourceBytes: 1024, maxOriginalCreates: 1, maxDerivativeCreates: 1, maxTransforms: 1 } });
  assert.equal(result.plan.execution.originals.length, 1);
  assert.equal(result.plan.execution.derivatives.length, 1);
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
  assert.equal(result.plan.execution.originals.length + result.plan.execution.derivatives.length, 0);
});

test('bounded read and transform failures are visible partial results', async () => {
  const inventory = fixture();
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'media-recovery-failure-'));
  try {
    const readFailure = await buildBoundedRecoveryPlan({ inventory, r2Inspection: missingInspection(inventory), outputDirectory, fetchSource: async () => { throw new Error(`secret ${sourceUrl}`); }, transform: async () => Buffer.from('never') });
    assert.equal(readFailure.progress.partial, true);
    assert.deepEqual(readFailure.execution.conflicts.map((item) => item.reason), ['source_read_failed']);
    assert.equal(readFailure.progress.sourceDownloadCount, 1);
    assert.equal(readFailure.progress.sourceByteVerifiedCount, 0);
    assert.doesNotMatch(JSON.stringify(sanitizeRecoveryPlan(readFailure, inventory)), /secret|supabase\.co|11111111-1111/i);

    const transformFailure = await buildBoundedRecoveryPlan({ inventory, r2Inspection: missingInspection(inventory), outputDirectory, fetchSource: async () => ({ bytes: Buffer.from('source-bytes'), contentType: 'image/jpeg', etag: 'e' }), transform: async () => { throw new Error('provider credential'); } });
    assert.equal(transformFailure.progress.partial, true);
    assert.equal(transformFailure.execution.conflicts.filter((item) => item.reason === 'transform_failed').length, 5);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('failed transform attempts consume the hard budget before provider invocation', async () => {
  const inventory = fixture();
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'media-recovery-transform-budget-'));
  let calls = 0;
  try {
    const plan = await buildBoundedRecoveryPlan({
      inventory,
      r2Inspection: missingInspection(inventory),
      budget: { maxSourceDownloads: 1, maxSourceBytes: 1024, maxOriginalCreates: 1, maxDerivativeCreates: 5, maxTransforms: 1 },
      outputDirectory,
      fetchSource: async () => ({ bytes: Buffer.from('source-bytes'), contentType: 'image/jpeg', etag: 'e' }),
      transform: async () => { calls += 1; throw new Error('always fails'); },
    });
    assert.equal(calls, 1);
    assert.equal(plan.progress.transformAttemptCount, 1);
    assert.equal(plan.progress.transformFailureCount, 1);
    assert.equal(plan.progress.derivativeBudgetSkippedCount, 4);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('failed source streams still consume received bytes', async () => {
  const inventory = fixture();
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'media-recovery-source-budget-'));
  try {
    const plan = await buildBoundedRecoveryPlan({
      inventory,
      r2Inspection: missingInspection(inventory),
      outputDirectory,
      fetchSource: async (_source, { onBytes }) => { onBytes(7); throw new Error('stream interrupted'); },
      transform: async () => Buffer.from('never'),
    });
    assert.equal(plan.progress.sourceDownloadBytes, 7);
    assert.equal(plan.progress.sourceDownloadFailureCount, 1);
    assert.equal(plan.progress.sourceDownloadSuccessCount, 0);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('single execution payload binds every approved field while timestamps remain non-semantic', async () => {
  const first = await planWith();
  const second = await planWith();
  assert.equal(first.plan.planDigest, second.plan.planDigest);
  assert.notEqual(first.plan.generatedAt, undefined);
  assert.equal('digestPayload' in first.plan, false);
  assert.doesNotThrow(() => validateRecoveryPlanDocument(first.plan, first.plan.planDigest));
  for (const mutate of [
    (plan) => { plan.execution.r2StateDigest = 'f'.repeat(64); },
    (plan) => { plan.execution.sourceSnapshotDigest = 'e'.repeat(64); },
    (plan) => { plan.execution.budget.maxOriginalCreates += 1; },
    (plan) => { plan.execution.originals.push(structuredClone(plan.execution.originals[0])); },
    (plan) => { plan.execution.originals[0].key = plan.execution.originals[0].key.replace('originals/v1/', 'originals/v1/ff/'); },
    (plan) => { plan.execution.derivatives[0].sourceByteSha256 = '0'.repeat(64); },
    (plan) => { plan.execution.lifecycleBudget.maxSourceBytes += 1; },
  ]) {
    const tampered = structuredClone(first.plan);
    mutate(tampered);
    assert.throws(() => validateRecoveryPlanDocument(tampered, first.plan.planDigest), /digest confirmation/);
  }
  const duplicateAuthority = structuredClone(first.plan);
  duplicateAuthority.originals = structuredClone(first.plan.execution.originals);
  assert.throws(() => validateRecoveryPlanDocument(duplicateAuthority, first.plan.planDigest), /document structure/);
});

test('plan, pre-apply, and post-apply source reads share one lifecycle ledger', async () => {
  const { inventory, plan } = await planWith();
  const budgetState = createRecoveryBudgetState(plan);
  const fetchSource = async (_source, { onBytes }) => {
    const bytes = Buffer.from('source-bytes');
    onBytes(bytes.length);
    return { bytes, contentType: 'image/jpeg', etag: 'e' };
  };
  await verifyRecoverySources({ inventory, plan, phase: 'preApply', fetchSource, budgetState });
  budgetState.usage.r2Creates = {
    attempts: plan.execution.originals.length + plan.execution.derivatives.length,
    successes: plan.execution.originals.length + plan.execution.derivatives.length,
    exactSkips: 0,
    failures: 0,
  };
  await verifyRecoverySources({ inventory, plan, phase: 'postApply', fetchSource, budgetState });
  assert.deepEqual(
    Object.fromEntries(Object.entries(budgetState.usage.sourceGets).map(([phase, value]) => [phase, value.attempts])),
    { plan: 1, preApply: 1, apply: 0, postApply: 1 },
  );
  await assert.rejects(
    verifyRecoverySources({ inventory, plan, phase: 'preApply', fetchSource, budgetState }),
    /pre-apply phase is not empty/,
  );
});

test('post-apply verification requires completed pre-apply and create phases', async () => {
  const { inventory, plan } = await planWith();
  const budgetState = createRecoveryBudgetState(plan);
  const fetchSource = async () => ({ bytes: Buffer.from('source-bytes'), contentType: 'image/jpeg', etag: 'e' });
  await assert.rejects(
    verifyRecoverySources({ inventory, plan, phase: 'postApply', fetchSource, budgetState }),
    /pre-apply source verification is incomplete/,
  );
  await verifyRecoverySources({ inventory, plan, phase: 'preApply', fetchSource, budgetState });
  await assert.rejects(
    verifyRecoverySources({ inventory, plan, phase: 'postApply', fetchSource, budgetState }),
    /create phase is incomplete/,
  );
});

test('bounded source streaming accepts missing Content-Length and accounts delivered bytes', async () => {
  const originalFetch = globalThis.fetch;
  const delivered = [];
  globalThis.fetch = async () => new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'image/jpeg' } },
  );
  try {
    const result = await fetchBoundedSource(baseUrl, 'not-a-real-secret', sourceKey, { onBytes: (count) => delivered.push(count) });
    assert.equal(result.bytes.length, 5);
    assert.deepEqual(delivered, [3, 2]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a failing over-budget stream records the bytes already delivered', async () => {
  const inventory = fixture();
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'media-recovery-source-overrun-'));
  try {
    const plan = await buildBoundedRecoveryPlan({
      inventory,
      r2Inspection: missingInspection(inventory),
      budget: { maxSourceDownloads: 1, maxSourceBytes: 20, maxOriginalCreates: 1, maxDerivativeCreates: 5, maxTransforms: 5 },
      outputDirectory,
      fetchSource: async (_source, { onBytes }) => { onBytes(21); throw new Error('budget stopped stream'); },
      transform: async () => Buffer.from('never'),
    });
    assert.equal(plan.progress.sourceDownloadBytes, 21);
    assert.equal(plan.progress.sourceDownloadFailureCount, 1);
    assert.equal(plan.progress.partial, true);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('pre-apply stream failure remains charged to the shared lifecycle ledger', async () => {
  const { inventory, plan } = await planWith();
  const budgetState = createRecoveryBudgetState(plan);
  await assert.rejects(
    verifyRecoverySources({
      inventory,
      plan,
      phase: 'preApply',
      budgetState,
      fetchSource: async (_source, { onBytes }) => { onBytes(6); throw new Error('bounded transport failure'); },
    }),
    /bounded transport failure/,
  );
  assert.deepEqual(budgetState.usage.sourceGets.preApply, { attempts: 1, successes: 0, failures: 1, bytes: 6 });
});

test('source proof mismatch is a failed verification and cannot authorize apply', async () => {
  const { inventory, plan } = await planWith();
  const budgetState = createRecoveryBudgetState(plan);
  await assert.rejects(
    verifyRecoverySources({
      inventory,
      plan,
      phase: 'preApply',
      budgetState,
      fetchSource: async () => ({ bytes: Buffer.from('changed-byte'), contentType: 'image/jpeg', etag: 'changed' }),
    }),
    /Planned source bytes changed/,
  );
  assert.deepEqual(budgetState.usage.sourceGets.preApply, { attempts: 1, successes: 0, failures: 1, bytes: 12 });
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
