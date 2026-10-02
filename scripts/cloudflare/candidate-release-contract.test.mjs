import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  assertConfigUnchanged, assertFullCandidateSmoke, assertOverrideIdentity,
  buildCandidateReleasePlan, classifyCandidateAttempt, executeCandidateReleaseContract,
  parseVersionUploadOutput, promotionArguments, PRODUCTION_ORIGIN, PRODUCTION_WORKER,
  rollbackArguments, safeConfigSnapshot, stageZeroArguments, versionOverrideHeader,
} from './candidate-release-contract.mjs';
import { main, parseCandidateArguments } from './run-candidate-release.mjs';
import { runCandidateBrowserSmoke } from './run-candidate-browser-smoke.mjs';

const stableId = '11111111-1111-4111-8111-111111111111';
const candidateId = '22222222-2222-4222-8222-222222222222';
const versionUrl = `https://22222222-${PRODUCTION_WORKER}.fixture.workers.dev`;
const flags = { CLOUDFLARE_DEPLOYMENT_ENV: 'production', OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED: 'true' };
const config = {
  keep_vars: true,
  env: { production: { name: PRODUCTION_WORKER, preview_urls: true, migrations: [] } },
};
const snapshot = {
  routes: [{ pattern: 'www.locally-travel.com/*' }], customDomains: [],
  subdomain: { enabled: false, previews_enabled: true },
  observability: { enabled: true, head_sampling_rate: 0.1 },
  bindings: [
    ...Object.entries(flags).map(([name, text]) => ({ name, type: 'plain_text', text })),
    { name: 'SUPABASE_SERVICE_ROLE_KEY', type: 'secret_text' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', type: 'secret_text' },
    { name: 'EXAMPLE_QUEUE', type: 'queue', queue_name: 'fixture-queue' },
  ],
  crons: ['*/10 * * * *'],
  queueConsumers: [{ queue_name: 'fixture-queue', script: PRODUCTION_WORKER, dead_letter_queue: 'fixture-dlq', settings: { max_retries: 5 } }],
};
const baseline = { snapshot, deployment: { id: 'fixture-deployment', versions: [{ id: stableId, percentage: 100 }] } };
const makePlan = (overrides = {}) => buildCandidateReleasePlan({ config, baselineConfig: config, baseline,
  runtimeVariables: flags, wranglerVersion: '4.129.1', ...overrides });
const safeAttempt = pathname => ({ pathname, pass: true, timeout: false, pendingStaticAssets: 0,
  httpHardErrors: 0, fiveXX: 0, asset404: 0, genericError: false, pageErrors: 0,
  consoleErrors: 0, unexpectedWrites: 0, versionMismatch: false });
const receipts = ['/', '/experiences/42', '/login', '/api/proxy-bookings'].map((pathname, i) => ({
  pathname, rayId: (i + 1).toString(16).padStart(16, '0'), startedAt: 100, finishedAt: 200,
}));
const makeEvents = () => receipts.map(r => ({ timestamp: 150, $workers: {
  scriptName: PRODUCTION_WORKER, scriptVersion: { id: candidateId }, requestId: r.rayId, eventType: 'fetch', outcome: 'ok',
} }));
function makeSmoke(origin = PRODUCTION_ORIGIN) {
  return { origin, redirected: false, fullPass: true,
    checks: { home: true, login: true, experience: true, api401: true },
    httpHardErrors: 0, fiveXX: 0, asset404: 0, genericError: false, pageErrors: 0,
    consoleErrors: 0, unexpectedWrites: 0, versionMismatch: false,
    assetRefs: ['/_next/static/app.js', '/_next/static/font.woff2'],
    assetResponses: [{ pathname: '/_next/static/app.js', status: 200 }, { pathname: '/_next/static/font.woff2', status: 200 }],
    attempts: ['/', '/experiences/42', '/login'].map(safeAttempt),
    overrideCoverage: { document: true, script: true, font: true, api: true },
    workerReceipts: structuredClone(receipts),
  };
}
function fixtureActions() {
  const calls = [];
  let deployment = structuredClone(baseline.deployment);
  const actions = {
    build: async () => calls.push('build'),
    semanticPreflight: async () => { calls.push('preflight'); return 'PASS'; },
    snapshot: async () => { calls.push('snapshot'); return { snapshot: structuredClone(snapshot), deployment: structuredClone(deployment) }; },
    upload: async args => {
      calls.push('upload');
      assert.deepEqual(args.slice(0, 2), ['versions', 'upload']);
      assert.equal(deployment.versions.length, 1, 'upload must leave stable traffic untouched');
      return `Worker Version ID: ${candidateId}\nVersion Preview URL: ${versionUrl}\n`;
    },
    versionMetadata: async id => { calls.push('metadata'); return { id, bindings: structuredClone(snapshot.bindings) }; },
    smoke: async ({ mode, origin }) => { calls.push(`${mode}-smoke`); return makeSmoke(origin); },
    stageZero: async args => {
      calls.push('stage-zero');
      assert(args.includes(`${stableId}@100%`) && args.includes(`${candidateId}@0%`));
      deployment.versions.push({ id: candidateId, percentage: 0 });
    },
    identityEvents: async () => { calls.push('identity'); return makeEvents(); },
    promote: async args => {
      calls.push('promote');
      assert(args.includes(`${candidateId}@100%`));
      assert(calls.includes('identity') && calls.includes('override-smoke') && calls.includes('isolated-smoke'));
      deployment.versions = [{ id: candidateId, percentage: 100 }];
    },
    postDeployVerification: async () => { calls.push('post-verification'); return {
      browserSmoke: 'PASS', naturalCronHealth: 'PASS', queueHealth: 'PASS', scheduledFlags: 'UNCHANGED',
    }; },
  };
  return { calls, actions };
}
const blocked = code => error => error.code === code;

test('upload alone preserves stable 100%; promotion follows all candidate gates', async () => {
  const { actions, calls } = fixtureActions();
  const result = await executeCandidateReleaseContract(makePlan(), actions);
  assert.equal(result.status, 'CANDIDATE_FIRST_RELEASE_CONTRACT_PASS');
  assert.equal(calls.filter(c => c === 'upload').length, 1);
  assert.deepEqual(calls.filter(c => c !== 'snapshot'), ['build', 'preflight', 'upload', 'metadata',
    'isolated-smoke', 'stage-zero', 'override-smoke', 'identity', 'promote', 'post-verification']);
  assert.deepEqual(result.rollbackArguments, rollbackArguments(makePlan()));
});

test('provider output yields exact candidate UUID and immutable Version URL; ambiguity rejects', () => {
  assert.deepEqual(parseVersionUploadOutput(`Worker Version ID: ${candidateId}\nVersion Preview URL: ${versionUrl}`),
    { versionId: candidateId, versionUrl });
  for (const output of ['Version uploaded', `Worker Version ID: ${candidateId}\nWorker Version ID: ${stableId}`,
    `Worker Version ID: ${candidateId}\nVersion Preview URL: https://stable.example.com`]) {
    assert.throws(() => parseVersionUploadOutput(output));
  }
});

test('exact zero staging is mandatory; epsilon/provider drift prevents promotion', async () => {
  assert(stageZeroArguments(makePlan(), candidateId).includes(`${candidateId}@0%`));
  const { actions, calls } = fixtureActions();
  const read = actions.snapshot;
  actions.snapshot = async () => {
    const value = await read();
    if (calls.includes('stage-zero')) value.deployment.versions[1].percentage = 0.01;
    return value;
  };
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('unexpected_deployment_distribution'));
  assert(!calls.includes('promote'));
});

test('DO implementation or disabled previews blocks before build/upload', async () => {
  for (const plan of [makePlan({ config: { ...config, env: { production: { ...config.env.production,
    durable_objects: { bindings: [{ name: 'CACHE', class_name: 'Cache' }] } } } },
  baselineConfig: { ...config, env: { production: { ...config.env.production,
    durable_objects: { bindings: [{ name: 'CACHE', class_name: 'Cache' }] } } } } }),
  makePlan({ baseline: { ...baseline, snapshot: { ...snapshot, subdomain: { enabled: false, previews_enabled: false } } } })]) {
    const { actions, calls } = fixtureActions();
    await assert.rejects(executeCandidateReleaseContract(plan, actions), blocked('candidate_plan_blocked'));
    assert.deepEqual(calls, []);
  }
});

test('missing isolated endpoint or candidate metadata mismatch cannot reach staging', async () => {
  for (const change of [a => { a.upload = async () => `Worker Version ID: ${candidateId}`; },
    a => { a.versionMetadata = async () => ({ id: stableId, bindings: snapshot.bindings }); }]) {
    const { actions, calls } = fixtureActions(); change(actions);
    await assert.rejects(executeCandidateReleaseContract(makePlan(), actions));
    assert(!calls.includes('stage-zero') && !calls.includes('promote'));
  }
});

test('version metadata existence cannot substitute for runtime identity', async () => {
  for (const events of [[], makeEvents().map(e => ({ ...e, $workers: { ...e.$workers, scriptVersion: { id: stableId } } })),
    makeEvents().map(e => ({ ...e, timestamp: 999 })), makeEvents().slice(0, 3)]) {
    const { actions, calls } = fixtureActions();
    actions.identityEvents = async () => events;
    await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('candidate_identity_unverified'));
    assert(!calls.includes('promote'));
  }
});

test('identity requires correlated receipts for every Worker path and override coverage', () => {
  const smoke = makeSmoke();
  assertOverrideIdentity({ versionId: candidateId, workerName: PRODUCTION_WORKER, smoke, events: makeEvents() });
  smoke.workerReceipts = Array(4).fill(receipts[0]);
  assert.throws(() => assertOverrideIdentity({ versionId: candidateId, workerName: PRODUCTION_WORKER, smoke, events: makeEvents() }));
  smoke.workerReceipts = receipts; smoke.overrideCoverage.font = false;
  assert.throws(() => assertOverrideIdentity({ versionId: candidateId, workerName: PRODUCTION_WORKER, smoke, events: makeEvents() }), blocked('override_subrequest_coverage_missing'));
});

test('HTTP 5xx, generic error, page/console error, writes, asset 404 and mismatch block promotion', async () => {
  for (const [field, value] of Object.entries({ httpHardErrors: 1, fiveXX: 1, asset404: 1, genericError: true,
    pageErrors: 1, consoleErrors: 1, unexpectedWrites: 1, versionMismatch: true })) {
    const { actions, calls } = fixtureActions();
    actions.smoke = async ({ origin }) => ({ ...makeSmoke(origin), [field]: value });
    await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('candidate_hard_failure'));
    assert(!calls.includes('promote'), field);
  }
});

test('transport-only timeout needs positive pending static evidence and a subsequent full PASS', () => {
  const timeout = { ...safeAttempt('/login'), timeout: true, pass: false, pendingStaticAssets: 1 };
  assert.equal(classifyCandidateAttempt(timeout), 'TRANSPORT_ONLY_TIMEOUT');
  const smoke = makeSmoke(); smoke.attempts.splice(2, 0, timeout);
  assertFullCandidateSmoke(smoke);
  smoke.attempts.pop();
  assert.throws(() => assertFullCandidateSmoke(smoke), blocked('full_pass_after_timeout_missing'));
  for (const patch of [{ pendingStaticAssets: 0 }, { fiveXX: 1 }, { genericError: true }, { unexpectedWrites: 1 }, { versionMismatch: true }]) {
    assert.equal(classifyCandidateAttempt({ ...timeout, ...patch }), 'APPLICATION_FAILURE');
  }
});

test('third attempt, incomplete checks and missing asset response evidence cannot pass', () => {
  const third = makeSmoke(); third.attempts.push(safeAttempt('/login'), safeAttempt('/login'));
  assert.throws(() => assertFullCandidateSmoke(third), blocked('more_than_two_smoke_attempts'));
  const incomplete = makeSmoke(); incomplete.checks.login = false;
  assert.throws(() => assertFullCandidateSmoke(incomplete), blocked('candidate_checks_incomplete'));
  const missing = makeSmoke(); missing.assetResponses.pop();
  assert.throws(() => assertFullCandidateSmoke(missing), blocked('candidate_asset_missing'));
});

test('promotion requires preflight, both identity proofs and both full smoke passes', () => {
  const evidence = { semanticPreflight: 'PASS', isolatedIdentityVerified: true, overrideIdentityVerified: true,
    isolatedSmoke: makeSmoke(versionUrl), overrideSmoke: makeSmoke() };
  for (const patch of [{ semanticPreflight: 'FAIL' }, { isolatedIdentityVerified: false },
    { overrideIdentityVerified: false }, { overrideSmoke: { fullPass: false } }]) {
    assert.throws(() => promotionArguments(makePlan(), candidateId, { ...evidence, ...patch }));
  }
  assert.throws(() => promotionArguments(makePlan(), stableId, evidence));
});

test('planned migrations/routes/bindings and live trigger drift block', async () => {
  const changed = structuredClone(config); changed.env.production.migrations.push({ tag: 'new-migration' });
  assert.throws(() => makePlan({ config: changed }), blocked('planned_trigger_or_config_change'));
  const ordered = structuredClone(config); ordered.env.production.migrations = [{ tag: 'first' }, { tag: 'second' }];
  const reordered = structuredClone(ordered); reordered.env.production.migrations.reverse();
  assert.throws(() => makePlan({ config: reordered, baselineConfig: ordered }), blocked('planned_trigger_or_config_change'));
  for (const mutate of [s => s.routes.push({ pattern: 'other.example.com/*' }), s => s.crons.push('* * * * *'),
    s => { s.queueConsumers[0].settings.max_retries = 9; }, s => { s.bindings[2].name = 'OTHER_SECRET'; }]) {
    const { actions, calls } = fixtureActions();
    const read = actions.snapshot;
    actions.snapshot = async () => { const value = await read(); mutate(value.snapshot); return value; };
    await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('trigger_or_config_drift'));
    assert(!calls.includes('upload'));
  }
});

test('concurrent config/traffic change at the final promotion gate aborts', async () => {
  const { actions, calls } = fixtureActions(); const read = actions.snapshot;
  actions.snapshot = async () => {
    const result = await read();
    if (calls.includes('identity')) result.deployment.versions[0].id = '33333333-3333-4333-8333-333333333333';
    return result;
  };
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('unexpected_deployment_distribution'));
  assert(!calls.includes('promote'));
});

test('bindings retain target IDs; secret values never appear in safe snapshots/plans/errors', () => {
  const raw = structuredClone(snapshot);
  raw.bindings[2].text = 'fixture-sensitive-value';
  raw.bindings.push({ name: 'CACHE', type: 'durable_object_namespace', namespace_id: 'namespace-a', class_name: 'Cache' });
  const safe = safeConfigSnapshot(raw);
  assert(!JSON.stringify(safe).includes('fixture-sensitive-value'));
  const changed = structuredClone(raw); changed.bindings.at(-1).namespace_id = 'namespace-b';
  assert.throws(() => assertConfigUnchanged(raw, changed), blocked('trigger_or_config_drift'));
  const plan = makePlan({ baseline: { ...baseline, snapshot: raw } });
  assert(!JSON.stringify(plan).includes('fixture-sensitive-value'));
  assert.throws(() => makePlan({ runtimeVariables: { SUPABASE_SERVICE_ROLE_KEY: 'fixture-sensitive-value' } }), error => {
    assert(!error.message.includes('fixture-sensitive-value')); return error.code === 'credential_or_unmanaged_var_override';
  });
  assert.throws(() => parseVersionUploadOutput(`Worker Version ID: ${candidateId}\nVersion Preview URL: https://[fixture-sensitive-value`), error => {
    assert(!error.message.includes('fixture-sensitive-value')); return error.code === 'invalid_provider_version_url';
  });
});

test('lost encrypted binding on uploaded candidate prevents staging', async () => {
  const { actions, calls } = fixtureActions();
  actions.versionMetadata = async id => ({ id, bindings: snapshot.bindings.filter(b => b.name !== 'SUPABASE_SERVICE_ROLE_KEY') });
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('candidate_binding_or_secret_drift'));
  assert(!calls.includes('stage-zero'));
});

test('CLI is plan/dry-run only and cannot run upload/stage/promote or force options', async () => {
  for (const args of [['--execute'], ['--force'], ['--plan', '--dry-run']]) assert.throws(() => parseCandidateArguments(args));
  const calls = []; const logs = [];
  const deps = { config, baselineConfig: config, readBaseline: async () => baseline,
    resolveContract: async () => ({ runtimeVariables: flags, readerEnvironment: {} }), wranglerVersion: '4.129.1',
    semanticPreflight: async () => ({ status: 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS' }),
    runLocal: (_cmd, args) => calls.push(args), log: s => logs.push(s) };
  const plan = await main(['--plan'], deps); assert.equal(plan.candidateUpload, 0); assert.deepEqual(calls, []);
  await main(['--dry-run'], deps);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['run', 'cloudflare:build:production']);
  assert.deepEqual(calls[1].slice(0, 2), ['versions', 'upload']); assert.equal(calls[1].at(-1), '--dry-run');
  assert(logs.every(s => !s.includes('fixture-sensitive-value')));
  await assert.rejects(main(['--plan'], { ...deps, semanticPreflight: async () => ({ status: 'FAIL' }) }), blocked('semantic_preflight_failed'));
});

test('post-promotion regression fails without an automatic rollback or second promotion', async () => {
  const { actions, calls } = fixtureActions();
  actions.postDeployVerification = async () => ({ browserSmoke: 'FAIL' });
  await assert.rejects(executeCandidateReleaseContract(makePlan(), actions), blocked('post_deploy_verification_failed'));
  assert.equal(calls.filter(c => c === 'promote').length, 1);
});

test('real Chromium sends the candidate override on HTML, JS, font and API; writes remain blocked', { timeout: 20000 }, async () => {
  const received = [];
  const font = await readFile(new URL('../../app/fonts/Inter/Inter_18pt-Regular.woff2', import.meta.url));
  let ray = 1;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    received.push({ pathname, method: request.method, override: request.headers['cloudflare-workers-version-overrides'] });
    response.setHeader('cf-ray', `${(ray++).toString(16).padStart(16, '0')}-TEST`);
    if (pathname === '/api/proxy-bookings') { response.writeHead(401).end(); return; }
    if (pathname === '/_next/static/app.js') { response.writeHead(200, { 'content-type': 'text/javascript' }).end('void 0;'); return; }
    if (pathname === '/_next/static/font.woff2') { response.writeHead(200, { 'content-type': 'font/woff2' }).end(font); return; }
    response.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><title>Fixture</title>
      <link rel="preload" href="/_next/static/font.woff2" as="font" type="font/woff2" crossorigin>
      <style>@font-face{font-family:fixture;src:url('/_next/static/font.woff2')}body{font-family:fixture}</style>
      <script src="/_next/static/app.js"></script><body><h1>Fixture</h1><a href="/experiences/42">Experience</a>
      ${pathname === '/login' ? '<div data-testid="login-modal"><input type="email"><input type="password"></div>' : ''}
      <script>fetch('/cdn-cgi/rum',{method:'POST'}).catch(()=>{});</script></body>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const smoke = await runCandidateBrowserSmoke({ origin, mode: 'override', workerName: PRODUCTION_WORKER, versionId: candidateId });
    assertFullCandidateSmoke(smoke);
    assert.deepEqual(smoke.overrideCoverage, { document: true, script: true, font: true, api: true });
    assert.equal(smoke.workerReceipts.length, 4);
    for (const path of ['/', '/login', '/experiences/42', '/_next/static/app.js', '/_next/static/font.woff2', '/api/proxy-bookings']) {
      assert(received.some(r => r.pathname === path), path);
      assert(received.filter(r => r.pathname === path).every(r => r.override === versionOverrideHeader(PRODUCTION_WORKER, candidateId)), path);
    }
    assert(received.every(r => r.method === 'GET'), 'mutation gate must not forward telemetry POST');
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
