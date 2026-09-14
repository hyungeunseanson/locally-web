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
  TRANSFORM_SCHEMA_VERSION,
  VERIFIED_PROVENANCE_STATUS,
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
const SOURCE_FETCH_TIMEOUT_MS = 30_000;
const RECOVERY_PLAN_VERSION = 2;
const RECOVERY_SCOPE = Object.freeze({
  source: 'supabase-public-active-experiences',
  supabaseProjectRef: 'uhinvcydgzqlpnvieyal',
  bucket: 'locally-public-experience-canary',
  writeMode: 'conditional-create-only',
});
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
  const sourceSnapshotDigest = priorPlan.execution?.sourceSnapshotDigest ?? priorPlan.sourceSnapshotDigest;
  if (inventory.sourceSnapshotDigest !== sourceSnapshotDigest) {
    throw new Error('Public-active source snapshot changed.');
  }
}

function sourceUrlForKey(baseUrl, sourceKey) {
  return `${baseUrl}/storage/v1/object/public/${EXPERIENCE_BUCKET}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
}

export async function fetchBoundedSource(baseUrl, anonKey, sourceKey, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrlForKey(baseUrl, sourceKey), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`Source GET redirect rejected; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
    if (!response.ok) throw new Error(`Source GET failed: HTTP ${response.status}; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
    const contentType = normalizeContentType(response.headers.get('content-type'));
    extensionForContentType(contentType);
    const declaredHeader = response.headers.get('content-length');
    if (declaredHeader != null) {
      const declared = Number(declaredHeader);
      if (!Number.isSafeInteger(declared) || declared <= 0 || declared > MAX_SOURCE_BYTES) {
        throw new Error(`Source size is outside the approved contract; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
      }
    }
    if (!response.body) throw new Error(`Source response body is missing; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
    const chunks = [];
    let received = 0;
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      received += bytes.length;
      options.onBytes?.(bytes.length);
      if (received > MAX_SOURCE_BYTES) {
        controller.abort();
        throw new Error(`Source bytes are outside the approved contract; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
      }
      chunks.push(bytes);
    }
    if (received === 0) throw new Error(`Source bytes are outside the approved contract; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
    return { bytes: Buffer.concat(chunks, received), contentType, etag: String(response.headers.get('etag') || '').replace(/^"|"$/g, '') };
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function emptySourcePhase() {
  return { attempts: 0, successes: 0, failures: 0, bytes: 0 };
}

function emptyUsage() {
  return {
    sourceGets: { plan: emptySourcePhase(), preApply: emptySourcePhase(), apply: emptySourcePhase(), postApply: emptySourcePhase() },
    transforms: { attempts: 0, successes: 0, failures: 0 },
    r2Creates: { attempts: 0, successes: 0, exactSkips: 0, failures: 0 },
  };
}

function sourceTotals(usage) {
  return Object.values(usage.sourceGets).reduce((result, phase) => ({
    attempts: result.attempts + phase.attempts,
    bytes: result.bytes + phase.bytes,
  }), { attempts: 0, bytes: 0 });
}

function consumeSourceAttempt(usage, phase, limits) {
  const totals = sourceTotals(usage);
  if (totals.attempts >= limits.maxSourceGetAttempts) throw new Error('Recovery lifecycle source GET attempt budget exhausted.');
  usage.sourceGets[phase].attempts += 1;
}

function consumeSourceBytes(usage, phase, limits, count) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid source byte accounting.');
  const totals = sourceTotals(usage);
  usage.sourceGets[phase].bytes += count;
  if (totals.bytes + count > limits.maxSourceBytes) throw new Error('Recovery lifecycle source byte budget exhausted.');
}

function lifecycleBudgetFor(budget, usage, sourceProofs, plannedCreateCount) {
  const verificationBytes = sourceProofs.reduce((total, proof) => total + proof.sourceSize, 0);
  const requiredSourceGetAttempts = usage.sourceGets.plan.attempts + (sourceProofs.length * 2);
  const requiredSourceBytes = usage.sourceGets.plan.bytes + (verificationBytes * 2);
  if (requiredSourceGetAttempts > HARD_LIMITS.maxSourceDownloads || requiredSourceBytes > HARD_LIMITS.maxSourceBytes) {
    throw new Error('Recovery plan cannot reserve its full source verification lifecycle within the hard ceiling.');
  }
  return Object.freeze({
    maxSourceGetAttempts: HARD_LIMITS.maxSourceDownloads,
    maxSourceBytes: HARD_LIMITS.maxSourceBytes,
    maxTransformAttempts: budget.maxTransforms,
    maxR2CreateAttempts: plannedCreateCount,
  });
}

export function validateRecoveryPlanDocument(plan, confirmation = plan?.planDigest) {
  if (!plan || stableJson(Object.keys(plan).sort()) !== stableJson(['execution', 'generatedAt', 'planDigest', 'progress', 'version'])) {
    throw new Error('Invalid recovery plan document structure.');
  }
  if (plan?.version !== RECOVERY_PLAN_VERSION || plan?.execution?.version !== RECOVERY_PLAN_VERSION) {
    throw new Error('Unsupported recovery plan schema.');
  }
  const calculated = stableDigest(plan.execution);
  if (!confirmation || confirmation !== plan.planDigest || confirmation !== calculated) {
    throw new Error('Exact fresh recovery plan digest confirmation is required.');
  }
  if (stableJson(plan.execution.scope) !== stableJson(RECOVERY_SCOPE)) throw new Error('Unexpected recovery scope.');
  return plan.execution;
}

export function createRecoveryBudgetState(plan) {
  const execution = validateRecoveryPlanDocument(plan);
  const usage = emptyUsage();
  usage.sourceGets.plan = structuredClone(execution.planUsage.sourceGets);
  usage.transforms = structuredClone(execution.planUsage.transforms);
  return {
    version: 1,
    planDigest: plan.planDigest,
    limits: execution.lifecycleBudget,
    usage,
  };
}

function expectedVerificationUsage(execution) {
  return {
    attempts: execution.sourceProofs.length,
    successes: execution.sourceProofs.length,
    failures: 0,
    bytes: execution.sourceProofs.reduce((total, proof) => total + proof.sourceSize, 0),
  };
}

function assertEmptyUsage(value, label) {
  if (stableJson(value) !== stableJson(emptySourcePhase())) throw new Error(`Recovery ${label} phase is not empty.`);
}

function validateBudgetState(plan, state, nextPhase) {
  const execution = validateRecoveryPlanDocument(plan);
  if (state?.version !== 1 || state.planDigest !== plan.planDigest || stableJson(state.limits) !== stableJson(execution.lifecycleBudget)) {
    throw new Error('Recovery lifecycle budget state does not match the approved plan.');
  }
  const phases = state.usage?.sourceGets;
  if (!phases || stableJson(phases.plan) !== stableJson(execution.planUsage.sourceGets) || stableJson(state.usage.transforms) !== stableJson(execution.planUsage.transforms)) {
    throw new Error('Recovery lifecycle usage is not bound to the approved plan.');
  }
  for (const phase of ['plan', 'preApply', 'apply', 'postApply']) {
    for (const name of ['attempts', 'successes', 'failures', 'bytes']) {
      if (!Number.isSafeInteger(phases[phase]?.[name]) || phases[phase][name] < 0) throw new Error('Invalid recovery lifecycle usage counter.');
    }
    if (phases[phase].successes + phases[phase].failures > phases[phase].attempts) throw new Error('Inconsistent recovery lifecycle usage counter.');
  }
  const totals = sourceTotals(state.usage);
  if (totals.attempts > state.limits.maxSourceGetAttempts || totals.bytes > state.limits.maxSourceBytes) {
    throw new Error('Recovery lifecycle source budget is already exceeded.');
  }
  assertEmptyUsage(phases.apply, 'apply source-read');
  if (nextPhase === 'preApply') {
    assertEmptyUsage(phases.preApply, 'pre-apply');
    assertEmptyUsage(phases.postApply, 'post-apply');
    if (stableJson(state.usage.r2Creates) !== stableJson(emptyUsage().r2Creates)) {
      throw new Error('Recovery create attempts started before pre-apply verification.');
    }
  } else if (nextPhase === 'postApply') {
    if (stableJson(phases.preApply) !== stableJson(expectedVerificationUsage(execution))) {
      throw new Error('Recovery pre-apply source verification is incomplete.');
    }
    assertEmptyUsage(phases.postApply, 'post-apply');
    const expectedCreates = execution.originals.length + execution.derivatives.length;
    const creates = state.usage.r2Creates;
    if (creates.attempts !== expectedCreates || creates.successes + creates.exactSkips !== expectedCreates || creates.failures !== 0) {
      throw new Error('Recovery create phase is incomplete.');
    }
  }
  return execution;
}

export async function verifyRecoverySources({ inventory, plan, phase, fetchSource, budgetState }) {
  if (!['preApply', 'postApply'].includes(phase)) throw new Error('Invalid recovery source verification phase.');
  const execution = validateBudgetState(plan, budgetState, phase);
  assertRecoverySnapshotStable(inventory, plan);
  for (const proof of execution.sourceProofs) {
    const source = inventory.sources.find((item) => item.sourceKeySha256 === proof.sourceKeySha256);
    if (!source) throw new Error('A planned source is no longer public-active.');
    consumeSourceAttempt(budgetState.usage, phase, budgetState.limits);
    let downloaded;
    let accounted = 0;
    try {
      downloaded = await fetchSource(source, { onBytes: (count) => {
        consumeSourceBytes(budgetState.usage, phase, budgetState.limits, count);
        accounted += count;
      } });
      if (accounted < downloaded.bytes.length) consumeSourceBytes(budgetState.usage, phase, budgetState.limits, downloaded.bytes.length - accounted);
      if (downloaded.bytes.length !== proof.sourceSize || sha256(downloaded.bytes) !== proof.sourceByteSha256 || downloaded.contentType !== proof.contentType) {
        throw new Error(`Planned source bytes changed; identity=${hashIdentity(source.sourceKey).slice(0, 16)}`);
      }
      budgetState.usage.sourceGets[phase].successes += 1;
    } catch (error) {
      budgetState.usage.sourceGets[phase].failures += 1;
      throw error;
    }
  }
  return { sourceSnapshotStable: true, verifiedSourceCount: execution.sourceProofs.length, mutationRequests: 0 };
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

function originalMetadataConsistentFor(source, r2Inspection) {
  return (r2Inspection.originalsBySourceKeySha256[source.sourceKeySha256] || []).some((item) => {
    const metadata = metadataMap(item.customMetadata);
    const provenance = [metadata.provenance_status, metadata.transform_schema_version, metadata.transform_engine];
    const legacy = provenance.every((value) => value == null || value === '');
    const verified = metadata.provenance_status === VERIFIED_PROVENANCE_STATUS &&
      metadata.transform_schema_version === TRANSFORM_SCHEMA_VERSION &&
      metadata.transform_engine === 'source-copy';
    return Number.isSafeInteger(source.storage?.size) && source.storage.size > 0 &&
      item.size === source.storage.size &&
      metadata.source_key_sha256 === source.sourceKeySha256 &&
      /^[0-9a-f]{64}$/.test(metadata.source_byte_sha256 || '') &&
      metadata.source_byte_sha256 === metadata.output_byte_sha256 &&
      (!metadata.sha256 || metadata.source_byte_sha256 === metadata.sha256) &&
      metadata.source_size === String(source.storage.size) &&
      (legacy || verified);
  });
}

function exactOriginalFor(source, material, r2Inspection) {
  const candidates = r2Inspection.originalsBySourceKeySha256[source.sourceKeySha256] || [];
  const expectedKey = buildOriginalKey(source.sourceKey, material.sha256, material.contentType);
  const exact = candidates.find((item) => {
    const metadata = metadataMap(item.customMetadata);
    const provenance = [metadata.provenance_status, metadata.transform_schema_version, metadata.transform_engine];
    const legacy = provenance.every((value) => value == null || value === '');
    const verified = metadata.provenance_status === VERIFIED_PROVENANCE_STATUS &&
      metadata.transform_schema_version === TRANSFORM_SCHEMA_VERSION &&
      metadata.transform_engine === 'source-copy';
    return item.key === expectedKey && item.size === material.bytes.length &&
      normalizeContentType(item.contentType) === material.contentType &&
      item.cacheControl === 'public, max-age=31536000, immutable' &&
      metadata.source_key_sha256 === source.sourceKeySha256 &&
      metadata.source_byte_sha256 === material.sha256 &&
      metadata.output_byte_sha256 === material.sha256 &&
      (!metadata.sha256 || metadata.sha256 === material.sha256) &&
      metadata.source_size === String(material.bytes.length) &&
      (legacy || verified);
  });
  const sameKeyConflict = candidates.some((item) => item.key === expectedKey) && !exact;
  return { exact, sameKeyConflict, expectedKey };
}

export async function buildBoundedRecoveryPlan({ inventory, r2Inspection, budget: inputBudget, cursor = 0, fetchSource, transform, outputDirectory }) {
  const budget = validateRecoveryBudget(inputBudget);
  const usage = emptyUsage();
  const planningLimits = { maxSourceGetAttempts: budget.maxSourceDownloads, maxSourceBytes: budget.maxSourceBytes };
  const candidateHashes = inventory.sources.map((item) => item.sourceKeySha256);
  const gapCandidateHashes = inventory.sources.filter((source) => {
    return !originalMetadataConsistentFor(source, r2Inspection) ||
      source.derivatives.some((item) => derivativeStateFor(source, item, r2Inspection).classification !== 'existing_metadata_consistent');
  }).map((item) => item.sourceKeySha256);
  const rotationPool = gapCandidateHashes.length > 0 ? gapCandidateHashes : candidateHashes;
  const rotation = selectRotatingCandidates(rotationPool, cursor, budget.maxSourceDownloads);
  const byHash = new Map(inventory.sources.map((item) => [item.sourceKeySha256, item]));
  const generatedAt = new Date().toISOString();
  const originals = [];
  const derivatives = [];
  const conflicts = [];
  const sourceProofs = [];
  let stoppedByByteBudget = false;
  let stoppedByLifecycleBudget = false;
  let originalBudgetSkippedCount = 0;
  let derivativeBudgetSkippedCount = 0;
  await mkdir(path.join(outputDirectory, 'objects'), { recursive: true, mode: 0o700 });

  for (const sourceHash of rotation.selected) {
    const source = byHash.get(sourceHash);
    if (!Number.isSafeInteger(source.storage?.size) || source.storage.size <= 0) {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_metadata_unverifiable' });
      continue;
    }
    const verifiedBytesSoFar = sourceProofs.reduce((total, proof) => total + proof.sourceSize, 0);
    const projectedAttempts = usage.sourceGets.plan.attempts + 1 + ((sourceProofs.length + 1) * 2);
    const projectedBytes = usage.sourceGets.plan.bytes + source.storage.size + ((verifiedBytesSoFar + source.storage.size) * 2);
    if (usage.sourceGets.plan.bytes + source.storage.size > budget.maxSourceBytes) {
      stoppedByByteBudget = true;
      break;
    }
    if (projectedAttempts > HARD_LIMITS.maxSourceDownloads || projectedBytes > HARD_LIMITS.maxSourceBytes) {
      stoppedByLifecycleBudget = true;
      break;
    }
    let downloaded;
    consumeSourceAttempt(usage, 'plan', planningLimits);
    let accountedBytes = 0;
    try {
      downloaded = await fetchSource(source, { onBytes: (count) => {
        consumeSourceBytes(usage, 'plan', planningLimits, count);
        accountedBytes += count;
      } });
      if (accountedBytes < downloaded.bytes.length) {
        const remaining = downloaded.bytes.length - accountedBytes;
        consumeSourceBytes(usage, 'plan', planningLimits, remaining);
      }
      usage.sourceGets.plan.successes += 1;
    } catch {
      usage.sourceGets.plan.failures += 1;
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_read_failed' });
      continue;
    }
    if (source.storage?.size != null && source.storage.size !== downloaded.bytes.length) {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_size_changed' });
      continue;
    }
    if (source.storage?.contentType && normalizeContentType(source.storage.contentType) !== downloaded.contentType) {
      conflicts.push({ identity: hashIdentity(source.sourceKey), reason: 'source_content_type_changed' });
      continue;
    }
    const actualRequiredAttempts = usage.sourceGets.plan.attempts + ((sourceProofs.length + 1) * 2);
    const actualRequiredBytes = usage.sourceGets.plan.bytes + ((verifiedBytesSoFar + downloaded.bytes.length) * 2);
    if (actualRequiredAttempts > HARD_LIMITS.maxSourceDownloads || actualRequiredBytes > HARD_LIMITS.maxSourceBytes) {
      stoppedByLifecycleBudget = true;
      break;
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
      if (state.classification === 'unverifiable') {
        conflicts.push({ identity: hashIdentity(specification.key), reason: 'derivative_metadata_unverifiable' });
        continue;
      }
      if (state.actual) {
        const metadata = metadataMap(state.actual.metadata);
        if (metadata.source_byte_sha256 !== sourceByteSha256 || (metadata.source_size && metadata.source_size !== String(downloaded.bytes.length))) {
          conflicts.push({ identity: hashIdentity(specification.key), reason: 'derivative_source_changed' });
        }
        continue;
      }
      if (derivatives.length >= budget.maxDerivativeCreates || usage.transforms.attempts >= budget.maxTransforms) {
        derivativeBudgetSkippedCount += 1;
        continue;
      }
      let output;
      usage.transforms.attempts += 1;
      try {
        output = await transform({ source: downloaded.bytes, specification });
        usage.transforms.successes += 1;
      } catch {
        usage.transforms.failures += 1;
        conflicts.push({ identity: hashIdentity(specification.key), reason: 'transform_failed' });
        continue;
      }
      const relativePath = `objects/derivative-${sha256(specification.key)}`;
      await writeFile(path.join(outputDirectory, relativePath), output, { mode: 0o600 });
      derivatives.push(buildSharpObjectPlanItem(specification, relativePath, output, buildSourceProvenance(source.sourceUrl, downloaded.bytes), generatedAt));
    }
  }

  const processedSourceCount = sourceProofs.length;
  const partial = rotation.partial || stoppedByByteBudget || stoppedByLifecycleBudget || processedSourceCount < candidateHashes.length || conflicts.length > 0 ||
    originalBudgetSkippedCount > 0 || derivativeBudgetSkippedCount > 0;
  const withoutGeneratedTime = (item) => {
    const result = { ...item };
    delete result.copiedAt;
    delete result.generatedAt;
    return result;
  };
  const lifecycleBudget = lifecycleBudgetFor(budget, usage, sourceProofs, originals.length + derivatives.length);
  const execution = {
    version: RECOVERY_PLAN_VERSION,
    scope: RECOVERY_SCOPE,
    sourceSnapshotDigest: inventory.sourceSnapshotDigest,
    r2StateDigest: r2Inspection.r2StateDigest,
    cursor,
    nextCursor: rotation.nextCursor,
    budget,
    lifecycleBudget,
    planUsage: {
      sourceGets: structuredClone(usage.sourceGets.plan),
      transforms: structuredClone(usage.transforms),
    },
    sourceProofs,
    originals: originals.map(withoutGeneratedTime),
    derivatives: derivatives.map(withoutGeneratedTime),
    conflicts,
  };
  return {
    version: RECOVERY_PLAN_VERSION,
    execution,
    generatedAt,
    planDigest: stableDigest(execution),
    progress: {
      candidateSourceCount: candidateHashes.length,
      gapCandidateSourceCount: gapCandidateHashes.length,
      selectedSourceCount: rotation.selected.length,
      processedSourceCount,
      sourceDownloadCount: usage.sourceGets.plan.attempts,
      sourceDownloadSuccessCount: usage.sourceGets.plan.successes,
      sourceDownloadFailureCount: usage.sourceGets.plan.failures,
      sourceByteVerifiedCount: processedSourceCount,
      sourceDownloadBytes: usage.sourceGets.plan.bytes,
      plannedOriginalCreates: originals.length,
      plannedDerivativeCreates: derivatives.length,
      transformCount: usage.transforms.successes,
      transformAttemptCount: usage.transforms.attempts,
      transformFailureCount: usage.transforms.failures,
      conflictCount: conflicts.length,
      originalBudgetSkippedCount,
      derivativeBudgetSkippedCount,
      partial,
      stoppedByByteBudget,
      stoppedByLifecycleBudget,
      usage,
    },
  };
}

export function sanitizeRecoveryPlan(plan, inventory) {
  const execution = validateRecoveryPlanDocument(plan);
  const conflictsByReason = Object.fromEntries(
    [...new Set(execution.conflicts.map((item) => item.reason))].sort().map((reason) => [reason, execution.conflicts.filter((item) => item.reason === reason).length]),
  );
  return sanitizeReport({
    version: plan.version,
    generatedAt: plan.generatedAt,
    planDigest: plan.planDigest,
    sourceSnapshotDigest: execution.sourceSnapshotDigest,
    r2StateDigest: execution.r2StateDigest,
    publicActiveExperienceCount: inventory.publicActiveExperienceCount,
    expectedDerivativeCount: inventory.expectedDerivativeCount,
    manifest: inventory.manifestDrift,
    progress: plan.progress,
    cursor: execution.cursor,
    nextCursor: execution.nextCursor,
    budget: execution.budget,
    lifecycleBudget: execution.lifecycleBudget,
    cost: {
      supabaseSourceGetCount: plan.progress.sourceDownloadCount,
      supabaseSourceBytes: plan.progress.sourceDownloadBytes,
      r2ConditionalPutCount: execution.originals.length + execution.derivatives.length,
      imageTransformCount: plan.progress.transformAttemptCount,
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
    budgetState: values['budget-state'] ? path.resolve(values['budget-state']) : null,
    confirmDigest: values['confirm-digest'] || null,
    phase: values.phase || null,
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
    if (!args.plan || !args.budgetState || !args.confirmDigest || !args.phase) {
      throw new Error('--plan, --budget-state, --confirm-digest, and --phase are required.');
    }
    const prior = JSON.parse(await readFile(args.plan, 'utf8'));
    validateRecoveryPlanDocument(prior, args.confirmDigest);
    const budgetState = JSON.parse(await readFile(args.budgetState, 'utf8'));
    let result;
    try {
      result = await verifyRecoverySources({
        inventory: live.inventory,
        plan: prior,
        phase: args.phase,
        budgetState,
        fetchSource: (source, options) => fetchBoundedSource(live.baseUrl, live.anonKey, source.sourceKey, options),
      });
    } finally {
      await writeFile(args.budgetState, stableJson(budgetState), { mode: 0o600 });
      await chmod(args.budgetState, 0o600);
    }
    const verificationSummary = sanitizeReport({
      ...result,
      phase: args.phase,
      sourceReadUsage: budgetState.usage.sourceGets[args.phase],
      lifecycleSourceReadUsage: sourceTotals(budgetState.usage),
    });
    await writeFile(path.join(args.output, `recovery-source-${args.phase}.json`), stableJson(verificationSummary));
    console.log(stableJson(verificationSummary));
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
    fetchSource: (source, options) => fetchBoundedSource(live.baseUrl, live.anonKey, source.sourceKey, options),
    transform: async ({ source, specification }) => sharp(source).rotate().resize({ width: specification.width, withoutEnlargement: true }).webp({ quality: specification.quality, effort: 5 }).toBuffer(),
  });
  const privatePath = path.join(args.output, '.recovery-plan.json');
  await writeFile(privatePath, stableJson(plan), { mode: 0o600 });
  await chmod(privatePath, 0o600);
  const budgetStatePath = path.join(args.output, '.recovery-budget.json');
  await writeFile(budgetStatePath, stableJson(createRecoveryBudgetState(plan)), { mode: 0o600 });
  await chmod(budgetStatePath, 0o600);
  const summary = sanitizeRecoveryPlan(plan, live.inventory);
  await writeFile(path.join(args.output, 'recovery-plan-summary.json'), stableJson(summary));
  console.log(stableJson(summary));
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `plan_digest=${plan.planDigest}\nplanned_writes=${plan.execution.originals.length + plan.execution.derivatives.length}\n`, { flag: 'a' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
