import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildManifestAudit,
  buildSourceScopes,
  fetchAllExperienceRows,
  hashIdentity,
  listAllStorageObjects,
  normalizeSupabaseExperienceObjectKey,
  sanitizeReport,
} from './audit-public-experience-media.mjs';
import {
  buildExpectedManifests,
  buildSpecifications,
  parseCardManifest,
} from './reconcile-public-experience-images.mjs';

const PRODUCTION_PROJECT_REF = 'uhinvcydgzqlpnvieyal';
const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const EXPERIENCE_BUCKET = 'experiences';
const CARD_MANIFEST_PATH = path.resolve('app/data/publicExperienceCardImages.ts');
const DETAIL_MANIFEST_PATH = path.resolve('app/data/publicExperienceDetailImages.generated.json');
const DEFAULT_OUTPUT = path.resolve('.tmp/public-experience-media-repair');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseArgs(argv = process.argv.slice(2)) {
  const [command = 'plan', ...rest] = argv;
  if (!['plan', 'verify-source'].includes(command)) throw new Error('Command must be plan or verify-source.');
  const values = Object.fromEntries(rest.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...parts] = value.slice(2).split('=');
    return [key, parts.join('=') || 'true'];
  }));
  return {
    command,
    output: path.resolve(values.output || DEFAULT_OUTPUT),
    sourcePlan: values['source-plan'] ? path.resolve(values['source-plan']) : null,
  };
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function normalizeContentType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

export function extensionForContentType(contentType) {
  const extensions = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensions[normalizeContentType(contentType)];
  if (!extension) throw new Error(`Unsupported public-active source content type: ${normalizeContentType(contentType) || 'missing'}`);
  return extension;
}

export function buildOriginalKey(sourceKey, sourceByteSha256, contentType) {
  const sourceKeySha256 = sha256(sourceKey);
  if (!/^[0-9a-f]{64}$/.test(sourceByteSha256)) throw new Error('Invalid source byte SHA-256.');
  return `originals/v1/${sourceKeySha256.slice(0, 2)}/${sourceKeySha256}/${sourceByteSha256}.${extensionForContentType(contentType)}`;
}

function sourceUrlForKey(baseUrl, sourceKey) {
  return `${baseUrl}/storage/v1/object/public/${EXPERIENCE_BUCKET}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
}

async function downloadSource(baseUrl, anonKey, sourceKey) {
  const response = await fetch(sourceUrlForKey(baseUrl, sourceKey), {
    method: 'GET',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!response.ok) throw new Error(`Source GET failed: HTTP ${response.status}; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`Source GET returned empty bytes; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
  return {
    bytes,
    contentType: normalizeContentType(response.headers.get('content-type')),
    etag: String(response.headers.get('etag') || '').replace(/^"|"$/g, ''),
  };
}

function mapSourceUrls(inventory, baseUrl) {
  const result = new Map();
  for (const experience of inventory) {
    for (const value of [...experience.heroUrls, ...experience.detailUrls]) {
      const key = normalizeSupabaseExperienceObjectKey(value, baseUrl);
      if (!key) throw new Error('Public-active inventory contains an invalid source reference.');
      result.set(key, value);
    }
  }
  return result;
}

function buildSnapshotPayload(sourceObjects, manifest) {
  return {
    sources: sourceObjects.map((item) => ({
      sourceKey: item.sourceKey,
      sourceKeySha256: item.sourceKeySha256,
      sourceByteSha256: item.sourceByteSha256,
      sourceSize: item.sourceSize,
      contentType: item.contentType,
      storageEtag: item.storageEtag,
    })),
    derivatives: manifest.r2Plan.expected.map((item) => ({
      key: item.key,
      kind: item.kind,
      sourceKeySha256: item.sourceKeySha256,
      width: item.width,
      quality: item.quality,
      format: item.format,
    })),
  };
}

async function createSourcePlan(outputDirectory, { writeCache }) {
  const baseUrl = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = requireEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (baseUrl !== PRODUCTION_SUPABASE_URL) throw new Error('Refusing an unexpected Supabase project.');
  const [rows, storageObjects, cardSource, detailSource] = await Promise.all([
    fetchAllExperienceRows(baseUrl, anonKey),
    listAllStorageObjects(baseUrl, anonKey),
    readFile(CARD_MANIFEST_PATH, 'utf8'),
    readFile(DETAIL_MANIFEST_PATH, 'utf8'),
  ]);
  const source = buildSourceScopes(rows, storageObjects, baseUrl);
  if (source.sourceScopes.publicActive.missingObjectCount !== 0 || source.sourceScopes.publicActive.invalidReferenceCount !== 0) {
    throw new Error('Public-active Supabase source parity is not exact.');
  }
  const currentCards = parseCardManifest(cardSource);
  const currentDetails = JSON.parse(detailSource);
  const manifest = buildManifestAudit(source.reconciliationInventory, currentCards, currentDetails);
  const specifications = buildSpecifications(
    source.reconciliationInventory,
    buildExpectedManifests(source.reconciliationInventory, currentCards),
  );
  const sourceUrls = mapSourceUrls(source.reconciliationInventory, baseUrl);
  const storageByKey = new Map(storageObjects.map((item) => [item.key, item]));
  const cacheDirectory = path.join(outputDirectory, 'source-cache');
  if (writeCache) await mkdir(cacheDirectory, { recursive: true, mode: 0o700 });
  const sourceObjects = [];
  for (const sourceKey of [...source.publicActiveKeys].sort()) {
    const downloaded = await downloadSource(baseUrl, anonKey, sourceKey);
    const metadata = storageByKey.get(sourceKey);
    const sourceByteSha256 = sha256(downloaded.bytes);
    const contentType = downloaded.contentType || normalizeContentType(metadata?.contentType);
    if (!contentType || (metadata?.contentType && normalizeContentType(metadata.contentType) !== contentType)) {
      throw new Error(`Source content type mismatch; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
    }
    if (metadata?.size !== downloaded.bytes.length) throw new Error(`Source size mismatch; identity=${hashIdentity(sourceKey).slice(0, 16)}`);
    const sourceKeySha256 = sha256(sourceKey);
    const localFile = `source-cache/${sourceByteSha256}`;
    if (writeCache) {
      const destination = path.join(outputDirectory, localFile);
      await writeFile(destination, downloaded.bytes, { mode: 0o600 });
      await chmod(destination, 0o600);
    }
    sourceObjects.push({
      sourceKey,
      sourceKeySha256,
      sourceByteSha256,
      sourceSize: downloaded.bytes.length,
      contentType,
      storageEtag: metadata?.etag || downloaded.etag,
      originalKey: buildOriginalKey(sourceKey, sourceByteSha256, contentType),
      localFile,
    });
  }
  const sourceByUrl = new Map([...sourceUrls].map(([key, url]) => [url, sourceObjects.find((item) => item.sourceKey === key)]));
  const manifestByKey = new Map(manifest.r2Plan.expected.map((item) => [item.key, item]));
  const expected = specifications.map((item) => {
    const sourceObject = sourceByUrl.get(item.originUrl);
    if (!sourceObject) throw new Error('Expected derivative has no public-active source mapping.');
    const manifestEntry = manifestByKey.get(item.key);
    if (!manifestEntry) throw new Error('Expected derivative is missing from the manifest audit.');
    return {
      key: item.key,
      kind: manifestEntry.kind,
      sourceKeySha256: sourceObject.sourceKeySha256,
      sourceByteSha256: sourceObject.sourceByteSha256,
      width: item.width,
      quality: item.quality,
      format: 'webp',
      expectedContentType: manifestEntry.expectedContentType,
      expectedCacheControl: manifestEntry.expectedCacheControl,
    };
  });
  // buildManifestAudit intentionally emits only public audit fields. Recover transform
  // dimensions from the immutable key so the repair plan cannot invent provenance.
  for (const item of expected) {
    const match = item.key.match(/-w(\d+)-q(\d+)\.(\w+)$/);
    if (!match) throw new Error('Expected derivative key does not encode transform parameters.');
    item.width = Number(match[1]);
    item.quality = Number(match[2]);
    item.format = match[3];
  }
  const sourcePlan = {
    version: 1,
    target: { supabaseProjectRef: PRODUCTION_PROJECT_REF, bucket: EXPERIENCE_BUCKET },
    authority: { source: 'supabase-storage', mirror: 'r2' },
    generatedAt: new Date().toISOString(),
    sourceObjects,
    expectedDerivatives: expected,
    knownManifestKeys: manifest.r2Plan.knownManifestKeys,
    sourceCounts: source.sourceScopes,
  };
  sourcePlan.sourceSnapshotDigest = sha256(stableJson(buildSnapshotPayload(sourceObjects, { r2Plan: { expected } })));
  return sourcePlan;
}

export function sanitizeSourcePlanSummary(sourcePlan) {
  return sanitizeReport({
    version: sourcePlan.version,
    target: { projectRefSha256: sha256(sourcePlan.target.supabaseProjectRef), bucket: sourcePlan.target.bucket },
    generatedAt: sourcePlan.generatedAt,
    sourceSnapshotDigest: sourcePlan.sourceSnapshotDigest,
    publicActiveExperienceCount: sourcePlan.sourceCounts.publicActive.experienceCount,
    publicActiveOriginalCount: sourcePlan.sourceObjects.length,
    publicActiveSourceBytes: sourcePlan.sourceObjects.reduce((total, item) => total + item.sourceSize, 0),
    expectedDerivativeCount: sourcePlan.expectedDerivatives.length,
    sourceIdentitySetDigest: sourcePlan.sourceCounts.publicActive.identitySetDigest,
    mutationRequests: { supabase: 0, r2: 0 },
  });
}

async function main() {
  const args = parseArgs();
  if (args.command === 'plan') {
    await mkdir(args.output, { recursive: true, mode: 0o700 });
    const sourcePlan = await createSourcePlan(args.output, { writeCache: true });
    const privatePath = path.join(args.output, '.source-plan.json');
    await writeFile(privatePath, stableJson(sourcePlan), { mode: 0o600 });
    await chmod(privatePath, 0o600);
    const summary = sanitizeSourcePlanSummary(sourcePlan);
    await writeFile(path.join(args.output, 'source-plan-summary.json'), stableJson(summary));
    console.log(stableJson(summary));
    return;
  }
  if (!args.sourcePlan) throw new Error('--source-plan is required for verify-source.');
  const prior = JSON.parse(await readFile(args.sourcePlan, 'utf8'));
  const current = await createSourcePlan(args.output, { writeCache: false });
  const stable = current.sourceSnapshotDigest === prior.sourceSnapshotDigest;
  const result = sanitizeReport({
    sourceSnapshotStable: stable,
    expectedDigest: prior.sourceSnapshotDigest,
    actualDigest: current.sourceSnapshotDigest,
    sourceObjectCount: current.sourceObjects.length,
    mutationRequests: { supabase: 0, r2: 0 },
  });
  console.log(stableJson(result));
  if (!stable) throw new Error('Production source snapshot changed; no repair item may be reported successful.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
