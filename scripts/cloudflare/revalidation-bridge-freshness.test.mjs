import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertProductionBridgeProofFresh } from './revalidation-bridge-freshness.mjs';
import { versionProvider, artifactDigest, stableId, deploymentId } from './active-version-artifact.fixture.mjs';
import { main } from './run-production-deploy.mjs';

const BASELINE = 'OPENNEXT_REVALIDATION_BRIDGE_BASELINE_CHANGED_BEFORE_DEPLOY';
const LINEAGE = 'OPENNEXT_REVALIDATION_BRIDGE_LINEAGE_MISMATCH';
const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
const source = 'export default {};';
const proof = () => ({ kind: 'provider', sourceKind: 'workers-version-modules', artifactSha256: artifactDigest(source), deploymentId, versionId: stableId, etag: 'a'.repeat(64), compatSha256: 'b'.repeat(64) });
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
        // Changes are observed by the final source/metadata recheck below.
      },
      runBridgeProofFreshness: async () => {
        events.push('freshness');
        await assertProductionBridgeProofFresh({ root, credentials: { accountId: 'fixture-account', apiToken: secret },
          fetchImplementation: (() => {
            const provider = versionProvider(source, change);
            return async (url, options) => {
              assert.equal(options.headers.Authorization, `Bearer ${secret}`);
              requests.push(url);
              events.push(url.endsWith('/deployments') ? 'deployment-get' : url.includes('?include=modules') ? 'modules-get' : 'version-get');
              return provider.fetch(url, options);
            };
          })(),
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
  assert.deepEqual(r.events, ['build', 'semantic', 'pre-smoke', 'freshness', 'deployment-get', 'version-get', 'modules-get', 'version-get', 'deployment-get', 'deploy', 'post-smoke']);
  assert.equal(r.requests.length, 5);
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
  ['legacy script-content proof', { proof: p => { p.sourceKind = 'script-content'; } }],
  ['artifact digest mismatch', { proof: p => { p.artifactSha256 = 'c'.repeat(64); } }],
  ['lineage mismatch', { proof: p => { p.compatSha256 = 'c'.repeat(64); } }, LINEAGE],
  ['malformed policy fingerprint', { policy: p => { p.compatTokenSha256 = secret; } }, LINEAGE],
  ['malformed proof JSON redacted', { raw: secret }],
  ['missing proof', { missing: true }],
  ['raw token field rejected without logging', { proof: p => { p.token = secret; } }],
  ['unexpected raw credential in optional field', { proof: p => { p.currentSha256 = secret; } }],
  ['provider exception redacted', { transportError: true }],
  ['provider unsuccessful response', { apiFailure: true }],
  ['provider HTTP failure', { httpFailure: true }],
  ...['deploymentId', 'versionId', 'etag', 'compatSha256', 'sourceKind', 'artifactSha256'].flatMap(key => [
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

test('old ETag-only attestation must be regenerated, never silently upgraded', async t => {
  const r=await exercise(t,{proof:p=>{delete p.sourceKind;delete p.artifactSha256;p.etagMatch=true;}});
  assert.equal(r.error?.message,BASELINE);assert(!r.events.includes('deploy'));
});
test('source bytes changing under the same version identity block final deploy', async t => {
  const r=await exercise(t,{scoped:v=>{v.modules[0].content_base64=Buffer.from('export default { changed: true };').toString('base64');}});
  assert.equal(r.error?.message,BASELINE);assert(!r.events.includes('deploy'));
});
