import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertProductionBridgeProofFresh } from './revalidation-bridge-freshness.mjs';
import { main } from './run-production-deploy.mjs';

const BASELINE = 'OPENNEXT_REVALIDATION_BRIDGE_BASELINE_CHANGED_BEFORE_DEPLOY';
const LINEAGE = 'OPENNEXT_REVALIDATION_BRIDGE_LINEAGE_MISMATCH';
const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
const proof = () => ({ kind: 'provider', etagMatch: true, deploymentId: id('1'), versionId: id('2'), etag: 'a'.repeat(64), compatSha256: 'b'.repeat(64) });
const secret = 'private-fixture-credential-never-log';

async function exercise(t, change = {}, dryRun = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bridge-freshness-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.open-next'));
  await mkdir(path.join(root, 'config/cloudflare'), { recursive: true });
  const p = proof(); change.proof?.(p);
  if (!change.missing) await writeFile(path.join(root, '.open-next/locally-revalidation-bridge-proof.json'), change.raw ?? JSON.stringify(p));
  const policy = { workerName: 'locally-web-opennext-production', compatTokenSha256: proof().compatSha256 };
  change.policy?.(policy);
  await writeFile(path.join(root, 'config/cloudflare/revalidation-bridge.json'), JSON.stringify(policy));
  const deployment = { id: proof().deploymentId, created_on: '2026-10-02T00:00:00Z', versions: [{ version_id: proof().versionId, percentage: 100 }] };
  const version = { id: proof().versionId, resources: { script: { etag: proof().etag } } };
  const events = [], logs = [], requests = []; let smoke = 0, error;
  try {
    await main(dryRun ? ['--dry-run'] : [], {
      environment: dryRun ? { LOCALLY_ISR_BRIDGE_SOURCE: 'fixture' } : {},
      runCommand: (_command, args, options) => {
        if (args.includes('cloudflare:build:production')) {
          assert.equal(options.env.LOCALLY_ISR_BRIDGE_SOURCE, dryRun ? 'fixture' : 'provider'); events.push('build');
        } else { assert.equal(args.includes('--dry-run'), dryRun); events.push('deploy'); }
      },
      runSemanticPreflight: async () => { events.push('semantic'); },
      runBrowserSmoke: async () => {
        events.push(++smoke === 1 ? 'pre-smoke' : 'post-smoke');
        // Simulate the provider changing while the pre-deploy smoke is running.
        change.deployment?.(deployment); change.version?.(version);
      },
      runBridgeProofFreshness: async () => {
        events.push('freshness');
        await assertProductionBridgeProofFresh({ root, credentials: { accountId: 'fixture-account', apiToken: secret },
          fetchImplementation: async (url, options) => {
            assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
            assert.equal(options.headers.Authorization, `Bearer ${secret}`);
            requests.push(url);
            const suffix = url.endsWith('/deployments') ? 'deployment-get' : 'version-get'; events.push(suffix);
            if (change.transportError) throw new Error(secret);
            if (suffix === 'version-get') assert(url.endsWith(`/versions/${proof().versionId}`));
            return new Response(JSON.stringify({ success: !change.apiFailure, result: suffix === 'deployment-get' ? { deployments: [deployment] } : version }), { status: change.httpFailure ? 403 : 200 });
          },
        });
      },
      log: message => logs.push(message),
    });
  } catch (caught) { error = caught; }
  assert(!JSON.stringify(logs).includes(secret));
  if (error) { assert(!String(error.stack).includes(secret)); assert.equal(error.cause, undefined); }
  return { events, requests, error, logs };
}

test('fresh provider proof permits deploy immediately after pre-smoke and final GETs', async t => {
  const r = await exercise(t);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.events, ['build', 'semantic', 'pre-smoke', 'freshness', 'deployment-get', 'version-get', 'deploy', 'post-smoke']);
  assert.equal(r.requests.length, 2);
});

for (const [name, change, expected = BASELINE] of [
  ['deployment changed during smoke', { deployment: d => { d.id = id('3'); } }],
  ['stable version changed', { deployment: d => { d.versions[0].version_id = id('3'); } }],
  ['second version at zero percent appeared', { deployment: d => { d.versions.push({ version_id: id('3'), percentage: 0 }); } }],
  ['percentage below 100', { deployment: d => { d.versions[0].percentage = 99; } }],
  ['percentage string instead of number', { deployment: d => { d.versions[0].percentage = '100'; } }],
  ['version ETag changed', { version: v => { v.resources.script.etag = 'c'.repeat(64); } }],
  ['version metadata identity changed', { version: v => { v.id = id('3'); } }],
  ['proof kind fixture', { proof: p => { p.kind = 'fixture'; } }],
  ['etagMatch false', { proof: p => { p.etagMatch = false; } }],
  ['lineage mismatch', { proof: p => { p.compatSha256 = 'c'.repeat(64); } }, LINEAGE],
  ['malformed policy fingerprint', { policy: p => { p.compatTokenSha256 = secret; } }, LINEAGE],
  ['malformed proof JSON redacted', { raw: secret }],
  ['missing proof', { missing: true }],
  ['raw token field rejected without logging', { proof: p => { p.token = secret; } }],
  ['unexpected raw credential in optional field', { proof: p => { p.currentSha256 = secret; } }],
  ['provider exception redacted', { transportError: true }],
  ['provider unsuccessful response', { apiFailure: true }],
  ['provider HTTP failure', { httpFailure: true }],
  ...['deploymentId', 'versionId', 'etag', 'compatSha256'].flatMap(key => [
    [`missing ${key}`, { proof: p => { delete p[key]; } }],
    [`malformed ${key}`, { proof: p => { p[key] = secret; } }],
  ]),
]) test(`${name}: blocks deploy with a sanitized error`, async t => {
  const r = await exercise(t, change);
  assert.equal(r.error?.message, expected);
  assert.equal(r.events.filter(e => e === 'deploy').length, 0);
  assert.equal(r.events.includes('post-smoke'), false);
});

test('fixture dry-run skips provider freshness and only invokes a dry-run command', async t => {
  const r = await exercise(t, { missing: true }, true);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.events, ['build', 'deploy']);
  assert.equal(r.requests.length, 0);
});

for (const mode of ['fixture', 'local', '']) test(`non-provider live mode ${JSON.stringify(mode)} blocks before build`, async () => {
  let calls = 0;
  await assert.rejects(() => main([], {
    environment: { LOCALLY_ISR_BRIDGE_SOURCE: mode },
    runCommand: () => { calls++; },
    runBridgeProofFreshness: async () => { calls++; },
    log: () => { calls++; },
  }), /OPENNEXT_REVALIDATION_BRIDGE_FIXTURE_DEPLOY_FORBIDDEN/);
  assert.equal(calls, 0);
});
