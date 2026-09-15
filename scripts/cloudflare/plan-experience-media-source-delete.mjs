import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { listAllStorageObjects } from './audit-public-experience-media.mjs';
import {
  buildExperienceDeletePlan,
  parseLegacyExperienceSourceUrl,
  sha256,
} from './experience-media-source-migration.mjs';
import { stableJson } from './plan-public-experience-media-repair.mjs';

const PROJECT_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';

function collectUrls(value) {
  if (typeof value === 'string') return value.startsWith(`${PROJECT_URL}/storage/v1/object/public/experiences/`) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectUrls);
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(collectUrls);
}

export function buildDeleteCandidatePlan({ sourceProof, liveRows, storageObjects, historicalKeys = [], experienceId, createdAt }) {
  const legacyLive = new Set(liveRows.flatMap((row) => collectUrls({
    photos: row.photos, image_url: row.image_url, itinerary: row.itinerary, itinerary_i18n: row.itinerary_i18n,
  })).map((url) => parseLegacyExperienceSourceUrl(url).key));
  assert.equal(legacyLive.size, 0, 'Live Supabase experience locators remain.');
  const historical = new Set(historicalKeys);
  const storage = new Map(storageObjects.map((item) => [item.key, item]));
  const selectedUrls = experienceId
    ? new Set(sourceProof.rows.filter((row) => String(row.id) === String(experienceId)).flatMap((row) => collectUrls(row)))
    : null;
  if (experienceId) assert(selectedUrls.size > 0, 'Deletion canary experience has no approved legacy sources.');
  const objects = [];
  for (const proof of sourceProof.proofs) {
    if (selectedUrls && !selectedUrls.has(proof.sourceUrl)) continue;
    const source = parseLegacyExperienceSourceUrl(proof.sourceUrl);
    if (historical.has(source.key)) continue;
    const current = storage.get(source.key);
    if (!current) continue;
    assert(proof.backupExact === true, 'Encrypted baseline proof is required.');
    assert.equal(proof.sourceSize, current.size, 'Current Storage size drifted from source proof.');
    assert.equal(proof.sourceByteSha256, proof.r2ByteSha256, 'R2 authoritative proof is not exact.');
    objects.push({
      name: source.key,
      size: current.size,
      contentType: current.contentType,
      sourceByteSha256: proof.sourceByteSha256,
      currentDbRefCount: 0,
      r2Exact: true,
      backupExact: true,
      classification: 'referenced-migrated',
      deleteReason: 'live locator migrated and current R2 plus encrypted baseline proofs are exact',
      sourceIdentitySha256: sha256(source.key),
    });
  }
  assert(objects.length > 0, 'No proof-complete deletion candidates selected.');
  return buildExperienceDeletePlan({ objects, createdAt });
}

function parseArgs(argv) {
  const values = Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('='); return [key, rest.join('=') || 'true'];
  }));
  return {
    proof: values['source-proof'] && path.resolve(values['source-proof']),
    historical: values['historical-keys'] && path.resolve(values['historical-keys']),
    experienceId: values['experience-id'],
    output: path.resolve(values.output || '.tmp/experience-media-delete-plan.json'),
  };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (!input.proof || !input.historical) throw new Error('--source-proof and --historical-keys are required.');
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (baseUrl !== PROJECT_URL || !serviceRole) throw new Error('Exact Production service-role configuration is required.');
  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` };
  const response = await fetch(`${baseUrl}/rest/v1/experiences?select=id,photos,image_url,itinerary,itinerary_i18n`, { headers, redirect: 'manual' });
  if (!response.ok) throw new Error(`Live locator inventory failed: HTTP ${response.status}.`);
  const [sourceProof, historicalKeys, storageObjects, liveRows] = await Promise.all([
    readFile(input.proof, 'utf8').then(JSON.parse),
    readFile(input.historical, 'utf8').then(JSON.parse),
    listAllStorageObjects(baseUrl, serviceRole),
    response.json(),
  ]);
  const plan = buildDeleteCandidatePlan({ sourceProof, historicalKeys, storageObjects, liveRows, experienceId: input.experienceId, createdAt: new Date().toISOString() });
  await writeFile(input.output, stableJson(plan), { mode: 0o600 }); await chmod(input.output, 0o600);
  console.log(stableJson({ planDigest: plan.planDigest, objects: plan.objects.length, bytes: plan.objects.reduce((sum, item) => sum + item.size, 0) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
