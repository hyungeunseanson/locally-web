import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCandidateReadTransport } from '../candidate-read-transport.mjs';
import { versionOverrideHeader } from '../candidate-release-contract.mjs';
const directory = 'scripts/cloudflare/f02-release-validation-fixture', root = '.wrangler/f02-pr212-final-validation';
const digest = b => createHash('sha256').update(b).digest('hex');
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function assertAttestation(a) {
  assert.equal(a.origin, 'https://www.locally-travel.com'); assert.equal(a.workerName, 'locally-web-opennext-production');
  assert(uuid.test(a.baselineVersion) && uuid.test(a.candidateVersion) && a.baselineVersion !== a.candidateVersion);
  assert(/^[a-f0-9]{40}$/.test(a.applicationSource) && /^[a-f0-9]{64}$/.test(a.artifactSHA256));
  assert.equal(a.noProductionCredentials, true); assert.equal(a.promotionAuthorized, false);
  for (const rows of [a.candidateAssets, a.baselineAssets]) {
    assert(rows.length > 0); const paths = new Set();
    for (const row of rows) {
      assert(/^\/_next\/static\/[a-zA-Z0-9_.\/-]+$/.test(row.pathname) && !row.pathname.split('/').includes('..'));
      assert(/^[a-f0-9]{64}$/.test(row.sha256) && Number.isSafeInteger(row.bytes) && row.bytes > 0);
      assert(!paths.has(row.pathname)); paths.add(row.pathname);
    }
  }
  for (const url of a.publicExpected.urls) {
    const u = new URL(url); assert(u.origin === a.origin && !u.search && !u.hash && !u.username && !u.password);
    assert(!/^\/(?:api|admin|account|login)(?:\/|$)/.test(u.pathname));
  }
}
export async function readExactAsset(transport, a, versionId, row) {
  assert([a.baselineVersion, a.candidateVersion].includes(versionId));
  const response = await transport.fetch(a.origin + row.pathname, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Cloudflare-Workers-Version-Overrides': versionOverrideHeader(a.workerName, versionId) } });
  assert.equal(response.status, 200); assert.equal(response.redirected, false);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.length, row.bytes); assert.equal(digest(bytes), row.sha256);
  return bytes;
}
async function prepare() {
  const a = JSON.parse(await readFile(directory + '/public-attestation.json', 'utf8')); assertAttestation(a);
  // This job receives no Production secrets. Abort if an ambient credential was
  // accidentally injected; public version overrides never need those scopes.
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ACCESS_TOKEN']) assert(!process.env[key], 'Production credential must not enter this fixture');
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim(), head = git(['rev-parse', 'HEAD']), main = git(['rev-parse', 'origin/main']);
  const merged = process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main';
  if (merged) assert.equal(head, main);
  const changes = git(['diff', '--name-only', a.applicationSource, head]).split('\n').filter(Boolean);
  assert(changes.every(p => /^(?:scripts\/cloudflare\/|docs\/cloudflare\/|\.github\/workflows\/)/.test(p)), 'Application/runtime source must remain exact');
  for (const [path, sha] of Object.entries(a.protectedSourceSHA256)) assert.equal(digest(await readFile(path)), sha);
  await mkdir(root + '/evidence', { recursive: true }); await mkdir(root + '/internal', { recursive: true });
  for (const file of ['browser.mjs', 'host-evidence.mjs', 'recorder.mjs', 'rsc-fixture.mjs', 'asset-trace.mjs', 'community-view-fixture.mjs', 'epoch.py']) await copyFile(directory + '/' + file, root + '/' + file);
  const source = { main, validationHead: head, applicationArtifactSource: a.applicationSource, artifact: a.artifactSHA256, protectedSourceSHA256: a.protectedSourceSHA256, officialPreflight: 'ci-final-preflight.json', promotionAuthorized: false };
  await writeFile(root + '/source.json', JSON.stringify(source, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(root + '/candidate.json', JSON.stringify({ versionId: a.candidateVersion, mainSha: a.applicationSource, bundleSha256: a.artifactSHA256 }), { flag: 'wx', mode: 0o600 });
  await writeFile(root + '/evidence/expected.json', JSON.stringify(a.publicExpected), { flag: 'wx', mode: 0o600 });
  const gateFiles = ['candidate-cache-revalidation.mjs', 'candidate-cache-revalidation-font.mjs', 'candidate-coverage-owner.mjs', 'candidate-read-transport.mjs', 'candidate-release-contract.mjs', 'run-candidate-browser-smoke.mjs', 'run-production-browser-smoke.mjs', 'verify-pinned-release-browser.mjs'];
  const gateSource = {};
  for (const file of gateFiles) { const path = 'scripts/cloudflare/' + file; gateSource[path] = digest(await readFile(path)); }
  await writeFile(root + '/evidence/merged-final-gate-source.json', JSON.stringify(gateSource, null, 2), { flag: 'wx', mode: 0o600 });
  const transport = createCandidateReadTransport(a.origin), receipts = [], baselineRows = [];
  try {
    for (const versionId of [a.baselineVersion, a.candidateVersion]) {
      const probe = await transport.fetch(a.origin + '/.well-known/locally-release', { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'X-Locally-Release-Probe': '1', 'Cloudflare-Workers-Version-Overrides': versionOverrideHeader(a.workerName, versionId) } });
      assert.equal(probe.status, 204); assert.equal(probe.headers.get('x-locally-worker-version'), versionId);
      const rows = versionId === a.baselineVersion ? a.baselineAssets : a.candidateAssets;
      // Four fixed workers, one read per asset, immutable attested byte/hash proof.
      let index = 0;
      await Promise.all(Array.from({ length: 4 }, async () => { while (index < rows.length) {
        const row = rows[index++], bytes = await readExactAsset(transport, a, versionId, row);
        const file = versionId === a.baselineVersion ? root + '/internal/baseline-assets/' + row.sha256 : '.open-next/assets' + row.pathname;
        await mkdir(file.substring(0, file.lastIndexOf('/')), { recursive: true }); await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
        receipts.push({ versionId, ...row, status: 200, hashMatch: true, retry: 0 });
        if (versionId === a.baselineVersion) baselineRows.push({ ...row, file, verdict: 'PASS' });
      } }));
    }
  } finally { await transport.close(); await writeFile(root + '/evidence/ci-asset-acquisition.json', JSON.stringify({ rows: receipts, dns: transport.receipts(), productionMutation: 0, artifactSHA256: a.artifactSHA256 }), { flag: 'wx', mode: 0o600 }); }
  await writeFile(root + '/evidence/baseline-fixture-complete.json', JSON.stringify({ versionId: a.baselineVersion, rows: baselineRows }), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ head, main, merged, assetReads: receipts.length, baselineVersion: a.baselineVersion, candidateVersion: a.candidateVersion, credentialForwarding: 0, promotion: 0 }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepare();
