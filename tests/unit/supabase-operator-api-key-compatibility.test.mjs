import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { buildDeleteCandidatePlan } from '../../scripts/cloudflare/plan-experience-media-source-delete.mjs';
import { buildExperienceLocatorMigrationPlan, parseLegacyExperienceSourceUrl } from '../../scripts/cloudflare/experience-media-source-migration.mjs';
import { LEGACY_SERVICE_KEY, MODERN_SECRET_KEY } from '../fixtures/supabaseApiKeys.mjs';

const PROJECT_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const objectKey = 'experience/fixture-user/hero/a.jpg';
const sourceUrl = PROJECT_URL + '/storage/v1/object/public/experiences/' + objectKey;
const body = Buffer.from('fixture-object-bytes');
const byteSha = createHash('sha256').update(body).digest('hex');
const sourceKeySha = parseLegacyExperienceSourceUrl(sourceUrl).sourceKeySha256;
const proof = {
  sourceUrl, sourceSize: body.length, r2Size: body.length,
  sourceByteSha256: byteSha, r2ByteSha256: byteSha, backupExact: true,
  r2Key: 'originals/v1/' + sourceKeySha.slice(0, 2) + '/' + sourceKeySha + '/' + byteSha + '.jpg',
};
const row = { id: 42, photos: [sourceUrl], image_url: null, itinerary: [], itinerary_i18n: null };
const locatorPlan = buildExperienceLocatorMigrationPlan({ rows: [row], proofs: [proof], createdAt: 'fixture' });
const deletePlan = buildDeleteCandidatePlan({
  sourceProof: { rows: [row], proofs: [proof] }, liveRows: [],
  storageObjects: [{ key: objectKey, size: body.length, contentType: 'image/jpeg' }],
  historicalKeys: [], createdAt: 'fixture',
});

// Child processes cannot make real HTTP calls: every fetch is replaced, and
// unexpected origins/routes fail closed. Only credential-free checks are logged.
const preloadSource = [
  "import { readFileSync } from 'node:fs';",
  "const state = JSON.parse(readFileSync(process.env.PHASE1_FIXTURE_STATE, 'utf8'));",
  "let changed = false;",
  "globalThis.fetch = async (input, init = {}) => {",
  "  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);",
  "  if (url.origin !== state.origin) throw new Error('fixture_network_forbidden');",
  "  const method = init.method || input.method || 'GET';",
  "  const headers = new Headers(init.headers || input.headers);",
  "  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;",
  "  if (headers.get('apikey') !== key) throw new Error('fixture_apikey_contract_failed');",
  "  if (method !== 'DELETE' && headers.get('authorization') !== (key.startsWith('sb_') ? null : 'Bearer ' + key)) throw new Error('fixture_bearer_contract_failed');",
  "  console.log(JSON.stringify({fixtureHttpChecked: true, method, direct: method !== 'DELETE'}));",
  "  if (state.failTransport) throw new Error('provider echoed ' + key);",
  "  if (url.pathname === '/rest/v1/experiences') return Response.json(state.mode === 'locator' ? [changed ? state.after : state.before] : []);",
  "  if (url.pathname === '/rest/v1/rpc/apply_experience_media_locator_cas' && method === 'POST') { changed = true; return Response.json('updated'); }",
  "  if (url.pathname === '/storage/v1/object/list/experiences' && method === 'POST') return Response.json(changed ? [] : [{id: 'fixture-object', name: state.objectKey, metadata: {size: state.size, mimetype: 'image/jpeg'}}]);",
  "  if (url.pathname === '/storage/v1/object/authenticated/experiences/' + state.objectKey && method === 'GET') return new Response(Buffer.from(state.bodyBase64, 'base64'));",
  "  if (url.pathname === '/storage/v1/object/experiences' && method === 'DELETE') { changed = true; return Response.json([{name: state.objectKey}]); }",
  "  throw new Error('fixture_route_forbidden');",
  "};",
].join('\n');

async function runFixtureCli(directory, key, script, args, state) {
  const preload = path.join(directory, 'preload.mjs');
  const statePath = path.join(directory, 'state.json');
  await writeFile(preload, preloadSource);
  await writeFile(statePath, JSON.stringify({
    origin: PROJECT_URL, objectKey, size: body.length, bodyBase64: body.toString('base64'),
    before: row, after: { id: row.id, ...locatorPlan.changes[0].after }, ...state,
  }));
  const result = spawnSync(process.execPath, ['--import', preload, script, ...args], {
    cwd: process.cwd(), encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      NEXT_PUBLIC_SUPABASE_URL: PROJECT_URL,
      SUPABASE_SERVICE_ROLE_KEY: key,
      PHASE1_FIXTURE_STATE: statePath,
    },
  });
  assert.equal(result.error, undefined);
  assert.equal((result.stdout + result.stderr).includes(key), false);
  return result;
}

test('real source-delete plan/apply and locator apply CLIs use either credential without network access', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locally-api-key-contract-'));
  try {
    const proofPath = path.join(directory, 'proof.json');
    const historyPath = path.join(directory, 'history.json');
    const deletePath = path.join(directory, 'delete.json');
    const locatorPath = path.join(directory, 'locator.json');
    await writeFile(proofPath, JSON.stringify({ rows: [row], proofs: [proof] }));
    await writeFile(historyPath, '[]');
    await writeFile(deletePath, JSON.stringify(deletePlan));
    await writeFile(locatorPath, JSON.stringify(locatorPlan));
    for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY]) {
      const plannedPath = path.join(directory, 'planned.json');
      const planned = await runFixtureCli(directory, key, 'scripts/cloudflare/plan-experience-media-source-delete.mjs', [
        '--source-proof=' + proofPath, '--historical-keys=' + historyPath, '--output=' + plannedPath,
      ], { mode: 'delete' });
      assert.equal(planned.status, 0, planned.stderr);
      assert.equal(JSON.parse(await readFile(plannedPath, 'utf8')).objects.length, 1);

      const applied = await runFixtureCli(directory, key, 'scripts/cloudflare/apply-experience-media-source-delete.mjs', [
        '--plan=' + deletePath, '--confirm-digest=' + deletePlan.planDigest, '--apply=true',
        '--output=' + path.join(directory, 'deleted.json'),
      ], { mode: 'delete' });
      assert.equal(applied.status, 0, applied.stderr);
      assert.equal(JSON.parse(await readFile(path.join(directory, 'deleted.json'), 'utf8')).absentVerified, 1);

      const located = await runFixtureCli(directory, key, 'scripts/cloudflare/apply-experience-media-locator-plan.mjs', [
        '--plan=' + locatorPath, '--confirm-digest=' + locatorPlan.planDigest, '--apply=true',
        '--output=' + path.join(directory, 'located.json'),
      ], { mode: 'locator' });
      assert.equal(located.status, 0, located.stderr);
      assert.equal(JSON.parse(await readFile(path.join(directory, 'located.json'), 'utf8')).verified, 1);
      for (const result of [planned, applied, located]) {
        assert(result.stdout.includes('"fixtureHttpChecked":true'));
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('operator CLI error output never echoes credential-bearing transport exceptions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locally-api-key-error-contract-'));
  try {
    for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY]) {
      const result = await runFixtureCli(directory, key, 'scripts/cloudflare/plan-experience-media-source-delete.mjs', [
        '--source-proof=unused-fixture', '--historical-keys=unused-fixture',
      ], { failTransport: true });
      assert.equal(result.status, 1);
      assert(result.stderr.includes('supabase_request_transport_failed'));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
