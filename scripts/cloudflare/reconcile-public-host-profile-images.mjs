import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const MANIFEST_PATH = path.resolve('app/data/publicHostProfileImages.generated.json');
const EXCLUSIONS_PATH = path.resolve('config/public-host-profile-r2-exclusions.json');
const PUBLIC_STORAGE_ORIGIN = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const PROFILE_PATH_PATTERN = /^\/storage\/v1\/object\/public\/images\/profile\/[A-Za-z0-9._-]+$/;
const AVATAR_PATH_PATTERN = /^\/storage\/v1\/object\/public\/avatars\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const HOST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VISIBLE_STATUSES = new Set(['approved', 'active']);

function parseArgs() {
  const [command = 'audit', ...rest] = process.argv.slice(2);
  const values = Object.fromEntries(rest.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...parts] = value.slice(2).split('=');
    return [key, parts.join('=') || 'true'];
  }));
  return {
    command,
    output: path.resolve(values.output || '.tmp/cloudflare-public-host-profile-reconciliation'),
    plan: values.plan ? path.resolve(values.plan) : null,
    missing: values.missing ? path.resolve(values.missing) : null,
    objects: values.objects ? path.resolve(values.objects) : null,
    priorSourceBytes: Number(values['prior-source-bytes'] || 0),
    hostId: values['host-id'] || null,
    allowNoDrift: values['allow-no-drift'] === 'true',
  };
}

async function loadLocalPublicEnvironment() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
  try {
    const source = await readFile('.env.local', 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY))\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch {}
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function urlHash(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function snapshotHash(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function comparableId(id) {
  if (typeof id === 'number') return String(id).padStart(20, '0');
  return typeof id === 'string' ? id : '';
}

function compareLatestRows(a, b) {
  const timestampA = Date.parse(a.created_at || '') || 0;
  const timestampB = Date.parse(b.created_at || '') || 0;
  if (timestampA !== timestampB) return timestampB - timestampA;
  return comparableId(b.id).localeCompare(comparableId(a.id));
}

export function validateHostId(hostId) {
  if (typeof hostId !== 'string' || hostId !== hostId.toLowerCase() || !HOST_ID_PATTERN.test(hostId)) {
    throw new Error('Host id must be a canonical lowercase UUID.');
  }
  return hostId;
}

export function pickLatestRowsByUser(rows) {
  const latest = new Map();
  for (const row of [...rows].sort(compareLatestRows)) {
    const userId = typeof row.user_id === 'string' ? row.user_id.trim().toLowerCase() : '';
    if (!userId || latest.has(userId)) continue;
    validateHostId(userId);
    latest.set(userId, { ...row, user_id: userId });
  }
  return [...latest.values()].sort((a, b) => a.user_id.localeCompare(b.user_id));
}

function sourcePathBelongsToHost(pathname, sourceKind, hostId) {
  if (!hostId) return true;
  validateHostId(hostId);
  if (sourceKind === 'application-profile') {
    return pathname.startsWith(`/storage/v1/object/public/images/profile/${hostId}_`);
  }
  const avatarPrefix = '/storage/v1/object/public/avatars/';
  const relativePath = pathname.slice(avatarPrefix.length);
  return relativePath.startsWith(`${hostId}/`) || relativePath.startsWith(`${hostId}-`);
}

export function normalizePublicHostProfileSourceUrl(
  value,
  allowedKinds = ['application-profile', 'public-profile-avatar'],
  expectedHostId = null,
) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (parsed.origin !== PUBLIC_STORAGE_ORIGIN || parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    if (parsed.href !== value) return null;
    if (
      allowedKinds.includes('application-profile')
      && PROFILE_PATH_PATTERN.test(parsed.pathname)
      && sourcePathBelongsToHost(parsed.pathname, 'application-profile', expectedHostId)
    ) {
      return { originUrl: value, sourceKind: 'application-profile' };
    }
    if (
      allowedKinds.includes('public-profile-avatar')
      && AVATAR_PATH_PATTERN.test(parsed.pathname)
      && sourcePathBelongsToHost(parsed.pathname, 'public-profile-avatar', expectedHostId)
    ) {
      return { originUrl: value, sourceKind: 'public-profile-avatar' };
    }
  } catch {}
  return null;
}

export function normalizeInventory(rows, exclusions = [], profiles = []) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No public host application rows were returned.');
  if (!Array.isArray(exclusions)) throw new Error('Profile R2 exclusions must be an array.');
  const excludedHostIds = new Set(exclusions.map(validateHostId));
  const profilesById = new Map();
  for (const profile of profiles) {
    const id = typeof profile?.id === 'string' ? profile.id.trim().toLowerCase() : '';
    if (!id) continue;
    validateHostId(id);
    if (profilesById.has(id)) throw new Error('Duplicate public profile id in profile inventory.');
    profilesById.set(id, profile);
  }
  const latestRows = pickLatestRowsByUser(rows);
  const visibleRows = latestRows.filter((row) => VISIBLE_STATUSES.has(row.status));
  const inventory = [];
  let missingPhotoCount = 0;
  let unexpectedPhotoCount = 0;
  let excludedHostCount = 0;
  let externalAvatarExcludedCount = 0;
  let applicationProfileCount = 0;
  let publicProfileAvatarCount = 0;

  for (const row of visibleRows) {
    const photo = typeof row.profile_photo === 'string' ? row.profile_photo.trim() : '';
    const applicationSource = photo
      ? normalizePublicHostProfileSourceUrl(photo, ['application-profile'], row.user_id)
      : null;
    if (photo && !applicationSource) {
      unexpectedPhotoCount += 1;
      continue;
    }
    const publicAvatar = typeof profilesById.get(row.user_id)?.avatar_url === 'string'
      ? profilesById.get(row.user_id).avatar_url.trim()
      : '';
    const avatarSource = !photo && publicAvatar
      ? normalizePublicHostProfileSourceUrl(
        publicAvatar,
        ['public-profile-avatar', 'application-profile'],
        row.user_id,
      )
      : null;
    if (!photo && publicAvatar && !avatarSource) {
      externalAvatarExcludedCount += 1;
      continue;
    }
    const source = applicationSource || avatarSource;
    if (!source) {
      missingPhotoCount += 1;
      continue;
    }
    if (excludedHostIds.has(row.user_id)) {
      excludedHostCount += 1;
      continue;
    }
    if (source.sourceKind === 'application-profile') applicationProfileCount += 1;
    else publicProfileAvatarCount += 1;
    inventory.push({ hostId: row.user_id, ...source });
  }

  const uniqueHostIds = new Set(inventory.map((item) => item.hostId));
  const uniqueUrls = new Set(inventory.map((item) => item.originUrl));
  if (uniqueHostIds.size !== inventory.length) throw new Error('Duplicate public host id in profile inventory.');
  if (uniqueUrls.size !== inventory.length) throw new Error('Duplicate profile origin URL across public hosts.');

  return {
    latestRows,
    inventory,
    summary: {
      latestHostCount: latestRows.length,
      visibleHostCount: visibleRows.length,
      eligibleHostCount: inventory.length,
      missingPhotoCount,
      unexpectedPhotoCount,
      excludedHostCount,
      externalAvatarExcludedCount,
      applicationProfileCount,
      publicProfileAvatarCount,
      snapshotHash: snapshotHash({
        applications: latestRows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          status: row.status,
          profile_photo: row.profile_photo,
          created_at: row.created_at,
        })),
        profiles: visibleRows.map((row) => ({
          id: row.user_id,
          avatar_url: profilesById.get(row.user_id)?.avatar_url ?? null,
        })),
      }),
    },
  };
}

export function buildExpectedManifest(inventory) {
  return Object.fromEntries(inventory.map(({ hostId, originUrl }) => {
    const hash = urlHash(originUrl);
    const prefix = `hosts/${hostId}/${hash}`;
    return [hostId, {
      originUrl,
      smallKey: `${prefix}/avatar-w128-q80.webp`,
      largeKey: `${prefix}/avatar-w256-q80.webp`,
    }];
  }));
}

export function buildSpecifications(manifest) {
  const specifications = [];
  for (const [hostId, entry] of Object.entries(manifest)) {
    validateHostId(hostId);
    const source = normalizePublicHostProfileSourceUrl(
      entry.originUrl,
      ['application-profile', 'public-profile-avatar'],
      hostId,
    );
    if (!source) throw new Error(`Refusing unexpected profile origin for host ${hostId}.`);
    specifications.push(
      { hostId, originUrl: entry.originUrl, sourceKind: source.sourceKind, key: entry.smallKey, width: 128, quality: 80 },
      { hostId, originUrl: entry.originUrl, sourceKind: source.sourceKind, key: entry.largeKey, width: 256, quality: 80 },
    );
  }
  const keys = specifications.map((item) => item.key);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate expected profile R2 key.');
  return specifications;
}

export function selectMissingSpecifications(specifications, missingKeys) {
  if (!Array.isArray(missingKeys) || missingKeys.some((key) => typeof key !== 'string')) throw new Error('Missing profile object plan must contain a string array.');
  if (new Set(missingKeys).size !== missingKeys.length) throw new Error('Missing profile object plan contains duplicate keys.');
  const expectedKeys = new Set(specifications.map((item) => item.key));
  if (missingKeys.some((key) => !expectedKeys.has(key))) throw new Error('Missing profile object plan contains an unexpected key.');
  const missingSet = new Set(missingKeys);
  return specifications.filter((item) => missingSet.has(item.key));
}

async function fetchPublicHostApplications() {
  await loadLocalPublicEnvironment();
  const baseUrl = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = requireEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const query = new URLSearchParams({
    select: 'id,user_id,status,profile_photo,created_at',
    order: 'user_id.asc,created_at.desc',
  });
  const response = await fetch(`${baseUrl}/rest/v1/public_host_applications?${query}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!response.ok) throw new Error(`Public host profile inventory failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Public host profile inventory response is not an array.');
  return rows;
}

async function fetchPublicProfiles(hostIds) {
  if (hostIds.length === 0) return [];
  await loadLocalPublicEnvironment();
  const baseUrl = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = requireEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const query = new URLSearchParams({
    select: 'id,avatar_url',
    id: `in.(${hostIds.join(',')})`,
  });
  const response = await fetch(`${baseUrl}/rest/v1/public_profiles?${query}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) throw new Error('Public profile inventory refused a redirect.');
  if (!response.ok) throw new Error(`Public profile inventory failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Public profile inventory response is not an array.');
  return rows;
}

async function loadExclusions() {
  const exclusions = JSON.parse(await readFile(EXCLUSIONS_PATH, 'utf8'));
  if (!Array.isArray(exclusions)) throw new Error('Profile R2 exclusions must be an array.');
  if (new Set(exclusions).size !== exclusions.length) throw new Error('Profile R2 exclusions contain duplicate host ids.');
  return exclusions.map(validateHostId).sort();
}

async function loadState() {
  const [rows, exclusions, manifestSource] = await Promise.all([
    fetchPublicHostApplications(),
    loadExclusions(),
    readFile(MANIFEST_PATH, 'utf8'),
  ]);
  const latestRows = pickLatestRowsByUser(rows);
  const profiles = await fetchPublicProfiles(latestRows.map((row) => row.user_id));
  const normalized = normalizeInventory(rows, exclusions, profiles);
  const currentManifest = JSON.parse(manifestSource);
  const expectedManifest = buildExpectedManifest(normalized.inventory);
  const drift = stableJson(currentManifest) !== stableJson(expectedManifest);
  return {
    ...normalized,
    exclusions,
    currentManifest,
    expectedManifest,
    summary: {
      ...normalized.summary,
      currentManifestHostCount: Object.keys(currentManifest).length,
      expectedManifestHostCount: Object.keys(expectedManifest).length,
      drift,
    },
  };
}

async function appendGithubOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

async function downloadSource(url, budget) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (response.url !== url) throw new Error('unexpected source redirect');
      const contentType = (response.headers.get('content-type') || '').split(';', 1)[0];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error(`unexpected content type ${contentType}`);
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > 10 * 1024 * 1024 || budget.bytes + declaredLength > budget.maxBytes) {
        throw new Error('source image exceeds the bounded download budget');
      }
      if (!response.body) throw new Error('source response body is unavailable');
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        budget.bytes += value.byteLength;
        if (received > 10 * 1024 * 1024 || budget.bytes > budget.maxBytes) {
          await reader.cancel();
          throw new Error('source image exceeds the bounded download budget');
        }
        chunks.push(Buffer.from(value));
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length === 0) throw new Error('empty response body');
      if (bytes.length > 10 * 1024 * 1024) throw new Error('source image exceeds 10 MiB');
      return { bytes, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
    }
  }
  throw new Error(`Failed to download approved public profile source: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function transform(specificationsPath, missingPath, outputDirectory) {
  const [specifications, missingPlan] = await Promise.all([
    readFile(specificationsPath, 'utf8').then(JSON.parse),
    readFile(missingPath, 'utf8').then(JSON.parse),
  ]);
  const selected = selectMissingSpecifications(specifications, missingPlan.missingKeys);
  const sharp = selected.length > 0 ? (await import('sharp')).default : null;
  const objectsDirectory = path.join(outputDirectory, 'objects');
  await mkdir(objectsDirectory, { recursive: true });
  const sourceCache = new Map();
  const objects = [];
  let sourceDownloadBytes = 0;
  let sourceDownloadAttempts = 0;
  const budget = { bytes: 0, maxBytes: 256 * 1024 * 1024, transforms: 0, maxTransforms: 512 };
  if (selected.length > budget.maxTransforms) throw new Error('Transform plan exceeds the 512-attempt ceiling.');
  if (new Set(selected.map((item) => item.originUrl)).size > 256) throw new Error('Source plan exceeds the 256-object ceiling.');

  for (const specification of selected) {
    let source = sourceCache.get(specification.originUrl);
    if (!source) {
      const downloaded = await downloadSource(specification.originUrl, budget);
      source = downloaded.bytes;
      sourceCache.set(specification.originUrl, source);
      sourceDownloadBytes = budget.bytes;
      sourceDownloadAttempts += downloaded.attempts;
    }
    const destination = path.join(objectsDirectory, specification.key);
    await mkdir(path.dirname(destination), { recursive: true });
    budget.transforms += 1;
    if (budget.transforms > budget.maxTransforms) throw new Error('Transform attempt budget exhausted.');
    await sharp(source).rotate().resize({ width: specification.width, height: specification.width, fit: 'cover' }).webp({ quality: specification.quality, effort: 5 }).toFile(destination);
    const bytes = await readFile(destination);
    objects.push({
      hostId: specification.hostId,
      key: specification.key,
      path: path.relative(outputDirectory, destination),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contentType: 'image/webp',
      sourceIdentityHash: createHash('sha256').update(specification.originUrl).digest('hex'),
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      sourceBytes: source.length,
      sourceKind: specification.sourceKind,
      width: specification.width,
      quality: specification.quality,
    });
  }

  const result = {
    sourceDownloadCount: sourceCache.size,
    sourceDownloadBytes,
    sourceDownloadAttempts,
    transformedObjectCount: objects.length,
    transformAttemptCount: budget.transforms,
    transformedObjectBytes: objects.reduce((total, item) => total + item.bytes, 0),
  };
  await Promise.all([
    writeFile(path.join(outputDirectory, 'objects.json'), stableJson(objects)),
    writeFile(path.join(outputDirectory, 'transform-result.json'), stableJson(result)),
  ]);
  for (const [name, value] of Object.entries({
    source_download_count: result.sourceDownloadCount,
    source_download_bytes: result.sourceDownloadBytes,
    source_download_attempts: result.sourceDownloadAttempts,
    transformed_object_count: result.transformedObjectCount,
    transformed_object_bytes: result.transformedObjectBytes,
  })) await appendGithubOutput(name, value);
  return result;
}

export async function verifySourceBytes(specificationsPath, objectsPath, priorSourceBytes) {
  if (!Number.isSafeInteger(priorSourceBytes) || priorSourceBytes < 0 || priorSourceBytes > 256 * 1024 * 1024) {
    throw new Error('Prior source byte usage is invalid.');
  }
  const [specifications, objects] = await Promise.all([
    readFile(specificationsPath, 'utf8').then(JSON.parse),
    readFile(objectsPath, 'utf8').then(JSON.parse),
  ]);
  const expectedByKey = new Map(specifications.map((item) => [item.key, item]));
  const expectedByOrigin = new Map();
  for (const object of objects) {
    const specification = expectedByKey.get(object.key);
    if (!specification || specification.sourceKind !== object.sourceKind) throw new Error('Source verification plan mismatch.');
    const previous = expectedByOrigin.get(specification.originUrl);
    const proof = { sha256: object.sourceSha256, bytes: object.sourceBytes };
    if (previous && (previous.sha256 !== proof.sha256 || previous.bytes !== proof.bytes)) throw new Error('Inconsistent source proof across variants.');
    expectedByOrigin.set(specification.originUrl, proof);
  }
  const budget = { bytes: priorSourceBytes, maxBytes: 256 * 1024 * 1024 };
  let attempts = 0;
  for (const [originUrl, proof] of expectedByOrigin) {
    const downloaded = await downloadSource(originUrl, budget);
    attempts += downloaded.attempts;
    const digest = createHash('sha256').update(downloaded.bytes).digest('hex');
    if (downloaded.bytes.length !== proof.bytes || digest !== proof.sha256) throw new Error('Public profile source bytes changed during reconciliation.');
  }
  return {
    verifiedSourceCount: expectedByOrigin.size,
    verificationSourceBytes: budget.bytes - priorSourceBytes,
    totalSourceBytes: budget.bytes,
    verificationSourceAttempts: attempts,
  };
}

async function writePlan(state, outputDirectory) {
  const specifications = buildSpecifications(state.expectedManifest);
  await Promise.all([
    writeFile(path.join(outputDirectory, 'publicHostProfileImages.generated.json'), stableJson(state.expectedManifest)),
    writeFile(path.join(outputDirectory, 'specifications.json'), stableJson(specifications)),
    writeFile(path.join(outputDirectory, 'plan.json'), stableJson({
      version: 1,
      createdAt: new Date().toISOString(),
      snapshotHash: state.summary.snapshotHash,
      summary: state.summary,
      expectedObjectCount: specifications.length,
    })),
  ]);
  return { ...state.summary, expectedObjectCount: specifications.length, outputDirectory };
}

async function publishSummaryOutputs(summary) {
  for (const [name, value] of Object.entries({
    drift: summary.drift ? 'true' : 'false',
    snapshot_hash: summary.snapshotHash,
    latest_host_count: summary.latestHostCount,
    visible_host_count: summary.visibleHostCount,
    eligible_host_count: summary.eligibleHostCount,
    missing_photo_count: summary.missingPhotoCount,
    unexpected_photo_count: summary.unexpectedPhotoCount,
    excluded_host_count: summary.excludedHostCount,
    external_avatar_excluded_count: summary.externalAvatarExcludedCount,
    application_profile_count: summary.applicationProfileCount,
    public_profile_avatar_count: summary.publicProfileAvatarCount,
  })) await appendGithubOutput(name, value);
}

async function main() {
  const args = parseArgs();
  if (args.command === 'transform') {
    if (!args.plan || !args.missing) throw new Error('--plan and --missing are required for transform.');
    await mkdir(args.output, { recursive: true });
    console.log(stableJson(await transform(args.plan, args.missing, args.output)));
    return;
  }

  if (args.command === 'verify-source-bytes') {
    if (!args.plan || !args.objects) throw new Error('--plan and --objects are required for verify-source-bytes.');
    const result = await verifySourceBytes(args.plan, args.objects, args.priorSourceBytes);
    for (const [name, value] of Object.entries({
      verified_source_count: result.verifiedSourceCount,
      verification_source_bytes: result.verificationSourceBytes,
      total_source_bytes: result.totalSourceBytes,
      verification_source_attempts: result.verificationSourceAttempts,
    })) await appendGithubOutput(name, value);
    console.log(stableJson(result));
    return;
  }

  if (args.command === 'verify-snapshot') {
    if (!args.plan) throw new Error('--plan is required for verify-snapshot.');
    const [state, plan] = await Promise.all([loadState(), readFile(args.plan, 'utf8').then(JSON.parse)]);
    if (state.summary.snapshotHash !== plan.snapshotHash) throw new Error('Production public host profile inventory changed during reconciliation.');
    console.log(stableJson({ snapshotStable: true, ...state.summary }));
    return;
  }

  if (args.command === 'purge-check') {
    const hostId = validateHostId(args.hostId);
    const state = await loadState();
    const liveEntry = buildExpectedManifest(normalizeInventory(state.latestRows, []).inventory)[hostId] || null;
    const excluded = state.exclusions.includes(hostId);
    if (liveEntry && !excluded) throw new Error('Refusing to purge the current Production profile image for an eligible public host.');
    const result = { hostId, snapshotHash: state.summary.snapshotHash, excluded, currentlyEligible: Boolean(liveEntry), purgeAllowed: true };
    await mkdir(args.output, { recursive: true });
    await writeFile(path.join(args.output, 'purge-check.json'), stableJson(result));
    console.log(stableJson(result));
    return;
  }

  const state = await loadState();
  await mkdir(args.output, { recursive: true });
  await writeFile(path.join(args.output, 'audit.json'), stableJson(state.summary));
  await publishSummaryOutputs(state.summary);
  if (args.command === 'audit') {
    console.log(stableJson(state.summary));
    return;
  }
  if (args.command !== 'plan') throw new Error(`Unknown command: ${args.command}`);
  if (!state.summary.drift && !args.allowNoDrift) {
    console.log(stableJson({ ...state.summary, skipped: 'no-drift' }));
    return;
  }
  console.log(stableJson(await writePlan(state, args.output)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
