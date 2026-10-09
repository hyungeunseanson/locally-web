import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { versionProvider, artifactDigest, deploymentId } from './active-version-artifact.fixture.mjs';
import {
  CandidateReleaseBlocked, assertPostUploadInvariance, safeVersionSnapshot, assertConfigUnchanged, assertFullCandidateSmoke, assertOverrideIdentity, buildCandidateReleasePlan,
  classifyCandidateAttempt, executeCandidateReleaseContract, parseVersionUploadOutput, promotionArguments,
  PRODUCTION_ORIGIN, PRODUCTION_WORKER, rollbackArguments, safeConfigSnapshot, stageZeroArguments, versionOverrideHeader,
} from './candidate-release-contract.mjs';
import { compareDurableObjectProof, DO_MODULES, fingerprintDurableObjectArtifact, readStableDurableObjectArtifact } from './durable-object-release-safety.mjs';
import { withReleaseProbeIdentity } from '../../app/utils/cloudflareReleaseProbe.mjs';
import { main, parseCandidateArguments, readCandidateBaseline } from './run-candidate-release.mjs';
import { runCandidateBrowserSmoke, verifyReadOnlyClientInteraction } from './run-candidate-browser-smoke.mjs';
import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';

const lineage = 'a'.repeat(64);
const stableId = '11111111-1111-4111-8111-111111111111';
const candidateId = '22222222-2222-4222-8222-222222222222';
const workerSource = "export { DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';";
const flags = { CLOUDFLARE_DEPLOYMENT_ENV: 'production', OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED: 'true' };
const baselineConfig = { keep_vars: true, compatibility_date: '2026-01-01', compatibility_flags: ['nodejs_compat'], env: { production: { name: PRODUCTION_WORKER, preview_urls: false,
  durable_objects: { bindings: Object.keys(DO_MODULES).map(class_name => ({ name: class_name, class_name })) },
  migrations: [{ tag: 'cache-v1', new_sqlite_classes: Object.keys(DO_MODULES) }] } } };
const config = structuredClone(baselineConfig);
config.env.production.version_metadata = { binding: 'CF_VERSION_METADATA' };
const metadataBinding = { name: 'CF_VERSION_METADATA', type: 'version_metadata' };
const snapshot = {
  runtime: {compatibilityDate:'2026-01-01',compatibilityFlags:['nodejs_compat'],migrationTag:'cache-v1'},
  routes: [{ pattern: 'www.locally-travel.com/*' }], customDomains: [],
  subdomain: { enabled: false, previews_enabled: false }, observability: { enabled: true, head_sampling_rate: 0.1 },
  bindings: [...Object.entries(flags).map(([name, text]) => ({ name, type: 'plain_text', text })),
    { name: 'SUPABASE_SERVICE_ROLE_KEY', type: 'secret_text' }, { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', type: 'secret_text' },
    { name: 'EXAMPLE_QUEUE', type: 'queue', queue_name: 'fixture-queue' },
    { name: 'CACHE_R2', type: 'r2_bucket', bucket_name: 'fixture-cache' },
    { name: 'SELF', type: 'service', service: PRODUCTION_WORKER, environment: 'production' },
    ...Object.keys(DO_MODULES).map(name => ({ name, class_name: name, type: 'durable_object_namespace', namespace_id: `${name}-namespace` }))],
  crons: ['*/10 * * * *'], queueConsumers: [{ queue_name: 'fixture-queue', script: PRODUCTION_WORKER, dead_letter_queue: 'fixture-dlq', settings: { max_retries: 5 } }],
};
const baseline = { snapshot, deployment: { id: deploymentId, versions: [{ id: stableId, percentage: 100 }] } };
const exactStable = { id: stableId, resources: { bindings: structuredClone(snapshot.bindings), script: { etag: 'a'.repeat(64), handlers:['fetch'], named_handlers: [] }, script_runtime: { compatibility_date:'2026-01-01', compatibility_flags:['nodejs_compat'], migration_tag:'cache-v1' } } };
const exactCandidate = { ...structuredClone(exactStable), id:candidateId };
exactCandidate.resources.bindings.push(metadataBinding);
exactCandidate.resources.script.etag='b'.repeat(64);
function scoped(value, candidate = null) { return { ...value, activeDeployment:structuredClone(value.deployment),
  activeStableVersion:structuredClone(exactStable), uploadedCandidateVersion:candidate,
  scriptGlobalSettings:{observability:{enabled:true}},
  triggersAndBindingsOutsideVersionScope:{crons:structuredClone(value.snapshot.crons),queueConsumers:structuredClone(value.snapshot.queueConsumers),routes:structuredClone(value.snapshot.routes),domains:[],migrationTag:'cache-v1'},
}; }

const blocked = code => error => error.code === code;
function artifact(constant = 'fixture-original') {
  return 'var helper = 1;\n' + Object.entries(DO_MODULES).map(([name, p]) => `// ${p}\nvar ${name} = class extends DurableObject { value = "${constant}"; };\n`).join('')
    + '// app/manifest.js\nglobalThis.nextVersion = "16.3.5"; globalThis.openNextVersion = "3.10.4";\n'
    + 'var manifest = { runtimePins: { node: "24.20.0", next: "16.3.5", openNextCloudflare: "1.19.6", wrangler: "4.129.1" } };\n';
}
function makeProof(candidateSource = artifact()) {
  return { stableVersionId: stableId, scriptEtag: 'a'.repeat(64), sourceKind: 'workers-version-modules', deploymentId, artifactSha256: artifactDigest(artifact()),
    namedHandlers: Object.keys(DO_MODULES).map(name => ({ name, handlers: ['class'] })),
    stable: fingerprintDurableObjectArtifact(artifact()), candidate: fingerprintDurableObjectArtifact(candidateSource) };
}
const makePlan = (overrides = {}) => buildCandidateReleasePlan({ config, baselineConfig, baseline, workerSource,
  baselineWorkerSource: workerSource, durableObjectProof: makeProof(), runtimeVariables: flags, wranglerVersion: '4.129.1', bridgeLineage: lineage, doCodeUpdateMode: 'provider-default-no-drain-guarantee', ...overrides });
const safeAttempt = pathname => ({ pathname, pass: true, timeout: false, pendingStaticAssets: 0,
  httpHardErrors: 0, fiveXX: 0, asset404: 0, genericError: false, pageErrors: 0, consoleErrors: 0, unexpectedWrites: 0, versionMismatch: false });
function makeSmoke() {
  return { origin: PRODUCTION_ORIGIN, redirected: false, fullPass: true, checks: { home: true, login: true, experience: true, api401: true },
    ...safeAttempt('/'), assetSetMatches: true, assetRefs: ['/_next/static/app.js', '/_next/static/font.woff2'],
    assetResponses: ['/_next/static/app.js', '/_next/static/font.woff2'].map(pathname => ({ pathname, status: 200, overrideApplied: true, redirected: false })),
    attempts: ['/', '/experiences/42', '/login'].map(safeAttempt),
    probeReceipt: { pathname: '/.well-known/locally-release', status: 204, versionId: candidateId, overrideApplied: true, probeApplied: true },
    overrideCoverage: { document: true, script: true, stylesheet: true, image: true, data: true, font: true, api: true }, allFirstPartyReadsOverridden: true,
    workerReceipts: ['/', '/experiences/42', '/login', '/api/proxy-bookings'].map(pathname => ({ pathname, versionId: candidateId, overrideApplied: true, probeApplied: true })) };
}
function fixtureActions(initialDeployment = baseline.deployment) {
  const calls = []; let deployment = structuredClone(initialDeployment); let bindings = structuredClone(snapshot.bindings);
  const actions = {
    recheckIdentity: async versionId => ({versionId,status:204}), authorizedCandidateUpload: true, authorizePromotion: async () => true,
    bridgeProofFreshness: async () => ({kind:'provider',sourceKind:'workers-version-modules',artifactSha256:artifactDigest(artifact()),deploymentId:baseline.deployment.id,deploymentVersions:structuredClone(initialDeployment.versions),versionId:stableId,etag:'a'.repeat(64),compatSha256:lineage}),
    build: async () => calls.push('build'), semanticPreflight: async () => { calls.push('preflight'); return 'PASS'; },
    durableObjectProof: async () => { calls.push('do-proof'); return makeProof(); },
    snapshot: async (options = {}) => { calls.push('snapshot'); return scoped({ snapshot: { ...structuredClone(snapshot), bindings: structuredClone(bindings) }, deployment: structuredClone(deployment) }, options.candidateVersionId ? structuredClone(exactCandidate) : null); },
    upload: async args => { calls.push('upload'); assert.deepEqual(args.slice(0, 2), ['versions', 'upload']); return `Worker Version ID: ${candidateId}\n`; },
    versionMetadata: async id => { calls.push('metadata'); return { id, runtime: snapshot.runtime, bindings: [...structuredClone(snapshot.bindings), metadataBinding] }; },
    stageZero: async args => { calls.push('stage-zero'); assert(args.includes(`${stableId}@100%`) && args.includes(`${candidateId}@0%`));
      deployment = { id: 'zero-deployment', versions: [{ id: stableId, percentage: 100 }, { id: candidateId, percentage: 0 }] }; },
    smoke: async input => { calls.push('override-smoke'); assert.equal(input.mode, 'override'); assert.equal(input.origin, PRODUCTION_ORIGIN); return makeSmoke(); },
    promote: async args => { calls.push('promote'); assert(args.includes(`${candidateId}@100%`)); assert(calls.includes('override-smoke'));
      deployment = { id: 'promoted-deployment', versions: [{ id: candidateId, percentage: 100 }] }; bindings.push(metadataBinding); },
    postDeployVerification: async () => { calls.push('post-verification'); return { browserSmoke: 'PASS', naturalCronHealth: 'PASS', queueHealth: 'PASS', scheduledFlags: 'UNCHANGED' }; },
  };
  return { actions, calls };
}

test('DO Worker without Version URL and with previews disabled can be READY', () => {
  const plan = makePlan(); assert.equal(plan.status, 'CANDIDATE_OVERRIDE_ONLY_RELEASE_FLOW_READY');
  assert.equal(plan.versionUrlCapability, 'UNAVAILABLE_EXPECTED_FOR_DO_WORKER'); assert.deepEqual(plan.blockers, []);
});
test('only CF_VERSION_METADATA is an intentional local config change', () => {
  const changed = structuredClone(config); changed.env.production.preview_urls = true;
  assert.throws(() => makePlan({ config: changed }), blocked('planned_trigger_or_config_change'));
  const renamed = structuredClone(config); renamed.env.production.version_metadata.binding = 'WRONG';
  assert.throws(() => makePlan({ config: renamed }));
});
test('DO migration additions, deletions, renames, transfers, tags and order block', () => {
  for (const field of ['new_classes', 'deleted_classes', 'renamed_classes', 'transferred_classes', 'tag']) {
    const changed = structuredClone(config); changed.env.production.migrations[0][field] = field === 'tag' ? 'new-tag' : ['Changed'];
    assert.throws(() => makePlan({ config: changed }), blocked('DURABLE_OBJECT_LIFECYCLE_CHANGE_REQUIRES_ATOMIC_DEPLOY'));
  }
  const changed = structuredClone(config); changed.env.production.migrations[0].new_sqlite_classes.reverse();
  assert.throws(() => makePlan({ config: changed }), blocked('DURABLE_OBJECT_LIFECYCLE_CHANGE_REQUIRES_ATOMIC_DEPLOY'));
});
test('DO bindings and exported lifecycle cannot be changed', () => {
  const changed = structuredClone(config); changed.env.production.durable_objects.bindings[0].class_name = 'NewCache';
  assert.throws(() => makePlan({ config: changed }), blocked('DURABLE_OBJECT_LIFECYCLE_CHANGE_REQUIRES_ATOMIC_DEPLOY'));
  assert.throws(() => makePlan({ workerSource: workerSource.replace('DOQueueHandler', 'Other') }), blocked('DURABLE_OBJECT_LIFECYCLE_CHANGE_REQUIRES_ATOMIC_DEPLOY'));
});
test('generated build/auth constants are compared without normalization', () => {
  assert.equal(compareDurableObjectProof(makeProof(), stableId), 'DO_IMPLEMENTATION_UNCHANGED');
  assert.equal(compareDurableObjectProof(makeProof(artifact('different-revalidation-token')), stableId), 'UNKNOWN');
  assert(makePlan({ durableObjectProof: makeProof(artifact('changed')) }).blockers.includes('UNKNOWN'));
});
test('unknown artifact, dependency or provider provenance blocks', () => {
  for (const proof of [undefined, { ...makeProof(), sourceKind: 'script-content' }, { ...makeProof(), candidate: null },
    { ...makeProof(), stableVersionId: candidateId }, { ...makeProof(), namedHandlers: [] }]) {
    assert(makePlan({ durableObjectProof: proof }).blockers.includes('DO_IMPLEMENTATION_UNKNOWN'));
  }
  assert.equal(fingerprintDurableObjectArtifact('no generated DO modules'), null);
});
test('stable artifact GET is tied to the exact provider version ETag', async () => {
  const p = versionProvider(artifact());
  const result = await readStableDurableObjectArtifact({ credentials: { accountId: 'fixture', apiToken: 'fixture-not-secret' }, workerName: PRODUCTION_WORKER, stableVersionId: stableId, fetchImplementation: p.fetch });
  assert.equal(result.stable.modules.DOQueueHandler.sha256, makeProof().stable.modules.DOQueueHandler.sha256);
  assert.equal(result.artifactSha256, artifactDigest(artifact()));
  assert(!p.calls.some(url => url.endsWith('/content/v2')));
});

test('upload without Version URL is accepted; ambiguous UUID is rejected', () => {
  assert.deepEqual(parseVersionUploadOutput(`Worker Version ID: ${candidateId}`), { versionId: candidateId, versionUrl: null });
  for (const value of ['', `Worker Version ID: ${candidateId}\nWorker Version ID: ${stableId}`]) assert.throws(() => parseVersionUploadOutput(value));
});
test('exact stable100/candidate0 staging contract', () => {
  assert.deepEqual(stageZeroArguments(makePlan(), candidateId), ['versions', 'deploy', `${stableId}@100%`, `${candidateId}@0%`, '--config', './wrangler.jsonc', '--env', 'production', '--yes']);
});
test('promotion follows all gates and upload does not change the active deployment', async () => {
  const { actions, calls } = fixtureActions(); const result = await executeCandidateReleaseContract(makePlan(), actions);
  assert.equal(result.status, 'CANDIDATE_OVERRIDE_ONLY_RELEASE_CONTRACT_PASS');
  assert.deepEqual(calls.filter(c => c !== 'snapshot'), ['build', 'preflight', 'do-proof', 'upload', 'metadata', 'stage-zero', 'override-smoke', 'promote', 'post-verification']);
  assert.equal(calls.filter(c => c === 'upload').length, 1); assert.deepEqual(result.rollbackArguments, rollbackArguments(makePlan()));
});
test('fresh DO proof is required before upload even after a READY plan', async () => {
  for (const proof of [makeProof(artifact('changed')), null]) {
    const { actions, calls } = fixtureActions(); actions.durableObjectProof = async () => proof;
    await assert.rejects(executeCandidateReleaseContract(makePlan(), actions)); assert(!calls.includes('upload'));
  }
});
test('changed deployment ID after upload blocks before staging', async () => {
  const { actions, calls } = fixtureActions(); const read = actions.snapshot;
  actions.snapshot = async options => { const r = await read(options); if (calls.includes('upload')) r.deployment.id = r.activeDeployment.id = 'concurrent'; return r; };
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('upload_changed_active_deployment')); assert(!calls.includes('stage-zero'));
});
test('epsilon, unknown percentage, missing candidate and third version all reject', async () => {
  for (const mutate of [d => { d.versions[0].percentage = 99.99; d.versions[1].percentage = 0.01; },
    d => { delete d.versions[1].percentage; }, d => { d.versions.pop(); }, d => { d.versions.push({ id: '33333333-3333-4333-8333-333333333333', percentage: 0 }); }]) {
    const { actions, calls } = fixtureActions(); const read = actions.snapshot;
    actions.snapshot = async options => { const r = await read(options); if (calls.includes('stage-zero')) mutate(r.deployment); return r; };
    await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('unexpected_deployment_distribution')); assert(!calls.includes('promote'));
  }
});
test('ignored override or absent metadata fails identity without sampled logs', () => {
  for (const versionId of [stableId, null]) { const smoke = makeSmoke(); smoke.probeReceipt.versionId = versionId;
    assert.throws(() => assertOverrideIdentity({ versionId: candidateId, smoke }), blocked('candidate_identity_unverified')); }
  assertOverrideIdentity({ versionId: candidateId, smoke: makeSmoke() });
});
test('every Worker path and first-party read requires exact identity/override/probe', () => {
  for (const key of ['overrideApplied', 'probeApplied']) { const smoke = makeSmoke(); smoke.probeReceipt[key] = false; assert.throws(() => assertOverrideIdentity({ versionId: candidateId, smoke })); }
  const missing = makeSmoke(); missing.workerReceipts.pop(); assert.throws(() => assertOverrideIdentity({ versionId: candidateId, smoke: missing }));
  const incomplete = makeSmoke(); incomplete.allFirstPartyReadsOverridden = false; assert.throws(() => assertOverrideIdentity({ versionId: candidateId, smoke: incomplete }));
});
test('ordinary responses have no new header and retain the same response object', () => {
  const response = new Response('unchanged', { headers: { 'content-type': 'text/plain' } });
  assert.equal(withReleaseProbeIdentity(new Request(PRODUCTION_ORIGIN), response, { id: candidateId }), response);
  assert.equal(response.headers.has('X-Locally-Worker-Version'), false);
});
test('exact GET/HEAD dedicated probe returns bodyless uncached identity', async () => {
  for (const method of ['GET', 'HEAD']) {
    const response = new Response('fixture-body', { status: 401, headers: { 'content-type': 'text/plain', 'x-existing': 'same' } });
    const probe = withReleaseProbeIdentity(new Request(PRODUCTION_ORIGIN + '/.well-known/locally-release', { method, headers: { 'X-Locally-Release-Probe': '1' } }), response, { id: candidateId });
    assert.equal(probe.headers.get('X-Locally-Worker-Version'), candidateId); assert.equal(probe.status, 204);
    assert.equal(probe.headers.get('cache-control'), 'private, no-store'); assert.equal(probe.headers.has('set-cookie'), false); assert.equal(await probe.text(), '');
  }
});
test('writes, nonexact probe and missing metadata cannot add a version header', () => {
  for (const [method, value, metadata] of [['POST', '1', { id: candidateId }], ['GET', 'true', { id: candidateId }], ['GET', '1', undefined]]) {
    const response = new Response(); assert.equal(withReleaseProbeIdentity(new Request(PRODUCTION_ORIGIN, { method, headers: { 'X-Locally-Release-Probe': value } }), response, metadata), response);
  }
});
test('static assets need override/200/no redirect and matching candidate HTML set, not metadata headers', () => {
  assertFullCandidateSmoke(makeSmoke());
  for (const mutate of [s => { s.assetResponses[0].status = 404; }, s => { s.assetResponses[0].redirected = true; },
    s => { s.assetResponses[0].overrideApplied = false; }, s => { s.assetSetMatches = false; }]) { const s = makeSmoke(); mutate(s); assert.throws(() => assertFullCandidateSmoke(s)); }
});
test('promotion arguments cannot be formed before every gate passes', () => {
  const evidence = { semanticPreflight: 'PASS', uploadDeploymentUnchanged: true, exactZeroStagingVerified: true,
    promotionAuthorized: true, bridgeLineage: lineage, overrideIdentityVerified: true, doImplementation: 'DO_IMPLEMENTATION_UNCHANGED', overrideSmoke: makeSmoke() };
  assert(promotionArguments(makePlan(), candidateId, evidence).includes(`${candidateId}@100%`));
  for (const key of ['semanticPreflight', 'uploadDeploymentUnchanged', 'exactZeroStagingVerified', 'overrideIdentityVerified', 'doImplementation']) assert.throws(() => promotionArguments(makePlan(), candidateId, { ...evidence, [key]: null }));
  const smoke = makeSmoke(); smoke.workerReceipts = []; assert.throws(() => promotionArguments(makePlan(), candidateId, { ...evidence, overrideSmoke: smoke }));
});
test('at most two attempts; only static transport timeouts can precede a full pass', () => {
  const retry = { ...safeAttempt('/login'), pass: false, timeout: true, pendingStaticAssets: 1 };
  assert.equal(classifyCandidateAttempt(retry), 'TRANSPORT_ONLY_TIMEOUT');
  const smoke = makeSmoke(); smoke.attempts.splice(2, 0, retry); assertFullCandidateSmoke(smoke);
  smoke.attempts.splice(2, 0, retry); assert.throws(() => assertFullCandidateSmoke(smoke), blocked('more_than_two_smoke_attempts'));
  for (const change of [{ pageErrors: 1 }, { fiveXX: 1 }, { unexpectedWrites: 1 }, { pendingStaticAssets: 0 }]) assert.equal(classifyCandidateAttempt({ ...retry, ...change }), 'APPLICATION_FAILURE');
});
test('only version metadata may differ in provider readback; secrets and all triggers remain fixed', () => {
  assertConfigUnchanged(snapshot, { ...snapshot, bindings: [...snapshot.bindings, metadataBinding] }, { metadata: 'required' });
  for (const change of [{ crons: [] }, { queueConsumers: [] }, { routes: [] }]) assert.throws(() => assertConfigUnchanged(snapshot, { ...snapshot, ...change }));
  const changed = structuredClone(snapshot); changed.bindings[0].text = 'changed'; assert.throws(() => assertConfigUnchanged(snapshot, changed, { metadata: 'optional' }));
  const lost = { ...snapshot, bindings: [...snapshot.bindings.slice(1), metadataBinding] }; assert.throws(() => assertConfigUnchanged(snapshot, lost, { metadata: 'required' }));
});
test('secret values and unmanaged var values cannot enter logs or plans', () => {
  const raw = structuredClone(snapshot); raw.bindings.find(b => b.name === 'SUPABASE_SERVICE_ROLE_KEY').text = 'fixture-sensitive-value';
  assert(!JSON.stringify(safeConfigSnapshot(raw)).includes('fixture-sensitive-value'));
  assert(!JSON.stringify(makePlan({ baseline: { ...baseline, snapshot: raw } })).includes('fixture-sensitive-value'));
  assert.throws(() => makePlan({ runtimeVariables: { SUPABASE_SERVICE_ROLE_KEY: 'fixture-sensitive-value' } }), blocked('credential_or_unmanaged_var_override'));
});
test('lost encrypted binding on uploaded candidate prevents staging', async () => {
  const { actions, calls } = fixtureActions(); actions.versionMetadata = async id => ({ id, bindings: [...snapshot.bindings.filter(b => b.name !== 'SUPABASE_SERVICE_ROLE_KEY'), metadataBinding] });
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('candidate_binding_or_secret_drift')); assert(!calls.includes('stage-zero'));
});
test('CLI installs no live adapters and only executes local dry-run commands', async () => {
  for (const args of [['--execute'], ['--force'], ['--plan', '--dry-run']]) assert.throws(() => parseCandidateArguments(args));
  const calls = []; const logs = []; const proof = makeProof();
  const deps = { bridgeFreshness: async () => {}, config, baselineConfig, workerSource, baselineWorkerSource: workerSource, durableObjectProof: proof,
    readBaseline: async () => baseline, resolveContract: async () => ({ runtimeVariables: flags, readerEnvironment: {} }), wranglerVersion: '4.129.1',
    semanticPreflight: async () => ({ status: 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS' }), readStableArtifact: async () => proof,
    readCandidateArtifact: async () => artifact(), runLocal: (_cmd, args) => calls.push(args), log: s => logs.push(s) };
  const plan = await main(['--plan'], deps); assert.equal(plan.candidateUpload, 0); assert.deepEqual(calls, []);
  const dry = await main(['--dry-run'], deps); assert.equal(dry.localDryRun, 'PASS'); assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['run', 'cloudflare:build:production']); assert.equal(calls[1].at(-1), '--dry-run'); assert(calls[1].includes('--outdir'));
  await assert.rejects(main(['--plan'], { ...deps, durableObjectProof: undefined }), blocked('DO_IMPLEMENTATION_UNKNOWN'));
  assert(logs.every(s => !s.includes('fixture-sensitive-value')));
});
test('failed post-promotion regression does not automatically repeat promotion or rollback', async () => {
  const { actions, calls } = fixtureActions(); actions.postDeployVerification = async () => ({ browserSmoke: 'FAIL' });
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('post_deploy_verification_failed')); assert.equal(calls.filter(c => c === 'promote').length, 1);
});

test('Stable and candidate Home / 4659 hydration, anonymous cookie/auth stripping and exact asset integrity', { timeout: 25000 }, async () => {
  const received = []; const font = await readFile(new URL('../../app/fonts/Inter/Inter_18pt-Regular.woff2', import.meta.url));
  const javascript = `document.cookie='harmless=COOKIE_SENTINEL_NEVER_LOG;path=/';
    fetch('/data');fetch('/authorized-read',{credentials:'omit',headers:{Authorization:'AUTH_SENTINEL_NEVER_LOG'}});fetch('/cdn-cgi/rum',{method:'POST'}).catch(()=>{});
    document.addEventListener('DOMContentLoaded',()=>{const b=document.querySelector('#globe');b.onclick=()=>{const m=document.querySelector('#language-menu');if(m)m.remove();else{const m=document.createElement('button');m.id='language-menu';m.textContent='English';document.body.append(m);}};
      const readMore=document.querySelector('[data-testid="experience-summary-read-more-desktop"]');if(readMore)readMore.onclick=()=>readMore.remove();
      const close=document.querySelector('[data-testid="legacy-experience-popup-close"]');if(close){b.setAttribute('inert','');close.onclick=()=>{document.querySelector('[data-testid="legacy-experience-popup-overlay"]').remove();b.removeAttribute('inert');localStorage.setItem('fixture-notice-dismissed','1');};}});`;
  const files = new Map([['/_next/static/app.js',Buffer.from(javascript)],['/_next/static/font.woff2',font],
    ['/_next/static/style.css',Buffer.from('body{color:black}')],['/_next/static/unused.bin',Buffer.from('unused-hint-fixture')],
    ['/_next/static/slow.bin',Buffer.from('pending-static-fixture')]]);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    received.push({ pathname, method: request.method, cookiePresent: Object.hasOwn(request.headers,'cookie'), authorizationPresent:Object.hasOwn(request.headers,'authorization'), override: request.headers['cloudflare-workers-version-overrides'], probe: request.headers['x-locally-release-probe'] });
    if (pathname === '/.well-known/locally-release') { response.writeHead(204, { 'X-Locally-Worker-Version': candidateId }).end(); return; }
    if (pathname === '/api/proxy-bookings') { response.writeHead(401, {'content-type':'application/json'}).end('{"error":"Unauthorized synthetic fixture"}'); return; }
    if (pathname === '/data' || pathname === '/authorized-read') { response.writeHead(200, { 'content-type': 'application/json' }).end('{}'); return; }
    if (files.has(pathname)) {
      if(pathname.endsWith('app.js')){response.writeHead(200,{'content-type':'text/javascript','content-encoding':'gzip'}).end(gzipSync(files.get(pathname)));return;}
      response.writeHead(200, { 'content-type': pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.woff2')?'font/woff2':'application/octet-stream' });
      if(pathname.endsWith('slow.bin')){response.flushHeaders();setTimeout(()=>response.end(files.get(pathname)),2200);}else response.end(files.get(pathname));return;
    }
    if (pathname === '/image.svg') { response.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'); return; }
    response.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><title>Fixture</title>
      <link rel="preload" href="/_next/static/font.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/_next/static/style.css">
      <link rel="preload" href="/_next/static/unused.bin" as="unsupported-fixture-type"><link rel="preload" href="/_next/static/slow.bin" as="fetch" crossorigin>
      <style>@font-face{font-family:fixture;src:url('/_next/static/font.woff2')}body{font-family:fixture}</style>
      <script src="/_next/static/app.js"></script><body><h1>Fixture</h1><button id="globe"><svg class="lucide-globe" width="18" height="18"></svg></button><img src="/image.svg"><a href="/experiences/4659">Experience</a>
      ${pathname === '/' ? '<div data-testid="legacy-experience-popup-overlay" style="position:fixed;inset:0;z-index:170;background:white"><button data-testid="legacy-experience-popup-close">Close notice</button></div>' : ''}
      ${pathname === '/experiences/4659' ? '<p data-testid="experience-summary-description-desktop">Existing description</p><button data-testid="experience-summary-read-more-desktop">Read more</button>' : ''}
      ${pathname === '/login' ? '<div data-testid="login-modal"><input type="email"><input type="password"></div>' : ''}</body>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const smoke = await runCandidateBrowserSmoke({ origin, mode: 'override', workerName: PRODUCTION_WORKER, versionId: candidateId }, { readAsset: async pathname => files.get(pathname) });
    assertFullCandidateSmoke(smoke); assertOverrideIdentity({ versionId: candidateId, smoke, expectedOrigin: origin });
    assert(Object.values(smoke.overrideCoverage).every(Boolean));
    assert.deepEqual(smoke.clientInteractions.map(r=>r.pathname),['/','/experiences/4659']);
    assert.equal(smoke.clientInteractions[0].noticeDismissed,true);
    assert.deepEqual(smoke.clientInteractions[1],{pathname:'/experiences/4659',interaction:'experience-description-read-more',clicked:true,expanded:true,descriptionVisible:true});
    assert(smoke.anonymousReadHeaders.cookieHeadersStripped>0);
    assert(smoke.anonymousReadHeaders.authorizationHeadersStripped>0);
    assert.equal(smoke.allFirstPartyReadsAnonymous,true);
    assert(received.every(r=>!r.cookiePresent&&!r.authorizationPresent),JSON.stringify(received.filter(r=>r.cookiePresent||r.authorizationPresent)));
    assert(!JSON.stringify({smoke,received}).includes('SENTINEL_NEVER_LOG'));
    assert(smoke.assetEvidence.some(r=>r.browserPending.some(p=>p.pathname==='/_next/static/slow.bin')));
    assert(smoke.assetResponses.every(r=>r.hashMatch&&r.bodyComplete&&r.source==='direct-candidate-get'));
    assert(smoke.resourceHintProofs.some(r=>r.pathname==='/_next/static/unused.bin'));
    assert(!smoke.browserAssetResponses.some(r=>r.pathname==='/_next/static/unused.bin'));
    assert.equal(smoke.requestFailures.length,0);
    for (const path of ['/', '/login', '/experiences/4659', '/_next/static/app.js', '/_next/static/font.woff2', '/_next/static/style.css', '/image.svg', '/data', '/api/proxy-bookings']) {
      assert(received.some(r => r.pathname === path), path); assert(received.filter(r => r.pathname === path).every(r => r.override === versionOverrideHeader(PRODUCTION_WORKER, candidateId) && r.probe === undefined), path);
    }
    assert(received.every(r => r.method === 'GET'), 'mutation gate must not forward telemetry POST');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('ordinary stable Home and 4659 use the same client interactions without an Experience globe handler or writes', async () => {
  const server = createServer((request,response) => {
    if(request.url==='/api/proxy-bookings'){response.writeHead(401, {'content-type':'application/json'}).end('{"error":"Unauthorized synthetic fixture"}');return;}
    response.writeHead(200,{'content-type':'text/html'}).end(`<!doctype html><title>Fixture</title><body><h1>Fixture</h1><a href="/experiences/4659">Experience</a>
      ${request.url==='/'?'<button id="globe"><svg class="lucide-globe" width="18" height="18"></svg></button><script>document.querySelector("#globe").onclick=()=>{const m=document.querySelector("#menu");if(m)m.remove();else{const m=document.createElement("button");m.id="menu";m.textContent="English";document.body.append(m);}};</script>':''}
      ${request.url==='/experiences/4659'?'<p data-testid="experience-summary-description-desktop">Fixture description</p><button data-testid="experience-summary-read-more-desktop">Read more</button><script>document.querySelector("[data-testid=experience-summary-read-more-desktop]").onclick=event=>event.target.remove();</script>':''}
      ${request.url==='/login'?'<div data-testid="login-modal"><input type="email"></div>':''}</body>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const interactions=[];
  try {
    const stable=await runProductionBrowserSmoke(`http://127.0.0.1:${server.address().port}`,{log:()=>{},collectReadOnlyPageEvidence:async page=>{
      const pathname=new URL(page.url()).pathname;
      if(pathname==='/'||pathname==='/experiences/4659')interactions.push(await verifyReadOnlyClientInteraction(page));
    }});
    assert.equal(stable.status,'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS');
    assert.deepEqual(interactions.map(r=>r.interaction),['locale-menu-open-close','experience-description-read-more']);
    assert.equal(stable.blockedUnexpectedWrites.length+stable.blockedUnexpectedExternalWrites.length,0);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Experience read-more requires visible button, real handler execution and a remaining description; never substitutes globe', async () => {
  for (const failure of ['missing-button', 'handler-not-ready', 'button-remains', 'description-disappears']) {
    let clicks = 0;
    const page = {
      url: () => PRODUCTION_ORIGIN + '/experiences/4659',
      getByTestId: name => {
        assert(['experience-summary-read-more-desktop','experience-summary-description-desktop'].includes(name));
        return { waitFor: async ({state}) => {
          if ((failure==='missing-button' && name.endsWith('read-more-desktop'))
            || (failure==='button-remains' && state==='hidden')
            || (failure==='description-disappears' && clicks && name.endsWith('description-desktop'))) throw Error('fixture readiness failure');
        }, click: async () => { clicks++; } };
      },
      waitForFunction: async () => { if(failure==='handler-not-ready') throw Error('fixture SSR-only'); },
    };
    await assert.rejects(verifyReadOnlyClientInteraction(page),blocked('candidate_client_interaction_failed'));
  }
});

function compatibleProof() {
  const p = makeProof(); p.candidate.modules.DOQueueHandler = {sha256:'b'.repeat(64),bytes:100};
  p.bridgeCompatibility = { classification:'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY',compatSha256:lineage,nextAuthenticationUnchanged:true,workerClientsUnchanged:true,
    modules:Object.fromEntries(Object.keys(DO_MODULES).map(k=>[k,{stableSha256:p.stable.modules[k].sha256,candidateSha256:p.candidate.modules[k].sha256,structuralContractIdentical:true,classification:k==='DOQueueHandler'?'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY':'DO_IMPLEMENTATION_UNCHANGED'}])),
    differences:Array.from({length:4},()=>({class:'DOQueueHandler',classification:'BUILD_ID_ONLY'})),
    runtime:{fourWay:'PASS',generation01:'PASS',generation12:'PASS',rollback:'PASS',buildState:'BUILD_STATE_RESET_EXPECTED'}};
  return p;
}
test('proven bridge-compatible build state permits a plan, explicit installed mode required',()=>{
  const p=compatibleProof();assert.equal(makePlan({durableObjectProof:p}).doImplementation,'BRIDGE_COMPATIBLE_BUILD_STATE_ONLY');
  for(const mode of [undefined,'deferred 30s','immediate'])assert.throws(()=>makePlan({durableObjectProof:p,doCodeUpdateMode:mode}));
  for(const mutate of [p=>p.bridgeCompatibility.runtime.fourWay='FAIL',p=>p.bridgeCompatibility.compatSha256='b'.repeat(64),p=>p.bridgeCompatibility.modules.DOQueueHandler.candidateSha256='c'.repeat(64)]){
    const changed=compatibleProof();mutate(changed);assert.throws(()=>stageZeroArguments(makePlan({durableObjectProof:changed}),candidateId));
  }
});
test('unknown/runtime changes cannot generate staging or promotion args',()=>{
  for(const proof of [null,makeProof(artifact('unexplained'))]){
    const plan=makePlan({durableObjectProof:proof});assert.throws(()=>stageZeroArguments(plan,candidateId));assert.throws(()=>promotionArguments(plan,candidateId,{}));assert.throws(()=>rollbackArguments(plan));
  }
});
test('fresh bridge provider lineage must match immediately before upload; fixture/changed baseline blocks',async()=>{
  for(const patch of [{kind:'fixture'},{sourceKind:'script-content'},{deploymentId:'changed'},{versionId:candidateId},{etag:''},{compatSha256:'b'.repeat(64)}]){
    const {actions,calls}=fixtureActions();const read=actions.bridgeProofFreshness;actions.bridgeProofFreshness=async()=>({...await read(),...patch});
    await assert.rejects(executeCandidateReleaseContract(makePlan(),actions),blocked('bridge_provenance_or_freshness_failed'));assert(!calls.includes('upload'));
  }
  const {actions,calls}=fixtureActions();const read=actions.bridgeProofFreshness;actions.bridgeProofFreshness=async()=>{calls.push('freshness');return read();};
  await executeCandidateReleaseContract(makePlan(),actions);assert.equal(calls[calls.indexOf('upload')-1],'freshness');
});
test('explicit upload/promotion approvals and final identity are mandatory',async()=>{
  for(const setup of [a=>a.authorizedCandidateUpload=false,a=>a.authorizePromotion=async()=>false,a=>a.recheckIdentity=async()=>({versionId:stableId,status:204})]){
    const {actions,calls}=fixtureActions();setup(actions);await assert.rejects(executeCandidateReleaseContract(makePlan(),actions));assert(!calls.includes('promote'));
  }
});
test('final config/deployment race and candidate runtime drift cannot promote',async()=>{
  for(const kind of ['runtime','deployment','binding']){
    const {actions,calls}=fixtureActions(),read=actions.snapshot;
    actions.snapshot=async()=>{const r=await read();if(calls.includes('override-smoke')){if(kind==='runtime')r.snapshot.runtime.compatibilityDate='different';if(kind==='deployment')r.deployment.id='different';if(kind==='binding')r.snapshot.bindings.pop();}return r;};
    await assert.rejects(executeCandidateReleaseContract(makePlan(),actions));assert(!calls.includes('promote'));
  }
  const {actions,calls}=fixtureActions();actions.versionMetadata=async id=>({id,bindings:[...snapshot.bindings,metadataBinding],runtime:{}});
  await assert.rejects(executeCandidateReleaseContract(makePlan(),actions),blocked('candidate_runtime_drift'));assert(!calls.includes('stage-zero'));
});
test('identity is exclusive to the exact unauthenticated endpoint; no metadata on user pages',()=>{
  for(const [path,headers] of [['/',{}],['/.well-known/locally-release?x=1',{}],['/.well-known/locally-release',{cookie:'fixture'}],['/.well-known/locally-release',{authorization:'fixture'}]]){
    const response=new Response('ordinary');assert.equal(withReleaseProbeIdentity(new Request(PRODUCTION_ORIGIN+path,{headers:{'X-Locally-Release-Probe':'1',...headers}}),response,{id:candidateId}),response);
  }
});
test('fresh DO artifact ETag must equal the final bridge provider proof',async()=>{
  const {actions,calls}=fixtureActions(),read=actions.bridgeProofFreshness;
  actions.bridgeProofFreshness=async()=>({...await read(),etag:'c'.repeat(64)});
  await assert.rejects(executeCandidateReleaseContract(makePlan(),actions),blocked('bridge_provenance_or_freshness_failed'));assert(!calls.includes('upload'));
});
test('compatible plan cannot lose its explicit mode acknowledgement before mutation arguments',()=>{
  const plan=makePlan({durableObjectProof:compatibleProof()});delete plan.doCodeUpdateMode;
  assert.throws(()=>stageZeroArguments(plan,candidateId));assert.throws(()=>promotionArguments(plan,candidateId,{}));
});

test('version-scoped proof cannot be reused for another deployment or without artifact identity', () => {
  for (const patch of [{deploymentId:candidateId},{artifactSha256:''},{sourceKind:'script-content'}]) {
    assert(makePlan({durableObjectProof:{...makeProof(),...patch}}).blockers.includes('DO_IMPLEMENTATION_UNKNOWN'));
  }
});
test('final bridge and DO proofs must attest identical version source bytes', async () => {
  const {actions,calls}=fixtureActions();
  const original=actions.bridgeProofFreshness;
  actions.bridgeProofFreshness=async()=>({...await original(),artifactSha256:'b'.repeat(64)});
  await assert.rejects(executeCandidateReleaseContract(makePlan(),actions),blocked('bridge_provenance_or_freshness_failed'));
  assert(!calls.includes('upload'));
});

test('real incident: latest /settings gains metadata, exact stable and globals stay unchanged', () => {
  const before=scoped(baseline);const after=scoped(baseline,structuredClone(exactCandidate));
  before.diagnosticLegacyBindings=structuredClone(snapshot.bindings);
  after.diagnosticLegacyBindings=[...structuredClone(snapshot.bindings),metadataBinding];
  assert.equal(assertPostUploadInvariance(before,after),'POST_UPLOAD_INVARIANCE_PASS');
});

const providerAssetDefaults = { html_handling: 'auto-trailing-slash', not_found_handling: 'none' };
const providerAssets = { ...providerAssetDefaults, serve_directly: true, raw_run_worker_first: false, base_path: '/' };
function assetSnapshots(stableAssets, candidateAssets) {
  const before = scoped(baseline);
  before.activeStableVersion.resources.script_runtime.assets = structuredClone(stableAssets);
  const after = structuredClone(before);
  after.uploadedCandidateVersion = structuredClone(exactCandidate);
  after.uploadedCandidateVersion.resources.script_runtime.assets = structuredClone(candidateAssets);
  return { before, after };
}
for (const field of [...Object.keys(providerAssetDefaults), 'both']) {
  for (const reverse of [false, true]) test(`asset defaults: ${field}, ${reverse ? 'omitted to explicit' : 'explicit to omitted'} are equivalent`, () => {
    const omitted = { ...providerAssets };
    for (const key of field === 'both' ? Object.keys(providerAssetDefaults) : [field]) delete omitted[key];
    const { before, after } = assetSnapshots(...(reverse ? [omitted, providerAssets] : [providerAssets, omitted]));
    const originals = structuredClone({ before, after });
    assert.equal(assertPostUploadInvariance(before, after), 'POST_UPLOAD_INVARIANCE_PASS');
    assert.deepEqual({ before, after }, originals, 'raw provider evidence must remain unchanged');
  });
}
for (const [field, value] of [
  ['html_handling', 'force-trailing-slash'], ['html_handling', 'drop-trailing-slash'],
  ['not_found_handling', '404-page'], ['not_found_handling', 'single-page-application'],
]) for (const reverse of [false, true]) test(`non-default ${field}=${value} vs omitted blocks in ${reverse ? 'reverse' : 'forward'} comparison`, () => {
  const omitted = { ...providerAssets }; delete omitted[field];
  const explicit = { ...providerAssets, [field]: value };
  const { before, after } = assetSnapshots(...(reverse ? [omitted, explicit] : [explicit, omitted]));
  assert.throws(() => assertPostUploadInvariance(before, after), blocked('candidate_runtime_drift'));
});
for (const [label, mutate, code] of [
  ['compatibility date', r => r.script_runtime.compatibility_date = '2030-01-01', 'candidate_runtime_drift'],
  ['compatibility flag', r => r.script_runtime.compatibility_flags.push('changed'), 'candidate_runtime_drift'],
  ['binding', r => r.bindings.shift(), 'candidate_binding_or_secret_drift'],
  ['handler export', r => r.script.handlers.push('scheduled'), 'candidate_export_drift'],
  ['named export', r => r.script.named_handlers.push({ name: 'Other', handlers: ['class'] }), 'candidate_export_drift'],
  ['asset serve_directly', r => r.script_runtime.assets.serve_directly = false, 'candidate_runtime_drift'],
  ['asset raw_run_worker_first', r => r.script_runtime.assets.raw_run_worker_first = true, 'candidate_runtime_drift'],
  ['asset base_path', r => r.script_runtime.assets.base_path = '/other', 'candidate_runtime_drift'],
  ['missing other asset field', r => delete r.script_runtime.assets.serve_directly, 'candidate_runtime_drift'],
  ['unknown asset field', r => r.script_runtime.assets.future_setting = true, 'candidate_runtime_drift'],
  ['missing assets', r => delete r.script_runtime.assets, 'candidate_runtime_drift'],
  ['null assets', r => r.script_runtime.assets = null, 'candidate_runtime_drift'],
  ['array assets', r => r.script_runtime.assets = [], 'candidate_runtime_drift'],
  ['null html_handling', r => r.script_runtime.assets.html_handling = null, 'candidate_runtime_drift'],
  ['undefined not_found_handling', r => r.script_runtime.assets.not_found_handling = undefined, 'candidate_runtime_drift'],
  ['default outside assets', r => r.script_runtime.html_handling = 'auto-trailing-slash', 'candidate_runtime_drift'],
]) test(`default equivalence cannot mask ${label} drift`, () => {
  const omitted = { ...providerAssets }; delete omitted.html_handling; delete omitted.not_found_handling;
  const { before, after } = assetSnapshots(providerAssets, omitted);
  mutate(after.uploadedCandidateVersion.resources);
  assert.throws(() => assertPostUploadInvariance(before, after), blocked(code));
});
for (const [label,change] of Object.entries({
  deployment: s=>s.activeDeployment.id='changed',
  percentage: s=>s.activeDeployment.versions[0].percentage=99,
  stableUUID: s=>s.activeDeployment.versions[0].id=candidateId,
  stableResources: s=>s.activeStableVersion.resources.script.etag='c'.repeat(64),
  stableBinding: s=>s.activeStableVersion.resources.bindings.pop(),
  lostSecret: s=>s.uploadedCandidateVersion.resources.bindings.splice(2,1),
  extraBinding: s=>s.uploadedCandidateVersion.resources.bindings.push({name:'unexpected',type:'secret_text'}),
  runtime: s=>s.uploadedCandidateVersion.resources.script_runtime.usage_model='changed',
  date: s=>s.uploadedCandidateVersion.resources.script_runtime.compatibility_date='2030-01-01',
  flags: s=>s.uploadedCandidateVersion.resources.script_runtime.compatibility_flags.push('changed'),
  doTarget: s=>s.uploadedCandidateVersion.resources.bindings.find(b=>b.type==='durable_object_namespace').namespace_id='changed',
  r2Target: s=>s.uploadedCandidateVersion.resources.bindings.find(b=>b.type==='r2_bucket').bucket_name='changed',
  serviceTarget: s=>s.uploadedCandidateVersion.resources.bindings.find(b=>b.type==='service').service='changed',
  queueProducer: s=>s.uploadedCandidateVersion.resources.bindings.find(b=>b.type==='queue').queue_name='changed',
  queue: s=>s.triggersAndBindingsOutsideVersionScope.queueConsumers=[],
  cron: s=>s.triggersAndBindingsOutsideVersionScope.crons=[],
  route: s=>s.triggersAndBindingsOutsideVersionScope.routes=[],
  domain: s=>s.triggersAndBindingsOutsideVersionScope.domains=['changed'],
  global: s=>s.scriptGlobalSettings.logpush=true,
  migration: s=>s.triggersAndBindingsOutsideVersionScope.migrationTag='changed',
})) test(`post-upload scoped invariant rejects ${label}`,()=>{
  const after=scoped(baseline,structuredClone(exactCandidate));change(after);
  assert.throws(()=>assertPostUploadInvariance(scoped(baseline),after));
});
test('exact version serialization hashes unmanaged plain values and never serializes secret values',()=>{
  const v=structuredClone(exactStable);v.resources.bindings=[{name:'PRIVATE',type:'plain_text',text:'fixture-private-value'},{name:'SECRET',type:'secret_text',text:'fixture-secret-value'}];
  const safe=safeVersionSnapshot(v);assert(!JSON.stringify(safe).includes('fixture-'));assert.equal(safe.resources.bindings[0].valueSha256.length,64);
});

test('GET reader anchors before/after upload to exact stable resources, not legacy settings',async()=>{
  let uploaded=false;const calls=[];
  const fetchImplementation=async(url,options)=>{
    calls.push(url);assert.equal(options.method,'GET');let result;
    const runtime=exactStable.resources.script_runtime;
    if(url.endsWith('/deployments')) result={deployments:[{id:'deployment',created_on:'2026-01-01',versions:[{version_id:stableId,percentage:100}]}]};
    else if(url.endsWith(`/versions/${stableId}`))result=exactStable;
    else if(url.endsWith(`/versions/${candidateId}`))result=exactCandidate;
    else if(url.endsWith('/script-settings'))result={observability:{enabled:true},logpush:false};
    else if(url.endsWith('/settings'))result={bindings:uploaded?exactCandidate.resources.bindings:exactStable.resources.bindings,...runtime,observability:{enabled:false}};
    else if(url.endsWith('/workers/scripts'))result=[{id:PRODUCTION_WORKER,migration_tag:'cache-v1'}];
    else if(url.endsWith('/schedules'))result={schedules:[{cron:'*/10 * * * *'}]};
    else if(url.includes('/routes?'))result=snapshot.routes;
    else if(url.endsWith('/subdomain'))result=snapshot.subdomain;
    else result=[];
    return Response.json({success:true,result});
  };
  const options={credentials:{accountId:'fixture',apiToken:'fixture'},fetchImplementation};
  const before=await readCandidateBaseline(options);uploaded=true;
  const after=await readCandidateBaseline({...options,candidateVersionId:candidateId});
  assert.equal(after.diagnosticLegacyBindings.some(b=>b.name==='CF_VERSION_METADATA'),true);
  assert.equal(after.activeStableVersion.resources.bindings.some(b=>b.name==='CF_VERSION_METADATA'),false);
  assert.equal(assertPostUploadInvariance(before,after),'POST_UPLOAD_INVARIANCE_PASS');
  assert(calls.some(url=>url.endsWith('/script-settings')));

});

// Header observation and direct integrity are separate from browser body timing.
async function captureOrderingFixture(options = {}) {
  const { EventEmitter } = await import('node:events');
  const context = new EventEmitter(), completed = [], probes = [];
  const override = versionOverrideHeader(PRODUCTION_WORKER, candidateId);
  let pageSequence = 0, applyOverride;
  const respond = (page, pathname, { type = 'script', status = 200, late = false, missingOverride = false, redirected = false, never = false, wrongVersion = false } = {}) => {
    let release;
    const latch = late || never ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
    const request = { url: () => PRODUCTION_ORIGIN + pathname + '?private=NEVER_LOG', method: () => 'GET', resourceType: () => type,
      frame: () => ({ page: () => page }), redirectedFrom: () => redirected ? {} : null,
      failure:()=>({errorText:(options.teardownFailure||options.liveAbort)?'net::ERR_ABORTED':'net::ERR_FAILED'}),
      headerValue: async name => { await latch; return name === 'cloudflare-workers-version-overrides' ? missingOverride ? null : override : name === 'x-locally-release-probe' && pathname === '/.well-known/locally-release' ? '1' : null; } };
    context.emit('request', request);applyOverride?.({pathname,resourceType:type,method:'GET'});
    if(options.requestFailure&&pathname.endsWith('app.js')){context.emit('requestfailed',request);return;}
    context.emit('response', { request: () => request, status: () => status, finished: async () => {throw Error('Body completion must not be a one-second gate');},
      headerValue: async () => wrongVersion ? stableId : candidateId });
    if(options.teardownFailure&&pathname.endsWith('app.js'))page.teardownRequests.push(request);
    if(options.bodyDelayMs&&pathname.startsWith('/_next/static/'))setTimeout(()=>context.emit('requestfinished',request),options.bodyDelayMs);
    else if(!options.pendingBodies)context.emit('requestfinished',request);
    if (late && !never) setImmediate(() => { completed.push(pathname); release(); });
  };
  context.newPage = async () => {
    const page = { id: ++pageSequence, teardownRequests:[], url: () => PRODUCTION_ORIGIN + (page.pathname??'/fixture'),
      close: async () => { for(const r of page.teardownRequests)context.emit('requestfailed',r);page.closed = true; }, isClosed: () => Boolean(page.closed),
      on: () => {}, goto: async () => respond(page, '/.well-known/locally-release', { type: 'document', status: 204, wrongVersion: options.wrongVersion }),
      locator: () => ({ evaluateAll: async () => {
        for (const [pathname, spec] of page.responses ?? []) respond(spec.otherPage ?? page, pathname, spec);
        if (options.closeDuringCapture) await page.close();
        return { refs: [...page.refs, ...(options.hint ? ['/_next/static/hint.js'] : [])], hints: options.hint ? ['/_next/static/hint.js'] : [] };
      } }) };
    context.emit('page',page);return page;
  };
  const result = await runCandidateBrowserSmoke({ origin: PRODUCTION_ORIGIN, mode: 'override', workerName: PRODUCTION_WORKER, versionId: candidateId }, {
    verifyInteraction:async page=>{
      if(options.hydrationFailure)throw new CandidateReleaseBlocked('candidate_client_interaction_failed');
      const pathname=new URL(page.url()).pathname;
      return pathname==='/'?{pathname,opened:!options.ssrOnly,closed:true,interaction:'locale-menu-open-close'}:
        {pathname,clicked:!options.ssrOnly,expanded:true,descriptionVisible:true,interaction:'experience-description-read-more'};
    },
    readAsset: async () => Buffer.from('fixture-static-bytes'),
    fetchImplementation: async (url, init) => {
      const pathname=new URL(url).pathname;probes.push(pathname);
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert(init.signal);
      assert.equal(init.headers['Cloudflare-Workers-Version-Overrides'], override);
      if (options.directIncomplete) return { status:200,redirected:false,arrayBuffer:async()=>{throw Error('private-fixture-body-failure');} };
      if(options.directRedirect)return {status:200,redirected:true};
      return new Response(options.directMismatch ? 'wrong-bytes' : 'fixture-static-bytes', {status:options.directStatus??200});
    },
    runSmoke: async (_origin, hooks) => {
      applyOverride=hooks.versionOverride.onApplied;await hooks.observeContext(context);
      for (const pathname of ['/', '/experiences/42', '/login']) {
        const page = await context.newPage(); page.pathname=pathname;page.refs = ['/_next/static/app.js', '/_next/static/font.woff2', '/_next/static/style.css'];
        respond(page, pathname, { type: 'document', missingOverride: options.workerMissingOverride, status:options.workerRedirect?302:200 });
        respond(page, '/data', { type: 'fetch', status: options.data304 ? 304 : 200 }); respond(page, '/image.svg', { type: 'image' });
        const otherPage = await context.newPage();
        const specs = page.refs.map((p, index) => [p, { type: ['script', 'font', 'stylesheet'][index], late: Boolean(options.late),
          ...(index === 0 ? options.asset : {}), ...(index === 2 ? options.stylesheet : {}), ...(index === 0 && options.otherPage ? { otherPage } : {}) }]);
        if (options.missing) specs.shift();
        if (options.duplicate) specs.push(specs[0]);
        if (options.completedBefore) { for (const [p,s] of specs) respond(page,p,s); page.responses=[]; }
        else page.responses = specs;
        await hooks.collectReadOnlyPageEvidence(page);
        if(options.runtimeError)throw options.runtimeError;
        if(options.bodyDelayMs)await new Promise(resolve=>setTimeout(resolve,options.bodyDelayMs+10));
        await page.close();
      }
      const api = await context.newPage(); respond(api, '/api/proxy-bookings', { type: 'document', status: 401 });
      return { status: 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS', homepage: 'rendered', login: 'rendered', publicExperience: '/experiences/42',
        unauthenticatedProxyBookings: 401, blockedUnexpectedWrites: options.unexpectedWrite?[{method:'POST',pathname:'/api/business'}]:[], blockedUnexpectedExternalWrites: [],
        pageAttempts: ['/', '/experiences/42', '/login'].map(pathname => ({ pathname, outcome: 'pass', pendingFirstPartyRequests: [], genericErrorPresent: Boolean(options.genericError) })) };
    },
  });
  assert(!JSON.stringify(result).includes('NEVER_LOG'));return { result, completed, probes };
}

test('header capture ordering remains safe when callbacks arrive during the DOM snapshot',async()=>{
  for(const options of [{late:true},{completedBefore:true},{late:true,duplicate:true}])assert.equal((await captureOrderingFixture(options)).result.assetSetMatches,true);
});
test('pending browser bodies beyond 1s PASS with executed client UI and exact direct proofs',async()=>{
  const start=Date.now();const {result}=await captureOrderingFixture({bodyDelayMs:1200});
  assert(Date.now()-start>=1200);assert(result.assetEvidence.some(r=>r.browserPending.length>0));
  assert(result.assetResponses.every(r=>r.bodyComplete&&r.hashMatch));assert.equal(result.clientInteractions.length,2);
});
test('pending browser requests are diagnostic; DOM-only and other-page resources still require direct integrity',async()=>{
  for(const options of [{pendingBodies:true},{otherPage:true}]){
    const {result,probes}=await captureOrderingFixture(options);assert(result.assetSetMatches);assert(probes.includes('/_next/static/app.js'));
  }
});
for(const asset of [{status:404},{status:503},{status:302},{status:307},{status:304},{redirected:true}])test(`browser asset safety ${JSON.stringify(asset)} remains hard`,async()=>{
  await assert.rejects(captureOrderingFixture({asset}),blocked('candidate_http_or_asset_failure'));
});
test('requestfailed during live page execution remains hard even with valid direct bytes',async()=>{
  await assert.rejects(captureOrderingFixture({requestFailure:true}),blocked('candidate_request_failure'));
});
test('only ERR_ABORTED after explicit page close is teardown; runtime failures cannot hide there',async()=>{
  const {result}=await captureOrderingFixture({teardownFailure:true,pendingBodies:true});assert.equal(result.requestFailures.length,0);assert(result.intentionalTeardownAborts>0);
  await assert.rejects(captureOrderingFixture({requestFailure:true}),blocked('candidate_request_failure'));
});
for(const [label,options] of [['404',{directStatus:404}],['5xx',{directStatus:503}],['redirect',{directStatus:302}],['redirect flag',{directRedirect:true}],['hash mismatch',{directMismatch:true}],['incomplete body',{directIncomplete:true}]])test(`all collected static assets: ${label} fails direct integrity`,async()=>{
  await assert.rejects(captureOrderingFixture(options),blocked('candidate_asset_integrity_failed'));
});
test('unused hints are included in the complete direct asset proof',async()=>{
  const {result}=await captureOrderingFixture({hint:true});assert(result.assetRefs.includes('/_next/static/hint.js'));
  assert(result.resourceHintProofs.some(r=>r.pathname==='/_next/static/hint.js'&&r.hashMatch));
});
test('missing override and wrong candidate UUID remain hard',async()=>{
  for(const options of [{asset:{missingOverride:true}},{workerMissingOverride:true},{wrongVersion:true}])await assert.rejects(captureOrderingFixture(options),blocked('candidate_identity_unverified'));
});
test('header identity inspection still has its existing 1s bounded diagnostic drain',async()=>{
  const start=Date.now();await assert.rejects(captureOrderingFixture({asset:{never:true}}),blocked('candidate_capture_timeout'));assert(Date.now()-start<2000);
});
test('page close before evidence collection cannot satisfy runtime proof',async()=>{
  await assert.rejects(captureOrderingFixture({closeDuringCapture:true}),blocked('candidate_capture_page_closed'));
});
test('SSR-only and failed client interaction cannot satisfy hydration proof',async()=>{
  for(const options of [{ssrOnly:true},{hydrationFailure:true}])await assert.rejects(captureOrderingFixture(options),blocked('candidate_client_interaction_failed'));
});
test('unexpected business writes remain a hard failure',async()=>{
  await assert.rejects(captureOrderingFixture({unexpectedWrite:true}),blocked('candidate_hard_failure'));
});
for(const category of ['pageerror','first-party runtime console error'])test(`${category}: original browser safety exception is propagated unchanged`,async()=>{
  const error=new Error(category+' fixture');await assert.rejects(captureOrderingFixture({runtimeError:error}),e=>e===error);
});
test('generic error and navigation redirect remain hard failures',async()=>{
  await assert.rejects(captureOrderingFixture({genericError:true}));await assert.rejects(captureOrderingFixture({workerRedirect:true}),blocked('candidate_http_or_asset_failure'));
});


const priorZeroId = '33333333-3333-4333-8333-333333333333';
const stagedBaseline = () => ({ ...structuredClone(baseline), deployment: { id: deploymentId,
  versions: [{ id: stableId, percentage: 100 }, { id: priorZeroId, percentage: 0 }] } });
test('known exact100/old0 baseline can upload unchanged, replace zero once, and promote once', async () => {
  const initial=stagedBaseline(); const plan=makePlan({baseline:initial});
  const {actions,calls}=fixtureActions(initial.deployment);
  const result=await executeCandidateReleaseContract(plan,actions);
  assert.equal(result.status,'CANDIDATE_OVERRIDE_ONLY_RELEASE_CONTRACT_PASS');
  for(const op of ['upload','stage-zero','promote'])assert.equal(calls.filter(c=>c===op).length,1);
  assert(!stageZeroArguments(plan,candidateId).some(a=>a.includes(priorZeroId)));
});
for(const [name,mutate] of [
 ['old zero disappeared',d=>d.versions.pop()],
 ['old zero UUID changed',d=>{d.versions[1].id='44444444-4444-4444-8444-444444444444';}],
 ['old zero percentage changed',d=>{d.versions[1].percentage=1;}],
 ['new version silently staged',d=>{d.versions.push({id:candidateId,percentage:0});}],
])test(name+': upload invariance blocks before staging',async()=>{
 const initial=stagedBaseline(),plan=makePlan({baseline:initial});const {actions,calls}=fixtureActions(initial.deployment),read=actions.snapshot;
 actions.snapshot=async o=>{const r=await read(o);if(calls.includes('upload')){mutate(r.deployment);r.activeDeployment=structuredClone(r.deployment);}return r;};
 await assert.rejects(executeCandidateReleaseContract(plan,actions),blocked('upload_changed_active_deployment'));
 assert.equal(calls.filter(c=>c==='upload').length,1);assert(!calls.includes('stage-zero'));assert(!calls.includes('promote'));
});
test('unknown change to known zero baseline blocks before upload',async()=>{
 const initial=stagedBaseline(),plan=makePlan({baseline:initial});const {actions,calls}=fixtureActions(initial.deployment),read=actions.snapshot;
 actions.snapshot=async o=>{const r=await read(o);r.deployment.versions.pop();r.activeDeployment=structuredClone(r.deployment);return r;};
 await assert.rejects(executeCandidateReleaseContract(plan,actions),blocked('unexpected_deployment_distribution'));
 assert(!calls.includes('upload'));
});
test('staged build proof omitting or replacing zero entry blocks upload despite identical stable artifact', async()=>{
 for(const versions of [undefined,[{id:stableId,percentage:100}],[{id:stableId,percentage:100},{id:candidateId,percentage:0}]]){
  const initial=stagedBaseline(),plan=makePlan({baseline:initial}),{actions,calls}=fixtureActions(initial.deployment),read=actions.bridgeProofFreshness;
  actions.bridgeProofFreshness=async()=>({...await read(),deploymentVersions:versions});
  await assert.rejects(executeCandidateReleaseContract(plan,actions),blocked('bridge_provenance_or_freshness_failed'));
  assert(!calls.includes('upload'));
 }
});

test('live ERR_ABORTED and unexpected RSC/API 304 remain hard failures',async()=>{
  await assert.rejects(captureOrderingFixture({requestFailure:true,liveAbort:true}),blocked('candidate_request_failure'));
  await assert.rejects(captureOrderingFixture({data304:true}),blocked('candidate_http_or_asset_failure'));
});

test('promotion contract requires independent cached representation, executed JS and unchanged direct GET proof',()=>{
  const make = () => {
    const smoke=makeSmoke(), pathname=smoke.assetRefs[0], sha256='a'.repeat(64);
    smoke.assetResponses[0]={...smoke.assetResponses[0],hashMatch:true,sha256};
    smoke.browserAssetResponses=[{pathname,status:304,bodyComplete:false,redirected:false,overrideApplied:true}];
    const executionProof={ownerId:'owner',targetId:'target',generation:0,snapshotId:1,scriptId:'script',executionContextId:1,sha256,executed:true};
    smoke.coverageOwners=[{ownerId:'owner',targetId:'target',snapshotId:2,finalized:true,cleanupComplete:true,
      audit:['Profiler.startPreciseCoverage','Profiler.stopPreciseCoverage','Profiler.disable'].map(method=>({method})),
      scripts:[{scriptId:'script',executionContextId:1,generation:0,sha256,ranges:[{count:1}]}]}];
    smoke.cacheValidationReceipts=[{pathname,status:304,networkBodyBytes:0,sha256,validatedCachedRepresentation:true,browserFinished:true,scriptExecuted:true,executionProof}];
    return smoke;
  };
  assertFullCandidateSmoke(make());
  for(const mutate of [s=>{s.cacheValidationReceipts=[];},s=>{s.cacheValidationReceipts[0].scriptExecuted=false;},s=>{s.cacheValidationReceipts[0].networkBodyBytes=1;},s=>{s.cacheValidationReceipts[0].browserFinished=false;},s=>{s.browserAssetResponses[0].bodyComplete=true;},s=>{s.assetResponses[0].sha256='b'.repeat(64);},s=>{s.cacheValidationReceipts[0].executionProof=null;},s=>{s.coverageOwners=[];},s=>{s.cacheValidationReceipts[0].executionProof.targetId='other';},s=>{s.coverageOwners[0].scripts[0].ranges[0].count=0;}]){
    const smoke=make();mutate(smoke);assert.throws(()=>assertFullCandidateSmoke(smoke),blocked('candidate_cache_revalidation_failed'));
  }
});

test('coverage owner lifecycle omissions and duplicate starts remain hard failures',()=>{
  for(const mutation of ['start-duplicate','missing-final','missing-cleanup']) {
    const smoke=makeSmoke();const owner={snapshotId:1,finalized:true,cleanupComplete:true,audit:['Profiler.startPreciseCoverage','Profiler.stopPreciseCoverage','Profiler.disable'].map(method=>({method}))};
    if(mutation==='start-duplicate')owner.audit.push({method:'Profiler.startPreciseCoverage'});
    if(mutation==='missing-final')owner.finalized=false;
    if(mutation==='missing-cleanup')owner.cleanupComplete=false;
    smoke.coverageOwners=[owner];assert.throws(()=>assertFullCandidateSmoke(smoke),blocked('candidate_coverage_owner_violation'));
  }
});

test('late informational notice between locale menu clicks is dismissed through UI without losing open/close proof', {timeout:20000}, async()=>{
  const {chromium}=await import('@playwright/test');
  const server=createServer((_req,res)=>res.writeHead(200,{'content-type':'text/html'}).end(`<body><div id="locally-app-shell"><button id="globe"><svg class="lucide-globe" width="16" height="16"></svg></button><div id="menu" hidden><button>English</button></div></div><script>
    window.toggles=0;window.dismissals=0;
    document.querySelector('#globe').onclick=()=>{const m=document.querySelector('#menu');m.hidden=!m.hidden;window.toggles++;if(window.toggles===1)setTimeout(()=>{
      document.querySelector('#locally-app-shell').setAttribute('inert','');
      const overlay=document.createElement('div');overlay.dataset.testid='legacy-experience-popup-overlay';overlay.style='position:fixed;inset:0;background:white;z-index:999';overlay.innerHTML='<button data-testid="legacy-experience-popup-close">Close</button>';document.body.append(overlay);
      overlay.querySelector('button').onclick=()=>{overlay.remove();document.querySelector('#locally-app-shell').removeAttribute('inert');window.dismissals++};
    },20)};
    document.addEventListener('mousedown',e=>{if(!document.querySelector('#locally-app-shell').contains(e.target))document.querySelector('#menu').hidden=true});
  </script>`));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  try{const page=await browser.newPage();await page.goto(origin);const result=await verifyReadOnlyClientInteraction(page);assert.equal(result.opened,true);assert.equal(result.closed,true);assert.equal(result.noticeDismissed,true);assert.equal(await page.evaluate(()=>window.dismissals),1);assert.equal(await page.getByRole('button',{name:'English',exact:true}).isVisible(),false);assert.equal(await page.evaluate(()=>document.querySelector('#locally-app-shell').hasAttribute('inert')),false);}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
