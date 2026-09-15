import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildSourceScopes,
  fetchAllExperienceRows,
  listAllStorageObjects,
} from './audit-public-experience-media.mjs';
import {
  buildExperienceLocatorMigrationPlan,
} from './experience-media-source-migration.mjs';
import { fetchBoundedSource } from './recover-public-experience-media.mjs';
import { buildOriginalKey, sha256, stableJson } from './plan-public-experience-media-repair.mjs';

const PROJECT_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const R2_BASE = 'https://media-canary.locally-travel.com';
const MAX_OBJECTS = 700;
const MAX_BYTES = 300 * 1024 * 1024;

function storageBackupIdentity(key) {
  return createHash('sha256').update(`experiences\0${key}`).digest('hex');
}

async function fetchR2(key) {
  const response = await fetch(`${R2_BASE}/${key}`, { redirect: 'manual' });
  if (response.status === 404) return null;
  if (response.status >= 300 && response.status < 400) throw new Error('R2 source redirect rejected.');
  if (!response.ok) throw new Error(`R2 source GET failed: HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, contentType: String(response.headers.get('content-type') || '').split(';', 1)[0].toLowerCase() };
}

export async function buildCutoverProof({ rows, storageObjects, baselineManifest, fetchSource, fetchR2Object }) {
  if (baselineManifest?.schema !== 'locally.supabase-storage-snapshot.v1' || baselineManifest.status !== 'complete') {
    throw new Error('A complete encrypted Storage baseline manifest is required.');
  }
  const baseline = new Map(baselineManifest.objects.filter((item) => item.bucket === 'experiences').map((item) => [item.identity, item]));
  const source = buildSourceScopes(rows, storageObjects, PROJECT_URL);
  if (source.sourceScopes.allDbReferenced.missingObjectCount || source.sourceScopes.allDbReferenced.invalidReferenceCount) {
    throw new Error('Current experience source graph is incomplete.');
  }
  const storage = new Map(storageObjects.map((item) => [item.key, item]));
  const keys = [...source.allDbReferencedKeys].sort();
  if (keys.length > MAX_OBJECTS || keys.reduce((sum, key) => sum + storage.get(key).size, 0) > MAX_BYTES) {
    throw new Error('Cutover proof ceiling exceeded.');
  }
  const proofs = [];
  const missingR2 = [];
  let sourceBytes = 0;
  let r2Bytes = 0;
  for (const sourceKey of keys) {
    const metadata = storage.get(sourceKey);
    const downloaded = await fetchSource({ sourceKey });
    sourceBytes += downloaded.bytes.length;
    if (downloaded.bytes.length !== metadata.size || downloaded.contentType !== metadata.contentType) {
      throw new Error('Current source metadata/byte mismatch.');
    }
    const sourceByteSha256 = sha256(downloaded.bytes);
    const backup = baseline.get(storageBackupIdentity(sourceKey));
    const backupExact = backup?.sourceSha256 === sourceByteSha256 && backup?.size === downloaded.bytes.length;
    const r2Key = buildOriginalKey(sourceKey, sourceByteSha256, downloaded.contentType);
    const r2 = await fetchR2Object(r2Key);
    if (!r2) {
      missingR2.push({ sourceKeySha256: sha256(sourceKey), sourceByteSha256, sourceSize: downloaded.bytes.length, contentType: downloaded.contentType, r2Key, backupExact });
      continue;
    }
    r2Bytes += r2.bytes.length;
    const r2ByteSha256 = sha256(r2.bytes);
    if (r2.bytes.length !== downloaded.bytes.length || r2ByteSha256 !== sourceByteSha256 || r2.contentType !== downloaded.contentType) {
      throw new Error('R2 authoritative original conflicts with current source bytes.');
    }
    const sourceUrl = `${PROJECT_URL}/storage/v1/object/public/experiences/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
    proofs.push({ sourceUrl, r2Key, sourceByteSha256, r2ByteSha256, sourceSize: downloaded.bytes.length, r2Size: r2.bytes.length, backupExact });
  }
  return {
    source,
    proofs,
    missingR2,
    sourceBytes,
    r2Bytes,
    backupExactCount: [...proofs, ...missingR2].filter((item) => item.backupExact).length,
    baselineRecoverableUntil: baselineManifest.recoverableUntil,
  };
}

function args(argv) {
  const values = Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('='); return [key, rest.join('=') || 'true'];
  }));
  return { baseline: values['baseline-manifest'] && path.resolve(values['baseline-manifest']), output: path.resolve(values.output || '.tmp/experience-media-cutover-proof') };
}

async function main() {
  const input = args(process.argv.slice(2));
  if (!input.baseline) throw new Error('--baseline-manifest is required.');
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (baseUrl !== PROJECT_URL || !anonKey) throw new Error('Exact Production Supabase read configuration is required.');
  await mkdir(input.output, { recursive: true, mode: 0o700 });
  const [rows, storageObjects, baselineManifest] = await Promise.all([
    fetchAllExperienceRows(baseUrl, anonKey), listAllStorageObjects(baseUrl, anonKey), readFile(input.baseline, 'utf8').then(JSON.parse),
  ]);
  const result = await buildCutoverProof({
    rows, storageObjects, baselineManifest,
    fetchSource: (source) => fetchBoundedSource(baseUrl, anonKey, source.sourceKey),
    fetchR2Object: fetchR2,
  });
  const proofPath = path.join(input.output, '.source-proof.json');
  const privateProof = { rows, storageObjects, proofs: result.proofs, missingR2: result.missingR2, baselineRecoverableUntil: result.baselineRecoverableUntil };
  await writeFile(proofPath, stableJson(privateProof), { mode: 0o600 }); await chmod(proofPath, 0o600);
  let locatorPlan = null;
  if (result.missingR2.length === 0) {
    locatorPlan = buildExperienceLocatorMigrationPlan({ rows, proofs: result.proofs, createdAt: new Date().toISOString() });
    await writeFile(path.join(input.output, '.locator-plan.json'), stableJson(locatorPlan), { mode: 0o600 });
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    currentRows: rows.length,
    currentReferencedObjects: result.source.sourceScopes.allDbReferenced.distinctObjectCount,
    currentReferencedBytes: result.source.sourceScopes.allDbReferenced.referencedBytes,
    storageObjects: result.source.sourceScopes.storageAll.objectCount,
    storageBytes: result.source.sourceScopes.storageAll.bytes,
    sourceGets: result.proofs.length + result.missingR2.length,
    sourceBytes: result.sourceBytes,
    r2Gets: result.proofs.length,
    r2Bytes: result.r2Bytes,
    r2Exact: result.proofs.length,
    r2Missing: result.missingR2.length,
    conflicts: 0,
    backupExact: result.backupExactCount,
    backupMissingOrChanged: result.proofs.length + result.missingR2.length - result.backupExactCount,
    baselineRecoverableUntil: result.baselineRecoverableUntil,
    locatorPlanDigest: locatorPlan?.planDigest || null,
  };
  await writeFile(path.join(input.output, 'summary.json'), stableJson(summary));
  console.log(stableJson(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
