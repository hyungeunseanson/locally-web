import { createHash } from 'node:crypto';
import { compareDurableObjectProof } from './durable-object-release-safety.mjs';

export const PRODUCTION_WORKER = 'locally-web-opennext-production';
export const PRODUCTION_ORIGIN = 'https://www.locally-travel.com';
export const PINNED_WRANGLER_VERSION = '4.129.1';
const COMPATIBLE_DO = new Set(['DO_IMPLEMENTATION_UNCHANGED', 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MANAGED_VAR = /^(CLOUDFLARE_DEPLOYMENT_ENV|PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS|.+_ENABLED)$/;
const TARGET_KEYS = ['service', 'environment', 'entrypoint', 'queue_name', 'bucket_name', 'class_name', 'namespace_id', 'script_name', 'id'];

export class CandidateReleaseBlocked extends Error {
  constructor(code) {
    super(`CANDIDATE_OVERRIDE_ONLY_RELEASE_FLOW_BLOCKED:${code}`);
    this.name = 'CandidateReleaseBlocked';
    this.code = code;
  }
}

function requireCondition(condition, code) {
  if (!condition) throw new CandidateReleaseBlocked(code);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Keep encrypted binding names/types, never their values. Only managed flags
// are eligible for text comparison; public API keys are excluded as well.
export function safeBinding(binding) {
  const result = { name: binding.name, type: binding.type };
  for (const key of TARGET_KEYS) if (binding[key] !== undefined) result[key] = binding[key];
  if (binding.valueSha256 !== undefined) {
    requireCondition(/^[a-f0-9]{64}$/.test(binding.valueSha256), 'invalid_variable_fingerprint');
    result.valueSha256 = binding.valueSha256;
  }
  if (binding.type === 'plain_text' && MANAGED_VAR.test(binding.name)) result.text = binding.text;
  return result;
}

export function safeConfigSnapshot(snapshot) {
  requireCondition(snapshot && Array.isArray(snapshot.bindings), 'snapshot_missing');
  return {
    routes: snapshot.routes.map(r => ({ pattern: r.pattern })),
    customDomains: snapshot.customDomains.map(d => ({ hostname: d.hostname })),
    subdomain: { enabled: snapshot.subdomain.enabled, previews_enabled: snapshot.subdomain.previews_enabled },
    observability: snapshot.observability,
    runtime: snapshot.runtime,
    scriptGlobalSettings: snapshot.scriptGlobalSettings,
    bindings: snapshot.bindings.map(safeBinding),
    crons: snapshot.crons,
    queueConsumers: snapshot.queueConsumers.map(c => ({
      queue: c.queue_name ?? c.queue, script: c.script, service: c.service,
      queue_id: c.queue_id, consumer_id: c.consumer_id, type: c.type,
      deadLetterQueue: c.dead_letter_queue ?? c.deadLetterQueue,
      settings: Object.fromEntries(['batch_size', 'max_wait_time_ms', 'max_retries', 'max_concurrency', 'retry_delay'].filter(k => c.settings?.[k] !== undefined).map(k => [k, c.settings[k]])),
    })),
  };
}

export function assertBindingsUnchanged(before, after, metadata = 'unchanged') {
  const a = before.map(safeBinding);
  const b = after.map(safeBinding);
  const isMetadata = v => v.name === 'CF_VERSION_METADATA' && v.type === 'version_metadata' && Object.keys(v).length === 2;
  if (metadata !== 'unchanged') {
    requireCondition(b.filter(isMetadata).length <= 1, 'candidate_binding_or_secret_drift');
    if (metadata === 'required' || a.some(isMetadata)) requireCondition(b.filter(isMetadata).length === 1, 'candidate_version_metadata_binding_missing');
    requireCondition(stableJson(a.filter(v => !isMetadata(v))) === stableJson(b.filter(v => !isMetadata(v))), 'candidate_binding_or_secret_drift');
    return;
  }
  requireCondition(stableJson(a) === stableJson(b), 'candidate_binding_or_secret_drift');
}

export function assertConfigUnchanged(before, after, { metadata = 'unchanged' } = {}) {
  const a = safeConfigSnapshot(before);
  const b = safeConfigSnapshot(after);
  assertBindingsUnchanged(a.bindings, b.bindings, metadata);
  delete a.bindings; delete b.bindings;
  requireCondition(stableJson(a) === stableJson(b), 'trigger_or_config_drift');
}

// Version resources are immutable and scoped to an exact UUID. Never infer
// active bindings from the legacy script-and-version /settings projection.
export function safeVersionSnapshot(version) {
  requireCondition(UUID.test(version?.id) && version.resources?.script?.etag
    && Array.isArray(version.resources.bindings) && version.resources.script_runtime, 'exact_version_missing');
  return { id: version.id, resources: { ...version.resources,
    bindings: version.resources.bindings.map(binding => safeBinding({ ...binding,
      ...(binding.type === 'plain_text' ? { valueSha256: createHash('sha256').update(binding.text).digest('hex') } : {}),
    })),
  } };
}

export function assertPostUploadInvariance(before, after) {
  requireCondition(before.activeDeployment && after.activeDeployment
    && before.activeStableVersion && after.activeStableVersion
    && before.scriptGlobalSettings && after.scriptGlobalSettings
    && before.triggersAndBindingsOutsideVersionScope && after.triggersAndBindingsOutsideVersionScope,
  'version_scoped_snapshot_missing');
  requireCondition(stableJson(before.activeDeployment) === stableJson(after.activeDeployment), 'upload_changed_active_deployment');
  captureStableVersion(before.activeDeployment);
  requireCondition(before.activeStableVersion.id === captureStableVersion(after.activeDeployment)
    && stableJson(before.activeStableVersion) === stableJson(after.activeStableVersion), 'active_stable_version_changed');
  requireCondition(stableJson(before.scriptGlobalSettings) === stableJson(after.scriptGlobalSettings), 'script_global_settings_changed');
  requireCondition(stableJson(before.triggersAndBindingsOutsideVersionScope) === stableJson(after.triggersAndBindingsOutsideVersionScope), 'trigger_or_config_drift');
  assertConfigUnchanged(before.snapshot, after.snapshot);
  const candidate = after.uploadedCandidateVersion;
  requireCondition(candidate && candidate.id !== before.activeStableVersion.id, 'exact_candidate_missing');
  assertBindingsUnchanged(before.activeStableVersion.resources.bindings, candidate.resources.bindings, 'required');
  requireCondition(stableJson(before.activeStableVersion.resources.script_runtime) === stableJson(candidate.resources.script_runtime), 'candidate_runtime_drift');
  for (const field of ['handlers', 'named_handlers']) requireCondition(
    stableJson(before.activeStableVersion.resources.script[field]) === stableJson(candidate.resources.script[field]), 'candidate_export_drift');
  return 'POST_UPLOAD_INVARIANCE_PASS';
}

export function assertDurableObjectLifecycle({ config, baselineConfig, workerSource, baselineWorkerSource }) {
  const lifecycle = c => ({ rootMigrations: c.migrations, rootExports: c.exports,
    productionMigrations: c.env.production.migrations, productionExports: c.env.production.exports,
    rootBindings: c.durable_objects, productionBindings: c.env.production.durable_objects });
  const exports = source => source?.match(/export\s*\{\s*DOQueueHandler\s*,\s*DOShardedTagCache\s*\}\s*from\s*['"]\.\/\.open-next\/worker\.js['"]\s*;/g);
  const exportLifecycle = source => {
    if (typeof source !== 'string') return null;
    const declarations = source.match(/\bexport\s+(?:default\s+[\w$]+\s*;|\{[^}]*\}\s*(?:from\s*['"][^'"]+['"])?\s*;|(?:class|function|const|let|var)\s+[\w$]+)/g) ?? [];
    if (declarations.length !== (source.match(/\bexport\s/g) ?? []).length) return null;
    return declarations.map(s => s.replace(/\s/g, '').replace(/"/g, "'"));
  };
  const candidateExports = exportLifecycle(workerSource);
  const stableExports = exportLifecycle(baselineWorkerSource);
  requireCondition(baselineConfig && JSON.stringify(lifecycle(config)) === JSON.stringify(lifecycle(baselineConfig))
    && exports(workerSource)?.length === 1 && exports(baselineWorkerSource)?.length === 1
    && candidateExports && stableExports && JSON.stringify(candidateExports) === JSON.stringify(stableExports), 'DURABLE_OBJECT_LIFECYCLE_CHANGE_REQUIRES_ATOMIC_DEPLOY');
}

export function captureStableVersion(deployment) {
  requireCondition(deployment?.versions?.length === 1, 'stable_deployment_not_single_version');
  const version = deployment.versions[0];
  requireCondition(UUID.test(version.id) && version.percentage === 100, 'stable_deployment_not_100_percent');
  return version.id;
}

export function versionOverrideHeader(workerName, versionId) {
  requireCondition(/^[a-z][a-z0-9-]*$/.test(workerName) && UUID.test(versionId), 'invalid_version_override');
  return `${workerName}="${versionId}"`;
}

export function parseVersionUploadOutput(output, workerName = PRODUCTION_WORKER) {
  // Never forward CLI output: it can contain environment variables or secrets.
  const ids = [...output.matchAll(/Worker Version ID:\s*([a-f0-9-]{36})/g)].map(m => m[1]);
  requireCondition(ids.length === 1 && UUID.test(ids[0]), 'uploaded_version_id_missing_or_ambiguous');
  const match = output.match(/Version Preview URL:\s*(https:\/\/[^\s]+)/);
  const result = { versionId: ids[0], versionUrl: null };
  if (match) {
    let url;
    try { url = new URL(match[1]); }
    catch { throw new CandidateReleaseBlocked('invalid_provider_version_url'); }
    requireCondition(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/' && url.hostname.startsWith(`${ids[0].slice(0, 8)}-${workerName}.`)
      && url.hostname.endsWith('.workers.dev'), 'invalid_provider_version_url');
    result.versionUrl = url.origin;
  }
  return result;
}

export function buildCandidateReleasePlan({ config, baseline, runtimeVariables, baselineConfig, wranglerVersion,
  workerSource, baselineWorkerSource, durableObjectProof, bridgeLineage, doCodeUpdateMode }) {
  requireCondition(wranglerVersion === PINNED_WRANGLER_VERSION, 'wrangler_contract_version_changed');
  requireCondition(config.keep_vars === true, 'keep_vars_required');
  requireCondition(config.env.production.name === PRODUCTION_WORKER, 'unexpected_worker');
  assertDurableObjectLifecycle({ config, baselineConfig, workerSource, baselineWorkerSource });
  const stripMetadata = c => {
    const clone = structuredClone(c);
    if (clone.env.production.version_metadata !== undefined) {
      requireCondition(JSON.stringify(clone.env.production.version_metadata) === JSON.stringify({ binding: 'CF_VERSION_METADATA' }), 'planned_trigger_or_config_change');
      delete clone.env.production.version_metadata;
    }
    return clone;
  };
  requireCondition(config.env.production.version_metadata?.binding === 'CF_VERSION_METADATA', 'candidate_version_metadata_binding_missing');
  requireCondition(JSON.stringify(stripMetadata(config)) === JSON.stringify(stripMetadata(baselineConfig)), 'planned_trigger_or_config_change');
  const snapshot = safeConfigSnapshot(baseline.snapshot);
  requireCondition(snapshot.runtime && snapshot.runtime.compatibilityDate === (config.env.production.compatibility_date ?? config.compatibility_date)
    && stableJson(snapshot.runtime.compatibilityFlags) === stableJson(config.env.production.compatibility_flags ?? config.compatibility_flags)
    && snapshot.runtime.migrationTag === (config.env.production.migrations ?? config.migrations)?.at(-1)?.tag, 'live_runtime_or_migration_drift');
  const stableVersionId = captureStableVersion(baseline.deployment);
  for (const [name, value] of Object.entries(runtimeVariables)) {
    requireCondition(MANAGED_VAR.test(name), 'credential_or_unmanaged_var_override');
    requireCondition(snapshot.bindings.some(b => b.name === name && b.type === 'plain_text' && b.text === value), 'planned_var_change');
  }
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    requireCondition(snapshot.bindings.some(b => b.name === name && b.type === 'secret_text'), 'required_encrypted_binding_missing');
  }
  const doImplementation = compareDurableObjectProof(durableObjectProof, stableVersionId);
  const blockers = COMPATIBLE_DO.has(doImplementation) ? [] : [doImplementation];
  requireCondition(/^[a-f0-9]{64}$/.test(bridgeLineage ?? ''), 'bridge_lineage_missing');
  if (doImplementation === 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY') {
    requireCondition(durableObjectProof.bridgeCompatibility.compatSha256 === bridgeLineage, 'bridge_lineage_mismatch');
    requireCondition(doCodeUpdateMode === 'provider-default-no-drain-guarantee', 'explicit_supported_do_update_mode_required');
  }
  const ownObjects = config.env.production.durable_objects?.bindings?.filter(b => !b.script_name || b.script_name === PRODUCTION_WORKER) ?? [];
  return {
    status: blockers.length ? 'CANDIDATE_OVERRIDE_ONLY_RELEASE_FLOW_BLOCKED' : 'CANDIDATE_OVERRIDE_ONLY_RELEASE_FLOW_READY',
    blockers, workerName: PRODUCTION_WORKER, productionOrigin: PRODUCTION_ORIGIN,
    stableVersionId, stableDeployment: baseline.deployment, baselineSnapshot: snapshot,
    bridgeLineage, doCodeUpdateMode, plannedTriggerChanges: [], intentionalBindingAddition: 'CF_VERSION_METADATA', doImplementation,
    versionUrlCapability: ownObjects.length ? 'UNAVAILABLE_EXPECTED_FOR_DO_WORKER' : snapshot.subdomain.previews_enabled ? 'OPTIONAL' : 'UNAVAILABLE_PREVIEWS_DISABLED',
    encryptedSecrets: 'inherit_without_reading_values',
    uploadArguments: ['versions', 'upload', '--config', './wrangler.jsonc', '--env', 'production', '--keep-vars', '--strict',
      ...Object.entries(runtimeVariables).flatMap(([name, value]) => ['--var', `${name}:${value}`])],
  };
}

export function stageZeroArguments(plan, candidateId) {
  requireCondition(plan.blockers.length === 0, 'candidate_plan_blocked');
  requireCondition(plan.doImplementation !== 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY'
    || plan.doCodeUpdateMode === 'provider-default-no-drain-guarantee', 'explicit_supported_do_update_mode_required');
  requireCondition(UUID.test(candidateId) && candidateId !== plan.stableVersionId, 'candidate_equals_stable_or_invalid');
  // Explicit zero is mandatory. Never substitute epsilon traffic.
  return ['versions', 'deploy', `${plan.stableVersionId}@100%`, `${candidateId}@0%`, '--config', './wrangler.jsonc', '--env', 'production', '--yes'];
}

export function classifyCandidateAttempt(attempt) {
  const safe = attempt.httpHardErrors === 0 && attempt.fiveXX === 0 && attempt.asset404 === 0
    && attempt.genericError === false && attempt.pageErrors === 0 && attempt.consoleErrors === 0
    && attempt.unexpectedWrites === 0 && attempt.versionMismatch === false;
  return attempt.timeout === true && safe && attempt.pendingStaticAssets > 0
    ? 'TRANSPORT_ONLY_TIMEOUT' : 'APPLICATION_FAILURE';
}

export function assertFullCandidateSmoke(smoke) {
  requireCondition(smoke?.fullPass === true, 'full_candidate_smoke_missing');
  requireCondition(smoke.httpHardErrors === 0 && smoke.fiveXX === 0 && smoke.asset404 === 0
    && smoke.genericError === false && smoke.pageErrors === 0 && smoke.consoleErrors === 0
    && smoke.unexpectedWrites === 0 && smoke.versionMismatch === false, 'candidate_hard_failure');
  requireCondition(['home', 'login', 'experience', 'api401'].every(k => smoke.checks?.[k] === true), 'candidate_checks_incomplete');
  requireCondition(Array.isArray(smoke.assetRefs) && smoke.assetRefs.length > 0
    && smoke.assetRefs.every(path => path.startsWith('/_next/static/') && !path.includes('?')
      && smoke.assetResponses?.some(r => r.pathname === path && r.status === 200 && r.overrideApplied === true && r.redirected === false)), 'candidate_asset_missing');
  requireCondition(smoke.assetSetMatches === true, 'candidate_asset_set_mismatch');
  requireCondition(Array.isArray(smoke.attempts) && smoke.attempts.length > 0, 'bounded_attempt_evidence_missing');
  const byPath = new Map();
  for (const attempt of smoke.attempts) {
    const attempts = byPath.get(attempt.pathname) ?? [];
    attempts.push(attempt);
    byPath.set(attempt.pathname, attempts);
    requireCondition(attempts.length <= 2, 'more_than_two_smoke_attempts');
    if (attempt.timeout) requireCondition(classifyCandidateAttempt(attempt) === 'TRANSPORT_ONLY_TIMEOUT', 'candidate_application_timeout');
    else requireCondition(attempt.pass === true, 'candidate_attempt_failure');
  }
  requireCondition(byPath.has('/') && byPath.has('/login')
    && [...byPath.keys()].some(p => /^\/experiences\/\d+$/.test(p)), 'bounded_attempt_evidence_missing');
  requireCondition([...byPath.values()].every(attempts => attempts.at(-1).pass === true
    && attempts.at(-1).timeout === false), 'full_pass_after_timeout_missing');
}

// Unsampled response metadata proves execution; sampled Observability events
// are optional corroboration and never a promotion prerequisite.
export function assertOverrideIdentity({ versionId, smoke, expectedOrigin = PRODUCTION_ORIGIN }) {
  requireCondition(UUID.test(versionId), 'invalid_candidate_identity');
  requireCondition(smoke.origin === expectedOrigin && smoke.redirected === false, 'override_origin_changed');
  requireCondition(smoke.allFirstPartyReadsOverridden === true
    && ['document', 'script', 'stylesheet', 'font', 'image', 'data', 'api'].every(k => smoke.overrideCoverage?.[k] === true), 'override_subrequest_coverage_missing');
  requireCondition(smoke.probeReceipt?.pathname === '/.well-known/locally-release'
    && smoke.probeReceipt.versionId === versionId && smoke.probeReceipt.status === 204
    && smoke.probeReceipt.overrideApplied === true && smoke.probeReceipt.probeApplied === true, 'candidate_identity_unverified');
  const receipts = smoke.workerReceipts;
  requireCondition(Array.isArray(receipts) && receipts.length >= 4, 'candidate_request_receipts_missing');
  const paths = new Set(receipts.map(r => r.pathname));
  requireCondition(paths.has('/') && paths.has('/login') && paths.has('/api/proxy-bookings')
    && [...paths].some(p => /^\/experiences\/\d+$/.test(p)), 'candidate_request_receipts_missing');
  for (const receipt of receipts) {
    requireCondition(!receipt.pathname.includes('?') && receipt.overrideApplied === true, 'candidate_identity_unverified');
  }
}

export function promotionArguments(plan, candidateId, evidence) {
  requireCondition(plan.blockers.length === 0, 'candidate_plan_blocked');
  requireCondition(plan.doImplementation !== 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY'
    || plan.doCodeUpdateMode === 'provider-default-no-drain-guarantee', 'explicit_supported_do_update_mode_required');
  requireCondition(UUID.test(candidateId) && candidateId !== plan.stableVersionId, 'candidate_equals_stable_or_invalid');
  requireCondition(evidence.semanticPreflight === 'PASS' && evidence.uploadDeploymentUnchanged === true
    && evidence.exactZeroStagingVerified === true && evidence.overrideIdentityVerified === true
    && evidence.doImplementation === plan.doImplementation && COMPATIBLE_DO.has(evidence.doImplementation)
    && evidence.promotionAuthorized === true && evidence.bridgeLineage === plan.bridgeLineage, 'promotion_identity_or_preflight_missing');
  assertFullCandidateSmoke(evidence.overrideSmoke);
  assertOverrideIdentity({ versionId: candidateId, smoke: evidence.overrideSmoke });
  return ['versions', 'deploy', `${candidateId}@100%`, '--config', './wrangler.jsonc', '--env', 'production', '--yes'];
}

export function rollbackArguments(plan) {
  requireCondition(plan.blockers.length === 0 && COMPATIBLE_DO.has(plan.doImplementation) && /^[a-f0-9]{64}$/.test(plan.bridgeLineage), 'rollback_compatibility_missing');
  return ['versions', 'deploy', `${plan.stableVersionId}@100%`, '--config', './wrangler.jsonc', '--env', 'production', '--yes'];
}

export function assertDistribution(deployment, expected) {
  requireCondition(stableJson(deployment.versions) === stableJson(expected), 'unexpected_deployment_distribution');
}

// Provider operations are injected and exercised with fixture adapters. The
// CLI below deliberately installs no live mutation adapters.
export async function executeCandidateReleaseContract(plan, actions) {
  requireCondition(plan.blockers.length === 0 && plan.plannedTriggerChanges.length === 0, 'candidate_plan_blocked');
  requireCondition(actions.authorizedCandidateUpload === true, 'candidate_upload_not_authorized');
  await actions.build({ bridgeSource: 'provider' });
  requireCondition(await actions.semanticPreflight() === 'PASS', 'semantic_preflight_failed');
  const proof = await actions.durableObjectProof(plan.stableVersionId);
  const doImplementation = compareDurableObjectProof(proof, plan.stableVersionId);
  requireCondition(COMPATIBLE_DO.has(doImplementation) && doImplementation === plan.doImplementation, doImplementation);
  const before = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, before.snapshot);
  assertDistribution(before.deployment, [{ id: plan.stableVersionId, percentage: 100 }]);
  requireCondition(before.deployment.id === plan.stableDeployment.id, 'concurrent_deployment_changed');
  const bridgeProof = await actions.bridgeProofFreshness();
  requireCondition(bridgeProof?.kind === 'provider' && bridgeProof.etagMatch === true
    && bridgeProof.deploymentId === before.deployment.id && bridgeProof.versionId === plan.stableVersionId
    && /^[a-f0-9]{64}$/.test(bridgeProof.etag ?? '') && bridgeProof.etag === proof.scriptEtag
    && (!proof.bridgeCompatibility || proof.bridgeCompatibility.compatSha256 === plan.bridgeLineage)
    && bridgeProof.compatSha256 === plan.bridgeLineage, 'bridge_provenance_or_freshness_failed');
  const candidate = parseVersionUploadOutput(await actions.upload(plan.uploadArguments), plan.workerName);
  requireCondition(candidate.versionId !== plan.stableVersionId, 'candidate_equals_stable_or_invalid');
  const metadata = await actions.versionMetadata(candidate.versionId);
  requireCondition(metadata.id === candidate.versionId, 'uploaded_version_metadata_mismatch');
  assertBindingsUnchanged(plan.baselineSnapshot.bindings, metadata.bindings, 'required');
  requireCondition(stableJson(metadata.runtime) === stableJson(plan.baselineSnapshot.runtime), 'candidate_runtime_drift');
  const afterUpload = await actions.snapshot({ candidateVersionId: candidate.versionId });
  assertPostUploadInvariance(before, afterUpload);
  assertConfigUnchanged(plan.baselineSnapshot, afterUpload.snapshot);
  assertDistribution(afterUpload.deployment, [{ id: plan.stableVersionId, percentage: 100 }]);
  requireCondition(afterUpload.deployment.id === before.deployment.id, 'upload_changed_active_deployment');
  await actions.stageZero(stageZeroArguments(plan, candidate.versionId));
  const zero = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, zero.snapshot, { metadata: 'optional' });
  assertDistribution(zero.deployment, [{ id: plan.stableVersionId, percentage: 100 }, { id: candidate.versionId, percentage: 0 }]);
  const overrideSmoke = await actions.smoke({ mode: 'override', origin: plan.productionOrigin, workerName: plan.workerName, versionId: candidate.versionId,
    overrideHeader: versionOverrideHeader(plan.workerName, candidate.versionId) });
  assertFullCandidateSmoke(overrideSmoke);
  assertOverrideIdentity({ versionId: candidate.versionId, smoke: overrideSmoke });
  requireCondition(await actions.authorizePromotion({ stableVersionId: plan.stableVersionId, candidateVersionId: candidate.versionId, bridgeLineage: plan.bridgeLineage }) === true, 'promotion_not_authorized');
  const identity = await actions.recheckIdentity(candidate.versionId);
  requireCondition(identity?.versionId === candidate.versionId && identity.status === 204, 'candidate_identity_expired');
  // Recheck for concurrent deployments/config changes immediately before promotion.
  const finalPrecheck = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, finalPrecheck.snapshot, { metadata: 'optional' });
  assertDistribution(finalPrecheck.deployment, zero.deployment.versions);
  requireCondition(finalPrecheck.deployment.id === zero.deployment.id, 'concurrent_deployment_changed');
  const args = promotionArguments(plan, candidate.versionId, { semanticPreflight: 'PASS', uploadDeploymentUnchanged: true,
    exactZeroStagingVerified: true, doImplementation, overrideIdentityVerified: true, overrideSmoke, promotionAuthorized: true, bridgeLineage: plan.bridgeLineage });
  await actions.promote(args);
  const final = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, final.snapshot, { metadata: 'required' });
  assertDistribution(final.deployment, [{ id: candidate.versionId, percentage: 100 }]);
  const verification = await actions.postDeployVerification(candidate.versionId);
  requireCondition(verification.browserSmoke === 'PASS' && verification.naturalCronHealth === 'PASS'
    && verification.queueHealth === 'PASS' && verification.scheduledFlags === 'UNCHANGED', 'post_deploy_verification_failed');
  return { status: 'CANDIDATE_OVERRIDE_ONLY_RELEASE_CONTRACT_PASS', candidateVersionId: candidate.versionId,
    stableVersionId: plan.stableVersionId, rollbackArguments: rollbackArguments(plan) };
}
