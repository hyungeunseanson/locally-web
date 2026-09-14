import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildManifestAudit,
  buildSourceScopes,
  fetchAllExperienceRows,
  hashIdentity,
  listAllStorageObjects,
  normalizeSupabaseExperienceObjectKey,
  sanitizeReport,
} from './audit-public-experience-media.mjs';
import {
  buildExpectedManifests,
  buildSharpObjectPlanItem,
  buildSourceProvenance,
  buildSpecifications,
  parseCardManifest,
} from './reconcile-public-experience-images.mjs';
import {
  buildOriginalKey,
  extensionForContentType,
  normalizeContentType,
  sha256,
  stableJson,
} from './plan-public-experience-media-repair.mjs';

const PRODUCTION_SUPABASE_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const EXPERIENCE_BUCKET = 'experiences';
const CARD_MANIFEST_PATH = path.resolve('app/data/publicExperienceCardImages.ts');
const DETAIL_MANIFEST_PATH = path.resolve('app/data/publicExperienceDetailImages.generated.json');
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const DEFAULT_BUDGET = Object.freeze({
  maxSourceDownloads: 12,
  maxSourceBytes: 64 * 1024 * 1024,
  maxOriginalCreates: 12,
  maxDerivativeCreates: 40,
  maxTransforms: 40,
});
const HARD_LIMITS = Object.freeze({
  maxSourceDownloads: 50,
  maxSourceBytes: 256 * 1024 * 1024,
  maxOriginalCreates: 50,
  maxDerivativeCreates: 200,
  maxTransforms: 200,
});

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function stableDigest(value) {
  return sha256(stableJson(value));
}

export function validateRecoveryBudget(input = {}) {
  const budget = {};
  for (const [name, fallback] of Object.entries(DEFAULT_BUDGET)) {
    const value = input[name] == null ? fallback : Number(input[name]);
    if (!Number.isSafeInteger(value) || value < 0 || value > HARD_LIMITS[name]) {
      throw new Error(`Invalid recovery budget: ${name}.`);
    }
    budget[name] = value;
  }
  return Object.freeze(budget);
}

export function selectRotatingCandidates(sourceHashes, cursor = 0, limit = DEFAULT_BUDGET.maxSourceDownloads) {
  const ordered = [...new Set(sourceHashes)].sort();
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Recovery cursor must be a non-negative integer.');
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Recovery candidate limit must be non-negative.');
  if (ordered.length === 0 || limit === 0) return { selected: [], nextCursor: 0, partial: ordered.length > 0 };
  const start = cursor % ordered.length;
  const count = Math.min(limit, ordered.length);
  const selected = Array.from({ length: count }, (_, index) => ordered[(start + index) % ordered.length]);
  return { selected, nextCursor: (start + count) % ordered.length, partial: count < ordered.length };
}

export function assertRecoverySnapshotStable(inventory, priorPlan) {
  if (inventory.sourceSnapshotDigest !== priorPlan.sourceSnapshotDigest) {
    throw new Error('Public-active source snapshot changed.');
  }
}

function sourceUrlForKey(baseUrl, sourceKey) {
  return `${baseUrl}/storage/v1/object/public/${EXPERIENCE_BUCKET}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
}

async function fetchBoundedSource(baseUrl, anonKey, sourceKey) {
  const response = await fetch(sourceUrlForKey(baseUrl, sourceKey), {
    method: 'GET',
    redirect: 'manual',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (response.status >= 300 && response.status < 400) throw new Error(`Source GET redirect rejected; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
  if (!response.ok) throw new Error(`Source GET failed: HTTP ${response.status}; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
  const contentType = normalizeContentType(response.headers.get('content-type'));
  extensionForContentType(contentType);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && (declared <= 0 || declared > MAX_SOURCE_BYTES)) {
    throw new Error(`Source size is outside the approved contract; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_SOURCE_BYTES) {
    throw new Error(`Source bytes are outside the approved contract; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
  }
  return { bytes, contentType, etag: String(response.headers.get('etag') || '').replace(/^"|"$/g, '') };
}

export function buildRecoveryInventory(source, storageObjects, currentCards, currentDetails) {
  const expected = buildExpectedManifests(source.reconciliationInventory, currentCards);
  const specifications = buildSpecifications(source.reconciliationInventory, expected);
  const manifest = buildManifestAudit(source.reconciliationInventory, currentCards, currentDetails, source.publicActiveKeys);
  const sourceByHash = new Map();
  for (const experience of source.reconciliationInventory) {
    for (const sourceUrl of experience.detailUrls) {
      const sourceKey = normalizeSupabaseExperienceObjectKey(sourceUrl, PRODUCTION_SUPABASE_URL);
      if (!sourceKey) throw new Error('Public-active source normalization failed.');
      const sourceKeySha256 = sha256(sourceKey);
      if (!sourceByHash.has(sourceKeySha256)) sourceByHash.set(sourceKeySha256, { sourceKey, sourceUrl, sourceKeySha256, derivatives: [] });
    }
  }
  for (const specification of specifications) {
    const sourceKey = normalizeSupabaseExperienceObjectKey(specification.originUrl, PRODUCTION_SUPABASE_URL);
    const sourceKeySha256 = sourceKey ? sha256(sourceKey) : null;
    const item = sourceByHash.get(sourceKeySha256);
    if (!item) throw new Error('Derivative has no canonical source mapping.');
    item.derivatives.push({ ...specification, sourceKeySha256 });
  }
  const storageByKey = new Map(storageObjects.map((item) => [item.key, item]));
  const sources = [...sourceByHash.values()].sort((a, b) => a.sourceKeySha256.localeCompare(b.sourceKeySha256)).map((item) => ({
    ...item,
    storage: storageByKey.get(item.sourceKey) || null,
    derivatives: item.derivatives.sort((a, b) => a.key.localeCompare(b.key)),
  }));
  const snapshotPayload = {
    publicActiveIdentitySetDigest: source.sourceScopes.publicActive.identitySetDigest,
    sources: sources.map((item) => ({
      sourceKeySha256: item.sourceKeySha256,
      size: item.storage?.size ?? null,
      etag: item.storage?.etag || null,
      contentType: normalizeContentType(item.storage?.contentType),
      derivativeKeys: item.derivatives.map((entry) => sha256(entry.key)),
    })),
  };
  return {
    sources,
    sourceSnapshotDigest: stableDigest(snapshotPayload),
    publicActiveExperienceCount: source.sourceScopes.publicActive.experienceCount,
    expectedDerivativeCount: specifications.length,
    manifestDrift: manifest.summary,
  };
}

function metadataMap(value) {
  return value && typeof value === 'object' ? value : {};
}

function derivativeStateFor(source, derivative, r2Inspection) {
  const actual = r2Inspection.derivatives.find((item) => item.key === derivative.key);
  if (!actual || actual.classification === 'missing') return { classification: 'missing', actual: null };
  const metadata = metadataMap(actual.metadata);
  const common =
    metadata.source_key_sha256 === source.sourceKeySha256 &&
    metadata.transform_width === String(derivative.width) &&
    metadata.transform_quality === String(derivative.quality) &&
    metadata.transform_format === derivative.format &&
    (metadata.provenance_status === 'legacy-observed' || metadata.derivative_role === derivative.role);
  if (!common || actual.classification === 'conflict') return { classification: 'conflict', actual };
  return { classification: actual.classification, actual };
}

function exactOriginalFor(source, material, r2Inspection) {
  const candidates = r2Inspection.originalsBySourceKeySha256[source.sourceKeySha256] || [];
  const expectedKey = buildOriginalKey(source.sourceKey, material.sha256, material.contentType);
  const exact = candidates.find((item) => {
    const metadata = metadataMap(item.customMetadata);
    return item.key === expectedKey && item.size === material.bytes.length &&
      normalizeContentType(item.contentType) === material.contentType &&
      item.cacheControl === 'public, max-age=31536000, immutable' &&
      metadata.source_key_sha256 === source.sourceKeySha256 &&
      metadata.source_byte_sha256 === material.sha256 &&
      metadata.output_byte_sha256 === material.sha256 &&
      metadata.source_size === String(material.bytes.length);
  });
  const sameKeyConflict = candidates.some((item) => item.key === expectedKey) && !exact;
  return { exact, sameKeyConflict, expectedKey };
}

export async function buildBoundedRecoveryPlan({ inventory, r2Inspection, budget: inputBudget, cursor = 0, fetchSource, transform, outputDirectory }) {
  const budget = validateRecoveryBudget(inputBudget);
  const candidateHashes = inventory.sources.map((item) => item.sourceKeySha256);
  const gapCandidateHashes = inventory.sources.filter((source) => {
    const originals = r2Inspection.originalsBySourceKeySha256[source.sourceKeySha256] || [];
    return originals.length === 0 || source.derivatives.some((item) => derivativeStateFor(source, item, r2Inspection).classification !== 'existing_metadata_consistent');
  }).map((item) => item.sourceKeySha256);
  const rotationPool = gapCandidateHashes.length > 0 ? gapCandidateHashes : candidateHashes;
  const rotation = selectRotatingCandidates(rotationPool, cursor, budget.maxSourceDownloads);
  const byHash = new Map(inventory.sources.map((item) => [item.sourceKeySha256, item]));
  const generatedAt = new Date().toISOString();
  const originals = [];
  const derivatives = [];
  const conflicts = [];
  const sourceProofs = [];
  let downloadedBytes = 0;
  let sourceDownloadAttemptCount = 0;
  let stoppedByByteBudget = false;
  let originalBudgetSkippedCount = 0;
  let derivativeBudgetSkippedCount = 0;
  await mkdir(path.join(outputDirectory, 'objects'), { recursive: true, mode: 0o700 });

  for (const sourceHash of rotation.selected) {
    const source = byHash.get(sourceHash);
    if (!Number.isSafeInteger(source.storage?.size) || source.storage.size <= 0) {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_metadata_unverifiable' });
      continue;
    }
    if (downloadedBytes + source.storage.size > budget.maxSourceBytes) {
      stoppedByByteBudget = true;
      break;
    }
    let downloaded;
    sourceDownloadAttemptCount += 1;
    try {
      downloaded = await fetchSource(source);
    } catch {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_read_failed' });
      continue;
    }
    if (downloadedBytes + downloaded.bytes.length > budget.maxSourceBytes) {
      stoppedByByteBudget = true;
      break;
    }
    downloadedBytes += downloaded.bytes.length;
    if (source.storage?.size != null && source.storage.size !== downloaded.bytes.length) {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_size_changed' });
      continue;
    }
    if (source.storage?.contentType && normalizeContentType(source.storage.contentType) !== downloaded.contentType) {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_content_type_changed' });
      continue;
    }
    const sourceByteSha256 = sha256(downloaded.bytes);
    const material = { ...downloaded, sha256: sourceByteSha256 };
    sourceProofs.push({ sourceKeySha256: source.sourceKeySha256, sourceByteSha256, sourceSize: downloaded.bytes.length, contentType: downloaded.contentType });
    const original = exactOriginalFor(source, material, r2Inspection);
    if (original.sameKeyConflict) {
      conflicts.push({ identity: hashIdentity(original.expectedKey), reason: 'original_conflict' });
    } else if (!original.exact && originals.length < budget.maxOriginalCreates) {
      const relativePath = `objects/original-${source.sourceKeySha256}-${sourceByteSha256}`;
      await writeFile(path.join(outputDirectory, relativePath), downloaded.bytes, { mode: 0o600 });
      originals.push({
        key: original.expectedKey,
        path: relativePath,
        bytes: downloaded.bytes.length,
        sha256: sourceByteSha256,
        contentType: downloaded.contentType,
        sourceKeySha256: source.sourceKeySha256,
        sourceByteSha256,
        sourceSize: downloaded.bytes.length,
        copiedAt: generatedAt,
      });
    } else if (!original.exact) {
      originalBudgetSkippedCount += 1;
    }

    for (const specification of source.derivatives) {
      const state = derivativeStateFor(source, specification, r2Inspection);
      if (state.classification === 'conflict') {
        conflicts.push({ identity: hashIdentity(specification.key), reason: 'derivative_metadata_conflict' });
        continue;
      }
      if (state.actual) {
        const metadata = metadataMap(state.actual.metadata);
        if (metadata.source_byte_sha256 !== sourceByteSha256 || (metadata.source_size && metadata.source_size !== String(downloaded.bytes.length))) {
          conflicts.push({ identity: hashIdentity(specification.key), reason: 'derivative_source_changed' });
        }
        continue;
      }
      if (derivatives.length >= budget.maxDerivativeCreates || derivatives.length >= budget.maxTransforms) {
        derivativeBudgetSkippedCount += 1;
        continue;
      }
      let output;
      try {
        output = await transform({ source: downloaded.bytes, specification });
      } catch {
        conflicts.push({ identity: hashIdentity(specification.key), reason: 'transform_failed' });
        continue;
      }
      const relativePath = `objects/derivative-${sha256(specification.key)}`;
      await writeFile(path.join(outputDirectory, relativePath), output, { mode: 0o600 });
      derivatives.push(buildSharpObjectPlanItem(specification, relativePath, output, buildSourceProvenance(source.sourceUrl, downloaded.bytes), generatedAt));
    }
  }

  const processedSourceCount = sourceProofs.length;
  const partial = rotation.partial || stoppedByByteBudget || processedSourceCount < candidateHashes.length || conflicts.length > 0 ||
    originalBudgetSkippedCount > 0 || derivativeBudgetSkippedCount > 0;
  const withoutLocalFields = (item, fields) => {
    const result = { ...item };
    for (const field of fields) delete result[field];
    return result;
  };
  const digestPayload = {
    version: 1,
    sourceSnapshotDigest: inventory.sourceSnapshotDigest,
    r2StateDigest: r2Inspection.r2StateDigest,
    cursor,
    nextCursor: rotation.nextCursor,
    budget,
    sourceProofs,
    originals: originals.map((item) => withoutLocalFields(item, ['path', 'copiedAt'])),
    derivatives: derivatives.map((item) => withoutLocalFields(item, ['path', 'generatedAt'])),
    conflicts,
  };
  return {
    ...digestPayload,
    digestPayload,
    generatedAt,
    planDigest: stableDigest(digestPayload),
    originals,
    derivatives,
    progress: {
      candidateSourceCount: candidateHashes.length,
      gapCandidateSourceCount: gapCandidateHashes.length,
      selectedSourceCount: rotation.selected.length,
      processedSourceCount,
      sourceDownloadCount: sourceDownloadAttemptCount,
      sourceByteVerifiedCount: processedSourceCount,
      sourceDownloadBytes: downloadedBytes,
      plannedOriginalCreates: originals.length,
      plannedDerivativeCreates: derivatives.length,
      transformCount: derivatives.length,
      conflictCount: conflicts.length,
      originalBudgetSkippedCount,
      derivativeBudgetSkippedCount,
      partial,
      stoppedByByteBudget,
    },
  };
}

export function sanitizeRecoveryPlan(plan, inventory) {
  const conflictsByReason = Object.fromEntries(
    [...new Set(plan.conflicts.map((item) => item.reason))].sort().map((reason) => [reason, plan.conflicts.filter((item) => item.reason === reason).length]),
  );
  return sanitizeReport({
    version: plan.version,
    generatedAt: plan.generatedAt,
    planDigest: plan.planDigest,
    sourceSnapshotDigest: plan.sourceSnapshotDigest,
    r2StateDigest: plan.r2StateDigest,
    publicActiveExperienceCount: inventory.publicActiveExperienceCount,
    expectedDerivativeCount: inventory.expectedDerivativeCount,
    manifest: inventory.manifestDrift,
    progress: plan.progress,
    cursor: plan.cursor,
    nextCursor: plan.nextCursor,
    budget: plan.budget,
    cost: {
      supabaseSourceGetCount: plan.progress.sourceDownloadCount,
      supabaseSourceBytes: plan.progress.sourceDownloadBytes,
      r2ConditionalPutCount: plan.originals.length + plan.derivatives.length,
      imageTransformCount: plan.derivatives.length,
      r2DeleteCount: 0,
      r2CopyCount: 0,
      queueSendCount: 0,
    },
    proof: {
      actualSourceBytesVerified: plan.progress.processedSourceCount,
      metadataOnlyRemaining: Math.max(0, plan.progress.candidateSourceCount - plan.progress.processedSourceCount),
      conflictCount: plan.progress.conflictCount,
      conflictsByReason,
      partial: plan.progress.partial,
    },
  });
}

async function loadLiveInventory() {
  const baseUrl = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = requireEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (baseUrl !== PRODUCTION_SUPABASE_URL) throw new Error('Refusing an unexpected Supabase project.');
  const [rows, storageObjects, cardSource, detailSource] = await Promise.all([
    fetchAllExperienceRows(baseUrl, anonKey),
    listAllStorageObjects(baseUrl, anonKey),
    readFile(CARD_MANIFEST_PATH, 'utf8'),
    readFile(DETAIL_MANIFEST_PATH, 'utf8'),
  ]);
  const source = buildSourceScopes(rows, storageObjects, baseUrl);
  if (source.sourceScopes.publicActive.missingObjectCount || source.sourceScopes.publicActive.invalidReferenceCount) {
    throw new Error('Public-active source inventory is incomplete.');
  }
  return {
    baseUrl,
    anonKey,
    inventory: buildRecoveryInventory(source, storageObjects, parseCardManifest(cardSource), JSON.parse(detailSource)),
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const [command = 'plan', ...rest] = argv;
  const values = Object.fromEntries(rest.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...parts] = value.slice(2).split('=');
    return [key, parts.join('=') || 'true'];
  }));
  const budget = Object.fromEntries(Object.keys(DEFAULT_BUDGET).map((name) => [name, values[name] == null ? undefined : Number(values[name])]));
  return {
    command,
    r2Inspection: values['r2-inspection'] ? path.resolve(values['r2-inspection']) : null,
    plan: values.plan ? path.resolve(values.plan) : null,
    output: path.resolve(values.output || '.tmp/public-experience-media-recovery'),
    cursor: Number(values.cursor || 0),
    budget,
  };
}

async function main() {
  const args = parseArgs();
  if (!['plan', 'verify-source'].includes(args.command)) throw new Error('Command must be plan or verify-source.');
  const live = await loadLiveInventory();
  if (args.command === 'verify-source') {
    if (!args.plan) throw new Error('--plan is required.');
    const prior = JSON.parse(await readFile(args.plan, 'utf8'));
    assertRecoverySnapshotStable(live.inventory, prior);
    for (const proof of prior.sourceProofs || []) {
      const source = live.inventory.sources.find((item) => item.sourceKeySha256 === proof.sourceKeySha256);
      if (!source) throw new Error('A planned source is no longer public-active.');
      const downloaded = await fetchBoundedSource(live.baseUrl, live.anonKey, source.sourceKey);
      if (downloaded.bytes.length !== proof.sourceSize || sha256(downloaded.bytes) !== proof.sourceByteSha256 || downloaded.contentType !== proof.contentType) {
        throw new Error(`Planned source bytes changed; identity=${hashIdentity(source.sourceKey).slice(0, 16)}`);
      }
    }
    console.log(stableJson(sanitizeReport({ sourceSnapshotStable: true, verifiedSourceCount: (prior.sourceProofs || []).length, mutationRequests: 0 })));
    return;
  }
  if (!args.r2Inspection) throw new Error('--r2-inspection is required.');
  await mkdir(args.output, { recursive: true, mode: 0o700 });
  const r2Inspection = JSON.parse(await readFile(args.r2Inspection, 'utf8'));
  const sharp = (await import('sharp')).default;
  const plan = await buildBoundedRecoveryPlan({
    inventory: live.inventory,
    r2Inspection,
    budget: args.budget,
    cursor: args.cursor,
    outputDirectory: args.output,
    fetchSource: (source) => fetchBoundedSource(live.baseUrl, live.anonKey, source.sourceKey),
    transform: async ({ source, specification }) => sharp(source).rotate().resize({ width: specification.width, withoutEnlargement: true }).webp({ quality: specification.quality, effort: 5 }).toBuffer(),
  });
  const privatePath = path.join(args.output, '.recovery-plan.json');
  await writeFile(privatePath, stableJson(plan), { mode: 0o600 });
  await chmod(privatePath, 0o600);
  const summary = sanitizeRecoveryPlan(plan, live.inventory);
  await writeFile(path.join(args.output, 'recovery-plan-summary.json'), stableJson(summary));
  console.log(stableJson(summary));
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `plan_digest=${plan.planDigest}\nplanned_writes=${plan.originals.length + plan.derivatives.length}\n`, { flag: 'a' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
