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
  fetchBoundedSource,
} from './recover-public-experience-media.mjs';
import {
  buildOriginalKey,
  sha256,
  stableJson,
} from './plan-public-experience-media-repair.mjs';

export const SOURCE_COPY_SCHEMA = 'locally.experience-media-source-copy.v1';
export const SOURCE_COPY_MAX_OBJECTS = 50;
export const SOURCE_COPY_MAX_BYTES = 256 * 1024 * 1024;
const PROJECT_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';

function digest(value) {
  return sha256(stableJson(value));
}

function metadataExact(candidate, source) {
  const metadata = candidate?.customMetadata || {};
  return candidate?.size === source.storage.size
    && candidate?.contentType === source.storage.contentType
    && candidate?.cacheControl === 'public, max-age=31536000, immutable'
    && metadata.source_key_sha256 === source.sourceKeySha256
    && /^[0-9a-f]{64}$/.test(metadata.source_byte_sha256 || '')
    && metadata.source_byte_sha256 === metadata.output_byte_sha256
    && metadata.source_size === String(source.storage.size);
}

export function buildAllReferencedInventory(rows, storageObjects) {
  const source = buildSourceScopes(rows, storageObjects, PROJECT_URL);
  if (source.sourceScopes.allDbReferenced.missingObjectCount !== 0
      || source.sourceScopes.allDbReferenced.invalidReferenceCount !== 0) {
    throw new Error('All referenced experience sources must resolve before source copy.');
  }
  const storage = new Map(storageObjects.map((item) => [item.key, item]));
  const sources = [...source.allDbReferencedKeys].sort().map((sourceKey) => ({
    sourceKey,
    sourceKeySha256: sha256(sourceKey),
    storage: storage.get(sourceKey),
  }));
  const snapshot = {
    identitySetDigest: source.sourceScopes.allDbReferenced.identitySetDigest,
    sources: sources.map((item) => ({
      sourceKeySha256: item.sourceKeySha256,
      size: item.storage.size,
      contentType: item.storage.contentType,
      etag: item.storage.etag,
    })),
  };
  return { sources, sourceSnapshotDigest: digest(snapshot), sourceScopes: source.sourceScopes };
}

export async function buildSourceCopyPlan({ inventory, r2Inspection, fetchSource, outputDirectory }) {
  const bySource = r2Inspection?.originalsBySourceKeySha256 || {};
  const gaps = [];
  const conflicts = [];
  let existingExact = 0;
  for (const source of inventory.sources) {
    const candidates = bySource[source.sourceKeySha256] || [];
    const exact = candidates.filter((candidate) => metadataExact(candidate, source));
    if (exact.length === 1) existingExact += 1;
    else if (exact.length > 1 || candidates.length > 0) conflicts.push(source.sourceKeySha256);
    else gaps.push(source);
  }
  if (conflicts.length > 0) throw new Error(`R2 source conflict count: ${conflicts.length}.`);
  if (gaps.length > SOURCE_COPY_MAX_OBJECTS) throw new Error('Source-copy object ceiling exceeded.');
  const plannedMetadataBytes = gaps.reduce((sum, item) => sum + item.storage.size, 0);
  if (plannedMetadataBytes > SOURCE_COPY_MAX_BYTES) throw new Error('Source-copy byte ceiling exceeded.');

  await mkdir(path.join(outputDirectory, 'objects'), { recursive: true, mode: 0o700 });
  const originals = [];
  let receivedBytes = 0;
  for (const source of gaps) {
    const downloaded = await fetchSource(source);
    receivedBytes += downloaded.bytes.length;
    if (receivedBytes > SOURCE_COPY_MAX_BYTES) throw new Error('Source-copy received-byte ceiling exceeded.');
    if (downloaded.bytes.length !== source.storage.size || downloaded.contentType !== source.storage.contentType) {
      throw new Error('Source changed while preparing copy plan.');
    }
    const sourceByteSha256 = sha256(downloaded.bytes);
    const key = buildOriginalKey(source.sourceKey, sourceByteSha256, downloaded.contentType);
    const relativePath = `objects/${source.sourceKeySha256}-${sourceByteSha256}`;
    await writeFile(path.join(outputDirectory, relativePath), downloaded.bytes, { mode: 0o600 });
    originals.push({
      key,
      path: relativePath,
      bytes: downloaded.bytes.length,
      sha256: sourceByteSha256,
      contentType: downloaded.contentType,
      sourceKeySha256: source.sourceKeySha256,
      sourceByteSha256,
      sourceSize: downloaded.bytes.length,
    });
  }
  const execution = {
    schema: SOURCE_COPY_SCHEMA,
    scope: {
      source: 'supabase-all-current-referenced-experiences',
      projectRef: 'uhinvcydgzqlpnvieyal',
      destinationBucket: 'locally-public-experience-canary',
      writeMode: 'conditional-create-only',
    },
    sourceSnapshotDigest: inventory.sourceSnapshotDigest,
    limits: { maxObjects: SOURCE_COPY_MAX_OBJECTS, maxBytes: SOURCE_COPY_MAX_BYTES },
    originals,
  };
  return {
    execution,
    generatedAt: new Date().toISOString(),
    planDigest: digest(execution),
    summary: {
      referencedSources: inventory.sources.length,
      existingExact,
      missing: originals.length,
      conflicts: 0,
      sourceGets: originals.length,
      sourceBytes: receivedBytes,
      plannedConditionalPuts: originals.length,
    },
  };
}

function args(argv) {
  const values = Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('=');
    return [key, rest.join('=') || 'true'];
  }));
  return {
    inspection: values['r2-inspection'] && path.resolve(values['r2-inspection']),
    output: path.resolve(values.output || '.tmp/experience-media-source-copy'),
  };
}

async function main() {
  const input = args(process.argv.slice(2));
  if (!input.inspection) throw new Error('--r2-inspection is required.');
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (baseUrl !== PROJECT_URL || !anonKey) throw new Error('Exact Production Supabase read configuration is required.');
  await mkdir(input.output, { recursive: true, mode: 0o700 });
  const [rows, storageObjects, inspection] = await Promise.all([
    fetchAllExperienceRows(baseUrl, anonKey),
    listAllStorageObjects(baseUrl, anonKey),
    readFile(input.inspection, 'utf8').then(JSON.parse),
  ]);
  const inventory = buildAllReferencedInventory(rows, storageObjects);
  const plan = await buildSourceCopyPlan({
    inventory,
    r2Inspection: inspection,
    outputDirectory: input.output,
    fetchSource: (source) => fetchBoundedSource(baseUrl, anonKey, source.sourceKey),
  });
  const privatePlan = path.join(input.output, '.source-copy-plan.json');
  await writeFile(privatePlan, stableJson(plan), { mode: 0o600 });
  await chmod(privatePlan, 0o600);
  const safe = { schema: SOURCE_COPY_SCHEMA, planDigest: plan.planDigest, sourceSnapshotDigest: inventory.sourceSnapshotDigest, ...plan.summary };
  await writeFile(path.join(input.output, 'source-copy-summary.json'), stableJson(safe));
  console.log(stableJson(safe));
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `plan_digest=${plan.planDigest}\nplanned_writes=${plan.execution.originals.length}\n`, { flag: 'a' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
