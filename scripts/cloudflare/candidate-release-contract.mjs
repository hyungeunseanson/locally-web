export const PRODUCTION_WORKER = 'locally-web-opennext-production';
export const PRODUCTION_ORIGIN = 'https://www.locally-travel.com';
export const PINNED_WRANGLER_VERSION = '4.129.1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MANAGED_VAR = /^(CLOUDFLARE_DEPLOYMENT_ENV|PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS|.+_ENABLED)$/;
const TARGET_KEYS = ['service', 'environment', 'entrypoint', 'queue_name', 'bucket_name', 'class_name', 'namespace_id', 'script_name', 'id'];

export class CandidateReleaseBlocked extends Error {
  constructor(code) {
    super(`CANDIDATE_FIRST_RELEASE_FLOW_BLOCKED:${code}`);
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

export function assertConfigUnchanged(before, after) {
  requireCondition(stableJson(safeConfigSnapshot(before)) === stableJson(safeConfigSnapshot(after)), 'trigger_or_config_drift');
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

export function buildCandidateReleasePlan({ config, baseline, runtimeVariables, baselineConfig, wranglerVersion }) {
  requireCondition(wranglerVersion === PINNED_WRANGLER_VERSION, 'wrangler_contract_version_changed');
  requireCondition(config.keep_vars === true, 'keep_vars_required');
  requireCondition(config.env.production.name === PRODUCTION_WORKER, 'unexpected_worker');
  // Preserve local array order: reordering DO migrations is a planned change.
  requireCondition(baselineConfig && JSON.stringify(config) === JSON.stringify(baselineConfig), 'planned_trigger_or_config_change');
  const snapshot = safeConfigSnapshot(baseline.snapshot);
  const stableVersionId = captureStableVersion(baseline.deployment);
  for (const [name, value] of Object.entries(runtimeVariables)) {
    requireCondition(MANAGED_VAR.test(name), 'credential_or_unmanaged_var_override');
    requireCondition(snapshot.bindings.some(b => b.name === name && b.type === 'plain_text' && b.text === value), 'planned_var_change');
  }
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    requireCondition(snapshot.bindings.some(b => b.name === name && b.type === 'secret_text'), 'required_encrypted_binding_missing');
  }
  const blockers = [];
  const ownObjects = config.env.production.durable_objects?.bindings?.filter(b => !b.script_name || b.script_name === PRODUCTION_WORKER) ?? [];
  if (ownObjects.length) blockers.push('isolated_version_url_unsupported_for_durable_object_worker');
  if (snapshot.subdomain.previews_enabled !== true) blockers.push('isolated_version_urls_disabled');
  return {
    status: blockers.length ? 'CANDIDATE_FIRST_RELEASE_FLOW_BLOCKED' : 'CANDIDATE_FIRST_RELEASE_PLAN_READY',
    blockers, workerName: PRODUCTION_WORKER, productionOrigin: PRODUCTION_ORIGIN,
    stableVersionId, stableDeployment: baseline.deployment, baselineSnapshot: snapshot,
    plannedTriggerChanges: [], encryptedSecrets: 'inherit_without_reading_values',
    uploadArguments: ['versions', 'upload', '--config', './wrangler.jsonc', '--env', 'production', '--keep-vars', '--strict',
      ...Object.entries(runtimeVariables).flatMap(([name, value]) => ['--var', `${name}:${value}`])],
  };
}

export function stageZeroArguments(plan, candidateId) {
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
      && smoke.assetResponses?.some(r => r.pathname === path && r.status === 200)), 'candidate_asset_missing');
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

// A provider version listing proves existence, not execution. Require the
// recorded response Ray IDs to match existing Workers Observability events.
export function assertOverrideIdentity({ versionId, workerName, smoke, events }) {
  requireCondition(smoke.origin === PRODUCTION_ORIGIN && smoke.redirected === false, 'override_origin_changed');
  requireCondition(['document', 'script', 'font', 'api'].every(k => smoke.overrideCoverage?.[k] === true), 'override_subrequest_coverage_missing');
  const receipts = smoke.workerReceipts;
  requireCondition(Array.isArray(receipts) && receipts.length >= 4, 'candidate_request_receipts_missing');
  const paths = new Set(receipts.map(r => r.pathname));
  requireCondition(paths.has('/') && paths.has('/login') && paths.has('/api/proxy-bookings')
    && [...paths].some(p => /^\/experiences\/\d+$/.test(p)), 'candidate_request_receipts_missing');
  requireCondition(Array.isArray(events), 'candidate_identity_unverified');
  for (const receipt of receipts) {
    requireCondition(/^[a-f0-9]{16}$/.test(receipt.rayId) && !receipt.pathname.includes('?'), 'invalid_request_receipt');
    requireCondition(events.some(event => {
      const w = event.$workers;
      return w?.scriptName === workerName && w.scriptVersion?.id === versionId
        && w.requestId?.toLowerCase() === receipt.rayId && w.eventType === 'fetch'
        && w.outcome === 'ok' && event.timestamp >= receipt.startedAt && event.timestamp <= receipt.finishedAt;
    }), 'candidate_identity_unverified');
  }
}

export function promotionArguments(plan, candidateId, evidence) {
  requireCondition(UUID.test(candidateId) && candidateId !== plan.stableVersionId, 'candidate_equals_stable_or_invalid');
  requireCondition(evidence.semanticPreflight === 'PASS' && evidence.isolatedIdentityVerified === true
    && evidence.overrideIdentityVerified === true, 'promotion_identity_or_preflight_missing');
  assertFullCandidateSmoke(evidence.isolatedSmoke);
  assertFullCandidateSmoke(evidence.overrideSmoke);
  return ['versions', 'deploy', `${candidateId}@100%`, '--config', './wrangler.jsonc', '--env', 'production', '--yes'];
}

export function rollbackArguments(plan) {
  return ['versions', 'deploy', `${plan.stableVersionId}@100%`, '--config', './wrangler.jsonc', '--env', 'production', '--yes'];
}

function assertDistribution(deployment, expected) {
  requireCondition(stableJson(deployment.versions) === stableJson(expected), 'unexpected_deployment_distribution');
}

// Provider operations are injected and exercised with fixture adapters. The
// CLI below does not install live mutation adapters while isolation is blocked.
export async function executeCandidateReleaseContract(plan, actions) {
  requireCondition(plan.blockers.length === 0 && plan.plannedTriggerChanges.length === 0, 'candidate_plan_blocked');
  await actions.build();
  requireCondition(await actions.semanticPreflight() === 'PASS', 'semantic_preflight_failed');
  const before = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, before.snapshot);
  assertDistribution(before.deployment, [{ id: plan.stableVersionId, percentage: 100 }]);
  const candidate = parseVersionUploadOutput(await actions.upload(plan.uploadArguments), plan.workerName);
  requireCondition(candidate.versionId !== plan.stableVersionId && candidate.versionUrl, 'isolated_candidate_endpoint_missing');
  const metadata = await actions.versionMetadata(candidate.versionId);
  requireCondition(metadata.id === candidate.versionId, 'uploaded_version_metadata_mismatch');
  requireCondition(stableJson(metadata.bindings.map(safeBinding)) === stableJson(plan.baselineSnapshot.bindings), 'candidate_binding_or_secret_drift');
  const afterUpload = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, afterUpload.snapshot);
  assertDistribution(afterUpload.deployment, [{ id: plan.stableVersionId, percentage: 100 }]);
  const isolatedSmoke = await actions.smoke({ mode: 'isolated', origin: candidate.versionUrl, versionId: candidate.versionId });
  assertFullCandidateSmoke(isolatedSmoke);
  requireCondition(isolatedSmoke.origin === candidate.versionUrl && isolatedSmoke.redirected === false, 'isolated_candidate_identity_unverified');
  await actions.stageZero(stageZeroArguments(plan, candidate.versionId));
  const zero = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, zero.snapshot);
  assertDistribution(zero.deployment, [{ id: plan.stableVersionId, percentage: 100 }, { id: candidate.versionId, percentage: 0 }]);
  const overrideSmoke = await actions.smoke({ mode: 'override', origin: plan.productionOrigin, versionId: candidate.versionId,
    overrideHeader: versionOverrideHeader(plan.workerName, candidate.versionId) });
  assertFullCandidateSmoke(overrideSmoke);
  const events = await actions.identityEvents(overrideSmoke.workerReceipts);
  assertOverrideIdentity({ versionId: candidate.versionId, workerName: plan.workerName, smoke: overrideSmoke, events });
  // Recheck for concurrent deployments/config changes immediately before promotion.
  const finalPrecheck = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, finalPrecheck.snapshot);
  assertDistribution(finalPrecheck.deployment, zero.deployment.versions);
  const args = promotionArguments(plan, candidate.versionId, { semanticPreflight: 'PASS', isolatedIdentityVerified: true,
    overrideIdentityVerified: true, isolatedSmoke, overrideSmoke });
  await actions.promote(args);
  const final = await actions.snapshot();
  assertConfigUnchanged(plan.baselineSnapshot, final.snapshot);
  assertDistribution(final.deployment, [{ id: candidate.versionId, percentage: 100 }]);
  const verification = await actions.postDeployVerification(candidate.versionId);
  requireCondition(verification.browserSmoke === 'PASS' && verification.naturalCronHealth === 'PASS'
    && verification.queueHealth === 'PASS' && verification.scheduledFlags === 'UNCHANGED', 'post_deploy_verification_failed');
  return { status: 'CANDIDATE_FIRST_RELEASE_CONTRACT_PASS', candidateVersionId: candidate.versionId,
    stableVersionId: plan.stableVersionId, rollbackArguments: rollbackArguments(plan) };
}
