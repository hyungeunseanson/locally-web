import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { versionProvider, artifactDigest, deploymentId } from './active-version-artifact.fixture.mjs';
import {
  assertConfigUnchanged, assertFullCandidateSmoke, assertOverrideIdentity, buildCandidateReleasePlan,
  classifyCandidateAttempt, executeCandidateReleaseContract, parseVersionUploadOutput, promotionArguments,
  PRODUCTION_ORIGIN, PRODUCTION_WORKER, rollbackArguments, safeConfigSnapshot, stageZeroArguments, versionOverrideHeader,
} from './candidate-release-contract.mjs';
import { compareDurableObjectProof, DO_MODULES, fingerprintDurableObjectArtifact, readStableDurableObjectArtifact } from './durable-object-release-safety.mjs';
import { withReleaseProbeIdentity } from '../../app/utils/cloudflareReleaseProbe.mjs';
import { main, parseCandidateArguments } from './run-candidate-release.mjs';
import { runCandidateBrowserSmoke } from './run-candidate-browser-smoke.mjs';

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
    ...Object.keys(DO_MODULES).map(name => ({ name, class_name: name, type: 'durable_object_namespace', namespace_id: `${name}-namespace` }))],
  crons: ['*/10 * * * *'], queueConsumers: [{ queue_name: 'fixture-queue', script: PRODUCTION_WORKER, dead_letter_queue: 'fixture-dlq', settings: { max_retries: 5 } }],
};
const baseline = { snapshot, deployment: { id: deploymentId, versions: [{ id: stableId, percentage: 100 }] } };
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
function fixtureActions() {
  const calls = []; let deployment = structuredClone(baseline.deployment); let bindings = structuredClone(snapshot.bindings);
  const actions = {
    recheckIdentity: async versionId => ({versionId,status:204}), authorizedCandidateUpload: true, authorizePromotion: async () => true,
    bridgeProofFreshness: async () => ({kind:'provider',sourceKind:'workers-version-modules',artifactSha256:artifactDigest(artifact()),deploymentId:baseline.deployment.id,versionId:stableId,etag:'a'.repeat(64),compatSha256:lineage}),
    build: async () => calls.push('build'), semanticPreflight: async () => { calls.push('preflight'); return 'PASS'; },
    durableObjectProof: async () => { calls.push('do-proof'); return makeProof(); },
    snapshot: async () => { calls.push('snapshot'); return { snapshot: { ...structuredClone(snapshot), bindings: structuredClone(bindings) }, deployment: structuredClone(deployment) }; },
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
  actions.snapshot = async () => { const r = await read(); if (calls.includes('upload')) r.deployment.id = 'concurrent'; return r; };
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('upload_changed_active_deployment')); assert(!calls.includes('stage-zero'));
});
test('epsilon, unknown percentage, missing candidate and third version all reject', async () => {
  for (const mutate of [d => { d.versions[0].percentage = 99.99; d.versions[1].percentage = 0.01; },
    d => { delete d.versions[1].percentage; }, d => { d.versions.pop(); }, d => { d.versions.push({ id: '33333333-3333-4333-8333-333333333333', percentage: 0 }); }]) {
    const { actions, calls } = fixtureActions(); const read = actions.snapshot;
    actions.snapshot = async () => { const r = await read(); if (calls.includes('stage-zero')) mutate(r.deployment); return r; };
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

test('Chromium propagates override/probe on documents, data, JS, CSS, font, image and API; writes remain blocked', { timeout: 25000 }, async () => {
  const received = []; const font = await readFile(new URL('../../app/fonts/Inter/Inter_18pt-Regular.woff2', import.meta.url));
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    received.push({ pathname, method: request.method, override: request.headers['cloudflare-workers-version-overrides'], probe: request.headers['x-locally-release-probe'] });
    if (pathname === '/.well-known/locally-release') { response.writeHead(204, { 'X-Locally-Worker-Version': candidateId }).end(); return; }
    if (pathname === '/api/proxy-bookings') { response.writeHead(401).end(); return; }
    if (pathname === '/data') { response.writeHead(200, { 'content-type': 'application/json' }).end('{}'); return; }
    if (pathname === '/_next/static/app.js') { response.writeHead(200, { 'content-type': 'text/javascript' }).end("fetch('/data');fetch('/cdn-cgi/rum',{method:'POST'}).catch(()=>{});"); return; }
    if (pathname === '/_next/static/font.woff2') { response.writeHead(200, { 'content-type': 'font/woff2' }).end(font); return; }
    if (pathname === '/_next/static/style.css') { response.writeHead(200, { 'content-type': 'text/css' }).end('body{color:black}'); return; }
    if (pathname === '/image.svg') { response.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'); return; }
    response.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><title>Fixture</title>
      <link rel="preload" href="/_next/static/font.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/_next/static/style.css">
      <style>@font-face{font-family:fixture;src:url('/_next/static/font.woff2')}body{font-family:fixture}</style>
      <script src="/_next/static/app.js"></script><body><h1>Fixture</h1><img src="/image.svg"><a href="/experiences/42">Experience</a>
      ${pathname === '/login' ? '<div data-testid="login-modal"><input type="email"><input type="password"></div>' : ''}</body>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const smoke = await runCandidateBrowserSmoke({ origin, mode: 'override', workerName: PRODUCTION_WORKER, versionId: candidateId });
    assertFullCandidateSmoke(smoke); assertOverrideIdentity({ versionId: candidateId, smoke, expectedOrigin: origin });
    assert(Object.values(smoke.overrideCoverage).every(Boolean));
    for (const path of ['/', '/login', '/experiences/42', '/_next/static/app.js', '/_next/static/font.woff2', '/_next/static/style.css', '/image.svg', '/data', '/api/proxy-bookings']) {
      assert(received.some(r => r.pathname === path), path); assert(received.filter(r => r.pathname === path).every(r => r.override === versionOverrideHeader(PRODUCTION_WORKER, candidateId) && r.probe === undefined), path);
    }
    assert(received.every(r => r.method === 'GET'), 'mutation gate must not forward telemetry POST');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
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
