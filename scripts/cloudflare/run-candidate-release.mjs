import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { buildCandidateReleasePlan, CandidateReleaseBlocked, PRODUCTION_WORKER } from './candidate-release-contract.mjs';
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
  const contract = await (dependencies.resolveContract ?? resolveProductionDeploymentContract)();
  const baseline = await (dependencies.readBaseline ?? readCandidateBaseline)();
  const wranglerVersion = dependencies.wranglerVersion ?? JSON.parse(await readFile('node_modules/wrangler/package.json', 'utf8')).version;
  const plan = buildCandidateReleasePlan({ config, baseline, baselineConfig, runtimeVariables: contract.runtimeVariables, wranglerVersion });
  const semantic = await (dependencies.semanticPreflight ?? runProductionDeploySemanticPreflight)({
    expectedVariables: contract.runtimeVariables, allowedPlannedChanges: [], allowedPlannedCronAdditions: [], log: () => {},
  });
  if (semantic?.status !== 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS') throw new CandidateReleaseBlocked('semantic_preflight_failed');
  if (options.dryRun) {
    const env = { ...process.env, ...contract.readerEnvironment, WRANGLER_SEND_METRICS: 'false' };
    const run = dependencies.runLocal ?? runLocal;
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'cloudflare:build:production'], env);
    run(path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'),
      [...plan.uploadArguments, '--dry-run'], env);
  }
  const result = {
    status: plan.status, stableVersionId: plan.stableVersionId, blockers: plan.blockers,
    plannedTriggerChanges: [], encryptedSecrets: plan.encryptedSecrets,
    semanticPreflight: 'PASS',
    candidateUpload: 0, deploymentMutation: 0, trafficChange: 0,
    localDryRun: options.dryRun ? 'PASS' : 'NOT_RUN',
    liveExecutionAdapters: 'NOT_INSTALLED_PENDING_SUPPORTED_ISOLATION_PATH',
  };
  log(JSON.stringify(result));
  // Plan/read-only and local dry-run only. No upload/stage/promote command can
  // be executed by this CLI while Production isolation is unsupported.
  if (plan.blockers.length) throw new CandidateReleaseBlocked('isolated_candidate_endpoint_unavailable');
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { await main(); }
  catch (error) {
    console.error(JSON.stringify({ status: 'CANDIDATE_FIRST_RELEASE_FLOW_BLOCKED',
      reason: error instanceof CandidateReleaseBlocked ? error.code : 'candidate_release_verification_failed' }));
    process.exitCode = 1;
  }
}
