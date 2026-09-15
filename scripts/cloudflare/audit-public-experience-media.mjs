import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  buildExpectedManifests,
  buildSpecifications,
  parseCardManifest,
} from './reconcile-public-experience-images.mjs';

const PRODUCTION_SUPABASE_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const EXPERIENCE_BUCKET = 'experiences';
const CARD_MANIFEST_PATH = path.resolve('app/data/publicExperienceCardImages.ts');
const DETAIL_MANIFEST_PATH = path.resolve('app/data/publicExperienceDetailImages.generated.json');
const R2_AUDIT_PATH = path.resolve('scripts/cloudflare/r2-public-image-audit.py');
const DEFAULT_OUTPUT = path.resolve('.tmp/public-experience-media-audit');
const STORAGE_PAGE_SIZE = 100;
const MAX_STORAGE_DIRECTORIES = 10_000;
const MAX_STORAGE_OBJECTS = 100_000;

export const TRANSFORM_PROVENANCE_SCHEMA = Object.freeze({
  sourceKeySha256: 'source_key_sha256',
  sourceByteSha256: 'source_byte_sha256',
  outputByteSha256: 'output_byte_sha256',
  width: 'transform_width',
  quality: 'transform_quality',
  format: 'transform_format',
  sharpVersion: 'sharp_version',
  libvipsVersion: 'libvips_version',
  runtime: 'runtime_id',
  generatedAt: 'generated_at',
});

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function hashIdentity(value) {
  return createHash('sha256').update(`locally-public-experience-media-v1\0${value}`).digest('hex');
}

export function hashSourceKey(value) {
  return createHash('sha256').update(value).digest('hex');
}

function identitySetDigest(values) {
  const digest = createHash('sha256');
  for (const value of [...values].sort()) digest.update(Buffer.from(hashIdentity(value), 'hex'));
  return digest.digest('hex');
}

export function parseArgs(argv = process.argv.slice(2)) {
  const [mode = 'metadata', ...rest] = argv;
  if (!['metadata', 'full'].includes(mode)) throw new Error('Mode must be metadata or full.');
  const values = Object.fromEntries(rest.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...parts] = value.slice(2).split('=');
    return [key, parts.join('=') || 'true'];
  }));
  return {
    mode,
    output: path.resolve(values.output || DEFAULT_OUTPUT),
    python: values.python || process.env.PYTHON || 'python3',
    privateOutput: values['private-output'] ? path.resolve(values['private-output']) : null,
  };
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function normalizeSupabaseExperienceObjectKey(value, baseUrl = PRODUCTION_SUPABASE_URL) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (parsed.origin !== baseUrl || parsed.username || parsed.password) return null;
  const prefix = `/storage/v1/object/public/${EXPERIENCE_BUCKET}/`;
  if (!parsed.pathname.startsWith(prefix) || parsed.search || parsed.hash) return null;
  let objectKey;
  try {
    objectKey = parsed.pathname.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
  const parts = objectKey.split('/');
  if (
    parts.length !== 4
    || parts[0] !== 'experience'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1])
    || !['hero', 'itinerary'].includes(parts[2])
    || parts.slice(3).some((part) => part === '' || part === '.' || part === '..')
  ) return null;
  return objectKey;
}

function extractItineraryUrls(itinerary) {
  if (!Array.isArray(itinerary)) return [];
  return itinerary.map((item) => item?.image_url).filter((value) => typeof value === 'string' && value.trim() !== '');
}

function extractNestedImageUrls(value) {
  if (Array.isArray(value)) return value.flatMap(extractNestedImageUrls);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(key === 'image_url' && typeof item === 'string' && item.trim() ? [item] : []),
    ...(Array.isArray(item) || (item && typeof item === 'object') ? extractNestedImageUrls(item) : []),
  ]);
}

function extractRowReferences(row) {
  const photos = Array.isArray(row.photos) ? row.photos.filter((value) => typeof value === 'string' && value.trim() !== '') : [];
  const itinerary = [...extractItineraryUrls(row.itinerary), ...extractNestedImageUrls(row.itinerary_i18n)];
  const legacy = typeof row.image_url === 'string' && row.image_url.trim() !== '' ? [row.image_url] : [];
  return { photos, itinerary, legacy };
}

export function buildSourceScopes(rows, storageObjects, baseUrl = PRODUCTION_SUPABASE_URL) {
  const storageByKey = new Map(storageObjects.map((item) => [item.key, item]));
  const allKeys = new Set();
  const activeKeys = new Set();
  const invalidByScope = { allDbReferenced: 0, publicActive: 0 };
  const references = {
    allDbReferenced: { photos: 0, itinerary: 0, legacyImageUrl: 0 },
    publicActive: { photos: 0, itinerary: 0, legacyImageUrl: 0 },
  };
  const reconciliationInventory = [];

  for (const row of rows) {
    const active = row.status === 'active' && row.is_active === true;
    const groups = extractRowReferences(row);
    const normalized = { photos: [], itinerary: [], legacy: [] };
    for (const [group, values] of Object.entries(groups)) {
      const outputName = group === 'legacy' ? 'legacyImageUrl' : group;
      references.allDbReferenced[outputName] += values.length;
      if (active) references.publicActive[outputName] += values.length;
      for (const value of values) {
        const key = normalizeSupabaseExperienceObjectKey(value, baseUrl);
        if (!key) {
          invalidByScope.allDbReferenced += 1;
          if (active) invalidByScope.publicActive += 1;
          continue;
        }
        normalized[group].push({ key, url: value.trim() });
        allKeys.add(key);
        if (active) activeKeys.add(key);
      }
    }
    if (active) {
      const heroUrls = [...new Set((normalized.photos.length > 0 ? normalized.photos : normalized.legacy).map((item) => item.url))];
      const detailUrls = [...new Set([...heroUrls, ...normalized.itinerary.map((item) => item.url)])];
      reconciliationInventory.push({ id: String(row.id), heroUrls, detailUrls });
    }
  }

  const summarize = (keys, invalidCount, referenceCounts, experienceCount) => {
    const existing = [...keys].filter((key) => storageByKey.has(key));
    const missing = [...keys].filter((key) => !storageByKey.has(key));
    return {
      experienceCount,
      referenceCount: Object.values(referenceCounts).reduce((total, count) => total + count, 0),
      distinctObjectCount: keys.size,
      existingObjectCount: existing.length,
      missingObjectCount: missing.length,
      invalidReferenceCount: invalidCount,
      referencedBytes: existing.reduce((total, key) => total + (storageByKey.get(key)?.size || 0), 0),
      identitySetDigest: identitySetDigest(keys),
      references: referenceCounts,
    };
  };

  const storageKeys = new Set(storageByKey.keys());
  const storageMetadata = {
    objectCount: storageObjects.length,
    bytes: storageObjects.reduce((total, item) => total + item.size, 0),
    unreferencedObjectCount: [...storageKeys].filter((key) => !allKeys.has(key)).length,
    sizeMetadataCoverage: storageObjects.filter((item) => Number.isSafeInteger(item.size) && item.size >= 0).length,
    contentTypeMetadataCoverage: storageObjects.filter((item) => Boolean(item.contentType)).length,
    etagMetadataCoverage: storageObjects.filter((item) => Boolean(item.etag)).length,
    cacheControlMetadataCoverage: storageObjects.filter((item) => Boolean(item.cacheControl)).length,
    identitySetDigest: identitySetDigest(storageKeys),
    contentTypes: Object.fromEntries([...new Set(storageObjects.map((item) => item.contentType || 'missing'))].sort().map((value) => [value, storageObjects.filter((item) => (item.contentType || 'missing') === value).length])),
    cacheControls: Object.fromEntries([...new Set(storageObjects.map((item) => item.cacheControl || 'missing'))].sort().map((value) => [value, storageObjects.filter((item) => (item.cacheControl || 'missing') === value).length])),
  };

  return {
    allDbReferencedKeys: allKeys,
    publicActiveKeys: activeKeys,
    reconciliationInventory,
    sourceScopes: {
      publicActive: summarize(activeKeys, invalidByScope.publicActive, references.publicActive, reconciliationInventory.length),
      allDbReferenced: summarize(allKeys, invalidByScope.allDbReferenced, references.allDbReferenced, rows.length),
      storageAll: storageMetadata,
    },
  };
}

export function buildManifestAudit(inventory, currentCards, currentDetails, publicActiveKeys = null) {
  const expected = buildExpectedManifests(inventory, currentCards);
  const specifications = buildSpecifications(inventory, expected);
  const expectedEntries = specifications.map((item) => ({
    key: item.key,
    kind: item.key.startsWith('cards/') || !item.key.includes('/') ? 'card' : 'detail',
    role: item.role,
    width: item.width,
    quality: item.quality,
    format: item.format,
    sourceKeySha256: hashSourceKey(normalizeSupabaseExperienceObjectKey(item.originUrl)),
    expectedContentType: 'image/webp',
    expectedCacheControl: 'public, max-age=31536000, immutable',
  }));
  const currentCardKeys = Object.values(currentCards).flatMap((entry) => [entry.smallKey, entry.largeKey]);
  const currentDetailKeys = Object.values(currentDetails).flatMap((images) => Object.values(images).flatMap((entry) => [entry.smallKey, entry.mediumKey, entry.largeKey]));
  const currentManifestKeys = [...new Set([...currentCardKeys, ...currentDetailKeys])];
  const expectedKeys = new Set(expectedEntries.map((entry) => entry.key));
  const currentKeys = new Set(currentManifestKeys);
  const currentSourcePairs = new Set(Object.entries(currentDetails).flatMap(([id, images]) => Object.keys(images).map((url) => `${id}\0${url}`)));
  const expectedSourcePairs = new Set(inventory.flatMap((item) => item.detailUrls.map((url) => `${item.id}\0${url}`)));
  const originalSourceKeys = publicActiveKeys || new Set(
    inventory.flatMap((item) => item.detailUrls)
      .map((value) => normalizeSupabaseExperienceObjectKey(value))
      .filter(Boolean),
  );
  return {
    r2Plan: {
      version: 1,
      expected: expectedEntries,
      knownManifestKeys: currentManifestKeys,
      publicActiveOriginalSourceKeyHashes: [...originalSourceKeys].map(hashSourceKey).sort(),
    },
    summary: {
      currentCardExperienceCount: Object.keys(currentCards).length,
      expectedCardExperienceCount: Object.keys(expected.cards).length,
      currentDetailExperienceCount: Object.keys(currentDetails).length,
      currentDetailSourceCount: currentSourcePairs.size,
      expectedDetailSourceCount: expectedSourcePairs.size,
      currentDerivativeKeyCount: currentKeys.size,
      expectedDerivativeKeyCount: expectedKeys.size,
      missingManifestDerivativeKeyCount: [...expectedKeys].filter((key) => !currentKeys.has(key)).length,
      staleManifestDerivativeKeyCount: [...currentKeys].filter((key) => !expectedKeys.has(key)).length,
      missingDetailSourceMappingCount: [...expectedSourcePairs].filter((value) => !currentSourcePairs.has(value)).length,
      staleDetailSourceMappingCount: [...currentSourcePairs].filter((value) => !expectedSourcePairs.has(value)).length,
    },
  };
}

export function sanitizeReport(value) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    /https?:\/\//i,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    /(?:service[_-]?role|secret|credential|access[_-]?key)/i,
  ];
  if (forbidden.some((pattern) => pattern.test(serialized))) throw new Error('Audit report contains forbidden sensitive identity or credential material.');
  return value;
}

function storageItem(prefix, item) {
  const key = [prefix, item.name].filter(Boolean).join('/');
  const metadata = item.metadata || {};
  const size = Number(metadata.size);
  return {
    key,
    size: Number.isSafeInteger(size) && size >= 0 ? size : 0,
    contentType: String(metadata.mimetype || metadata.contentType || '').split(';', 1)[0].toLowerCase(),
    etag: String(metadata.eTag || metadata.etag || '').replace(/^"|"$/g, ''),
    cacheControl: String(metadata.cacheControl || metadata.cache_control || ''),
    version: typeof item.id === 'string' ? item.id : null,
    updatedAt: typeof item.updated_at === 'string' ? item.updated_at : null,
  };
}

export function buildStorageListRequest(baseUrl, anonKey, prefix, offset) {
  return {
    url: `${baseUrl}/storage/v1/object/list/${EXPERIENCE_BUCKET}`,
    init: {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: STORAGE_PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } }),
    },
    operation: 'storage-list-read',
    mutation: false,
  };
}

async function fetchJson(url, init, description) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${description} failed: HTTP ${response.status}`);
  return response.json();
}

export async function fetchAllExperienceRows(baseUrl, anonKey) {
  const pageSize = 500;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({ select: 'id,photos,image_url,itinerary,itinerary_i18n,status,is_active', order: 'id.asc' });
    const page = await fetchJson(`${baseUrl}/rest/v1/experiences?${query}`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Range: `${offset}-${offset + pageSize - 1}` },
    }, 'Experience SELECT');
    if (!Array.isArray(page)) throw new Error('Experience SELECT returned a non-array response.');
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function listAllStorageObjects(baseUrl, anonKey) {
  const pending = [''];
  const visited = new Set();
  const objects = [];
  while (pending.length > 0) {
    if (visited.size >= MAX_STORAGE_DIRECTORIES) throw new Error('Storage directory safety limit exceeded.');
    const prefix = pending.shift();
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
      const request = buildStorageListRequest(baseUrl, anonKey, prefix, offset);
      const page = await fetchJson(request.url, request.init, 'Storage LIST');
      if (!Array.isArray(page)) throw new Error('Storage LIST returned a non-array response.');
      for (const item of page) {
        if (item?.id == null) pending.push([prefix, item?.name].filter(Boolean).join('/'));
        else objects.push(storageItem(prefix, item));
      }
      if (objects.length > MAX_STORAGE_OBJECTS) throw new Error('Storage object safety limit exceeded.');
      if (page.length < STORAGE_PAGE_SIZE) break;
    }
  }
  const keys = objects.map((item) => item.key);
  if (new Set(keys).size !== keys.length) throw new Error('Storage LIST returned duplicate object keys.');
  return objects.sort((a, b) => a.key.localeCompare(b.key));
}

async function auditSourceDownloads(baseUrl, anonKey, sourceKeys, storageObjects) {
  const metadata = new Map(storageObjects.map((item) => [item.key, item]));
  const download = async (key) => {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${baseUrl}/storage/v1/object/public/${EXPERIENCE_BUCKET}/${encodedKey}`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) throw new Error(`Source object GET failed: HTTP ${response.status}; identity=${hashIdentity(key).slice(0, 16)}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = metadata.get(key);
    const receivedType = String(response.headers.get('content-type') || '').split(';', 1)[0].toLowerCase();
    return {
      key,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeMismatch: Boolean(expected && expected.size !== bytes.length),
      contentTypeMismatch: Boolean(expected?.contentType && receivedType !== expected.contentType),
    };
  };
  const keys = [...sourceKeys].sort();
  const results = [];
  for (let index = 0; index < keys.length; index += 6) {
    results.push(...await Promise.all(keys.slice(index, index + 6).map(download)));
  }
  const digest = createHash('sha256');
  for (const result of results.sort((a, b) => a.key.localeCompare(b.key))) digest.update(Buffer.from(result.sha256, 'hex'));
  return {
    scope: 'public-active',
    expectedObjectCount: sourceKeys.size,
    downloadedObjectCount: results.length,
    downloadedBytes: results.reduce((total, item) => total + item.bytes, 0),
    sizeMismatchCount: results.filter((item) => item.sizeMismatch).length,
    contentTypeMismatchCount: results.filter((item) => item.contentTypeMismatch).length,
    aggregateDigest: digest.digest('hex'),
  };
}

function runPython(python, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [R2_AUDIT_PATH, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`R2 read-only audit failed with exit ${code}: ${stderr.trim()}`));
    });
  });
}

export function classifyReadiness(source, r2) {
  if (source.publicActive.missingObjectCount > 0 || source.publicActive.invalidReferenceCount > 0) return 'NO_GO_SOURCE_PARITY';
  if ((r2.downloadedShaVerification?.mismatchCount || 0) > 0) return 'NO_GO_R2_SHA_MISMATCH';
  if (
    r2.expectedMissing.total > 0
    || r2.metadata.cacheControlMismatchCount > 0
    || r2.metadata.contentTypeMismatchCount > 0
    || r2.metadata.expectedCustomShaCoverage < r2.expected.total
    || r2.originalIdentityCoverage.missingCount > 0
    || r2.originalIdentityCoverage.duplicateSourceKeyCount > 0
    || r2.originalIdentityCoverage.invalidSourceKeyMetadataCount > 0
  ) {
    return 'NO_GO_R2_READ_CUTOVER_PARITY';
  }
  return 'GO_WAVE_1_3B_READ_CUTOVER_READY';
}

export function renderSummary(report) {
  const lines = [
    '# Public experience media R2 parity audit',
    '',
    `- Mode: ${report.mode}`,
    `- Generated: ${report.generatedAt}`,
    `- Readiness: ${report.readiness}`,
    `- Public-active experiences/objects: ${report.sourceScopes.publicActive.experienceCount}/${report.sourceScopes.publicActive.distinctObjectCount}`,
    `- All DB-referenced/storage-all objects: ${report.sourceScopes.allDbReferenced.distinctObjectCount}/${report.sourceScopes.storageAll.objectCount}`,
    `- Missing source objects: ${report.sourceScopes.allDbReferenced.missingObjectCount}`,
    `- R2 expected/missing: ${report.r2.expected.total}/${report.r2.expectedMissing.total}`,
    `- R2 stale/unclassified/original: ${report.r2.taxonomy.staleKnownDerivative}/${report.r2.taxonomy.unclassifiedExtra}/${report.r2.taxonomy.original}`,
    `- R2 cache-control/content-type mismatch: ${report.r2.metadata.cacheControlMismatchCount}/${report.r2.metadata.contentTypeMismatchCount}`,
    `- Expected derivative SHA metadata coverage: ${report.r2.metadata.expectedCustomShaCoverage}/${report.r2.expected.total}`,
    `- Public-active original identity coverage: ${report.r2.originalIdentityCoverage.matchingExpectedCount}/${report.r2.originalIdentityCoverage.expectedCount}`,
    `- Derivative metadata-consistent/conflict/unverifiable: ${report.r2.completeness.derivativeMetadataConsistentCount}/${report.r2.completeness.derivativeConflictCount}/${report.r2.completeness.derivativeUnverifiableCount}`,
    `- Original current-byte verified/unverifiable: ${report.r2.completeness.originalCurrentByteVerifiedCount}/${report.r2.completeness.originalCurrentByteUnverifiableCount}`,
    `- Downloaded SHA verified/unverifiable/mismatch: ${report.r2.downloadedShaVerification.verifiedCount}/${report.r2.downloadedShaVerification.unverifiableMetadataCount}/${report.r2.downloadedShaVerification.mismatchCount}`,
    `- R2 mutation calls: ${report.safety.r2MutationRequests}`,
    `- Supabase mutation calls: ${report.safety.supabaseMutationRequests}`,
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const args = parseArgs();
  const baseUrl = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = requireEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (baseUrl !== PRODUCTION_SUPABASE_URL) throw new Error('Refusing an unexpected Supabase project for the Production media audit.');
  await mkdir(args.output, { recursive: true });
  const [rows, storageObjects, cardSource, detailSource] = await Promise.all([
    fetchAllExperienceRows(baseUrl, anonKey),
    listAllStorageObjects(baseUrl, anonKey),
    readFile(CARD_MANIFEST_PATH, 'utf8'),
    readFile(DETAIL_MANIFEST_PATH, 'utf8'),
  ]);
  const source = buildSourceScopes(rows, storageObjects, baseUrl);
  const manifest = buildManifestAudit(source.reconciliationInventory, parseCardManifest(cardSource), JSON.parse(detailSource), source.publicActiveKeys);
  const planPath = path.join(args.output, '.r2-audit-input.json');
  const r2OutputPath = path.join(args.output, '.r2-audit-output.json');
  await writeFile(planPath, stableJson(manifest.r2Plan), { mode: 0o600 });
  try {
    const pythonArgs = [
      '--mode', args.mode,
      '--plan', planPath,
      '--output', r2OutputPath,
    ];
    if (args.privateOutput) pythonArgs.push('--private-output', args.privateOutput);
    await runPython(args.python, pythonArgs, process.env);
  } finally {
    await rm(planPath, { force: true });
  }
  const r2 = JSON.parse(await readFile(r2OutputPath, 'utf8'));
  await rm(r2OutputPath, { force: true });
  const sourceDownloads = args.mode === 'full'
    ? await auditSourceDownloads(baseUrl, anonKey, source.publicActiveKeys, storageObjects)
    : { scope: 'public-active', expectedObjectCount: source.publicActiveKeys.size, downloadedObjectCount: 0, downloadedBytes: 0, sizeMismatchCount: 0, contentTypeMismatchCount: 0, aggregateDigest: null };
  const report = sanitizeReport({
    version: 1,
    mode: args.mode,
    generatedAt: new Date().toISOString(),
    authority: { source: 'supabase-storage', mirror: 'r2-derivatives' },
    sourceScopes: source.sourceScopes,
    manifest: manifest.summary,
    r2,
    sourceDownloads,
    provenanceSchema: TRANSFORM_PROVENANCE_SCHEMA,
    readiness: classifyReadiness(source.sourceScopes, r2),
    safety: {
      supabaseDbSelectRequestsOnly: true,
      supabaseStorageListIsReadOnly: true,
      supabaseObjectGetRequestsOnly: true,
      supabaseMutationRequests: 0,
      r2MutationRequests: r2.readOperations.mutationRequests,
    },
  });
  await Promise.all([
    writeFile(path.join(args.output, 'report.json'), stableJson(report)),
    writeFile(path.join(args.output, 'summary.md'), renderSummary(report)),
  ]);
  console.log(renderSummary(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
