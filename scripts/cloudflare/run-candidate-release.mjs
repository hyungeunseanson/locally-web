import { compareBridgeArtifacts } from './bridge-candidate-compatibility.mjs';
import { verifyBridgeRuntimeMatrix } from './bridge-candidate-runtime.mjs';
import { assertProductionBridgeProofFresh } from './revalidation-bridge-freshness.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assertConfigUnchanged, buildCandidateReleasePlan, CandidateReleaseBlocked, PRODUCTION_WORKER } from './candidate-release-contract.mjs';
import { fingerprintDurableObjectArtifact, readStableDurableObjectArtifact } from './durable-object-release-safety.mjs';
import { resolveProductionDeploymentContract } from './run-production-deploy.mjs';
import { readProductionSnapshot, resolveCloudflareReadCredentials, runProductionDeploySemanticPreflight } from './verify-production-deploy-contract.mjs';

export function parseCandidateArguments(args) {
  if (args.length > 1 || args.some(a => !['--plan', '--dry-run'].includes(a))) throw new CandidateReleaseBlocked('unsupported_candidate_release_argument');
  return { dryRun: args[0] === '--dry-run' };
}

export async function readCandidateBaseline({ credentials = resolveCloudflareReadCredentials(), fetchImplementation = fetch } = {}) {
  const snapshot = await readProductionSnapshot({ ...credentials, workerName: PRODUCTION_WORKER, fetchImplementation });
  const r = await fetchImplementation(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers/scripts/${PRODUCTION_WORKER}/deployments`, {
    method: 'GET', headers: { Authorization: `Bearer ${credentials.apiToken}` },
  });
  const body = await r.json();
  if (!r.ok || !body.success) throw new CandidateReleaseBlocked('deployment_snapshot_unavailable');
  const latest = [...(body.result.deployments ?? body.result)].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  const get = async suffix => {
    const response = await fetchImplementation(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}${suffix}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${credentials.apiToken}` },
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new CandidateReleaseBlocked('runtime_snapshot_unavailable');
    return data.result;
  };
  const settings = await get(`/workers/scripts/${PRODUCTION_WORKER}/settings`);
  const scripts = await get('/workers/scripts');
  const script = scripts.find(s => s.id === PRODUCTION_WORKER);
  if (!script?.migration_tag) throw new CandidateReleaseBlocked('migration_tag_missing');
  snapshot.runtime = { compatibilityDate: settings.compatibility_date, compatibilityFlags: settings.compatibility_flags, migrationTag: script.migration_tag };
  for (const binding of snapshot.bindings) {
    const raw = settings.bindings.find(b => b.name === binding.name);
    if (raw?.type === 'plain_text') binding.valueSha256 = createHash('sha256').update(raw.text).digest('hex');
  }
  return { snapshot, deployment: { id: latest?.id, versions: latest?.versions.map(v => ({ id: v.version_id, percentage: v.percentage })) } };
}

function runLocal(command, args, env) {
  // Pipe output even on failure: build/CLI output can contain sensitive values.
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (result.status !== 0 || result.error) throw new CandidateReleaseBlocked('local_build_or_dry_run_failed');
}

export async function main(args = process.argv.slice(2), dependencies = {}) {
  const options = parseCandidateArguments(args);
  const log = dependencies.log ?? console.log;
  const config = dependencies.config ?? JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  // Compare against the fetched main config, including migrations and bindings.
  // A changed local config must not declare itself the unchanged baseline.
  const baselineConfig = dependencies.baselineConfig ?? JSON.parse(execFileSync('git',
    ['show', 'origin/main:wrangler.jsonc'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const workerSource = dependencies.workerSource ?? await readFile('cloudflare-worker.ts', 'utf8');
  const baselineWorkerSource = dependencies.baselineWorkerSource ?? execFileSync('git',
    ['show', 'origin/main:cloudflare-worker.ts'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const contract = await (dependencies.resolveContract ?? resolveProductionDeploymentContract)();
  const baseline = await (dependencies.readBaseline ?? readCandidateBaseline)();
  const wranglerVersion = dependencies.wranglerVersion ?? JSON.parse(await readFile('node_modules/wrangler/package.json', 'utf8')).version;
  const input = { config, baseline, baselineConfig, workerSource, baselineWorkerSource,
    runtimeVariables: contract.runtimeVariables, wranglerVersion,
    bridgeLineage: (dependencies.bridgePolicy ?? JSON.parse(await readFile('config/cloudflare/revalidation-bridge.json', 'utf8'))).compatTokenSha256,
    doCodeUpdateMode: 'provider-default-no-drain-guarantee' };
  let plan = buildCandidateReleasePlan({ ...input, durableObjectProof: dependencies.durableObjectProof });
  const semantic = await (dependencies.semanticPreflight ?? runProductionDeploySemanticPreflight)({
    expectedVariables: contract.runtimeVariables, allowedPlannedChanges: [], allowedPlannedCronAdditions: [], log: () => {},
  });
  if (semantic?.status !== 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS') throw new CandidateReleaseBlocked('semantic_preflight_failed');
  if (options.dryRun) {
    const env = { ...process.env, ...contract.readerEnvironment, WRANGLER_SEND_METRICS: 'false', LOCALLY_ISR_BRIDGE_SOURCE: 'provider' };
    const run = dependencies.runLocal ?? runLocal;
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'cloudflare:build:production'], env);
    run(path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'),
      [...plan.uploadArguments, '--outdir', '.wrangler/candidate-dry-run', '--dry-run'], env);
    const rebuiltSemantic = await (dependencies.semanticPreflight ?? runProductionDeploySemanticPreflight)({ expectedVariables: contract.runtimeVariables, allowedPlannedChanges: [], allowedPlannedCronAdditions: [], log: () => {} });
    if (rebuiltSemantic?.status !== 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS') throw new CandidateReleaseBlocked('semantic_preflight_failed');
    const stableArtifact = await (dependencies.readStableArtifact ?? (() => readStableDurableObjectArtifact({
      credentials: resolveCloudflareReadCredentials(), workerName: PRODUCTION_WORKER, stableVersionId: plan.stableVersionId,
    })))();
    const source = await (dependencies.readCandidateArtifact ?? (() => readFile('.wrangler/candidate-dry-run/cloudflare-worker.js', 'utf8')))();
    const policy = JSON.parse(await readFile('config/cloudflare/revalidation-bridge.json', 'utf8'));
    const bridgeCompatibility = compareBridgeArtifacts(stableArtifact?.source, source, policy.compatTokenSha256);
    if (['DO_IMPLEMENTATION_UNCHANGED', 'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY'].includes(bridgeCompatibility.classification)) {
      bridgeCompatibility.runtime = await verifyBridgeRuntimeMatrix(stableArtifact.source, source);
    }
    await (dependencies.bridgeFreshness ?? assertProductionBridgeProofFresh)();
    const durableObjectProof = { ...stableArtifact, candidate: fingerprintDurableObjectArtifact(source), bridgeCompatibility };
    const after = await (dependencies.readBaseline ?? readCandidateBaseline)();
    assertConfigUnchanged(baseline.snapshot, after.snapshot);
    if (JSON.stringify(baseline.deployment) !== JSON.stringify(after.deployment)) throw new CandidateReleaseBlocked('concurrent_deployment_changed');
    plan = buildCandidateReleasePlan({ ...input, durableObjectProof });
    // Contains only digests, public class/version IDs and dependency versions.
    log(JSON.stringify({ durableObjectProof, doImplementation: plan.doImplementation }));
  }
  const result = {
    status: plan.status, stableVersionId: plan.stableVersionId, blockers: plan.blockers,
    plannedTriggerChanges: [], encryptedSecrets: plan.encryptedSecrets,
    semanticPreflight: 'PASS',
    doImplementation: plan.doImplementation, versionUrlCapability: plan.versionUrlCapability,
    intentionalBindingAddition: plan.intentionalBindingAddition,
    candidateUpload: 0, deploymentMutation: 0, trafficChange: 0,
    localDryRun: options.dryRun ? 'PASS' : 'NOT_RUN',
    liveExecutionAdapters: 'NOT_INSTALLED_CODE_CONTRACT_ONLY',
  };
  log(JSON.stringify(result));
  // Plan/read-only and local dry-run only. No upload/stage/promote command can
  // be executed by this CLI; exact-zero staging needs separate authorization.
  if (plan.blockers.length) throw new CandidateReleaseBlocked(plan.blockers[0]);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { await main(); }
  catch (error) {
    console.error(JSON.stringify({ status: 'CANDIDATE_OVERRIDE_ONLY_RELEASE_FLOW_BLOCKED',
      reason: error instanceof CandidateReleaseBlocked ? error.code : 'candidate_release_verification_failed' }));
    process.exitCode = 1;
  }
}
