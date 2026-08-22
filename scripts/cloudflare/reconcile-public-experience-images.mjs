import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const CARD_MANIFEST_PATH = path.resolve('app/data/publicExperienceCardImages.ts');
const DETAIL_MANIFEST_PATH = path.resolve('app/data/publicExperienceDetailImages.generated.json');
const PUBLIC_IMAGE_PATTERN = /^https:\/\/uhinvcydgzqlpnvieyal\.supabase\.co\/storage\/v1\/object\/public\/experiences\/experience\/[^/]+\/(?:hero|itinerary)\/[A-Za-z0-9._-]+$/;

function parseArgs() {
  const [command = 'audit', ...rest] = process.argv.slice(2);
  const values = Object.fromEntries(rest.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...parts] = value.slice(2).split('=');
    return [key, parts.join('=') || 'true'];
  }));
  return { command, output: path.resolve(values.output || '.tmp/cloudflare-public-image-reconciliation'), plan: values.plan ? path.resolve(values.plan) : null };
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

export function parseCardManifest(source) {
  const result = {};
  const pattern = /"(\d+)":\s*\{\s*originUrl:\s*"([^"]+)",\s*smallKey:\s*"([^"]+)",\s*largeKey:\s*"([^"]+)",\s*\}/g;
  for (const match of source.matchAll(pattern)) {
    result[match[1]] = { originUrl: match[2], smallKey: match[3], largeKey: match[4] };
  }
  return result;
}

export function renderCardManifest(manifest) {
  const lines = ['export const PUBLIC_EXPERIENCE_CARD_IMAGES = {'];
  for (const [experienceId, image] of Object.entries(manifest)) {
    lines.push(`  ${JSON.stringify(experienceId)}: {`);
    lines.push(`    originUrl: ${JSON.stringify(image.originUrl)},`);
    lines.push(`    smallKey: ${JSON.stringify(image.smallKey)},`);
    lines.push(`    largeKey: ${JSON.stringify(image.largeKey)},`);
    lines.push('  },');
  }
  lines.push('} as const;', '');
  return lines.join('\n');
}

async function fetchPublicExperiences() {
  await loadLocalPublicEnvironment();
  const baseUrl = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = requireEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const query = new URLSearchParams({
    select: 'id,photos,image_url,itinerary,status,is_active', status: 'eq.active', is_active: 'eq.true', order: 'id.asc',
  });
  const response = await fetch(`${baseUrl}/rest/v1/experiences?${query}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!response.ok) throw new Error(`Public experience inventory failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No public active experiences were returned.');
  return rows;
}

export function normalizeInventory(rows) {
  return rows.map((experience) => {
    if (experience.status !== 'active' || experience.is_active !== true) throw new Error(`Experience ${experience.id} is not public and active.`);
    const hero = Array.isArray(experience.photos) && experience.photos.length > 0 ? experience.photos : [experience.image_url].filter(Boolean);
    const itinerary = Array.isArray(experience.itinerary) ? experience.itinerary.map((item) => item?.image_url).filter(Boolean) : [];
    const heroUrls = [...new Set(hero.map((url) => String(url || '').trim()).filter(Boolean))];
    const detailUrls = [...new Set([...heroUrls, ...itinerary.map((url) => String(url || '').trim())].filter(Boolean))];
    if (heroUrls.length === 0) throw new Error(`Public experience ${experience.id} has no public hero image.`);
    for (const url of detailUrls) if (!PUBLIC_IMAGE_PATTERN.test(url)) throw new Error(`Refusing non-public or unexpected image URL: ${url}`);
    return { id: String(experience.id), heroUrls, detailUrls };
  });
}

export function buildExpectedManifests(inventory, currentCards) {
  const cards = {};
  const details = {};
  for (const experience of inventory) {
    const primary = experience.heroUrls[0];
    const existingCard = currentCards[experience.id];
    const hash = urlHash(primary);
    cards[experience.id] = existingCard?.originUrl === primary ? existingCard : {
      originUrl: primary,
      smallKey: `cards/experience-${experience.id}-primary-${hash}-w384-q65.webp`,
      largeKey: `cards/experience-${experience.id}-primary-${hash}-w640-q65.webp`,
    };
    details[experience.id] = {};
    for (const originUrl of experience.detailUrls) {
      const detailHash = urlHash(originUrl);
      details[experience.id][originUrl] = {
        smallKey: `details/experience-${experience.id}-${detailHash}-w480-q75.webp`,
        mediumKey: `details/experience-${experience.id}-${detailHash}-w960-q75.webp`,
        largeKey: `details/experience-${experience.id}-${detailHash}-w1440-q75.webp`,
      };
    }
  }
  return { cards, details };
}

function snapshotHash(inventory) {
  return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}

function summarizeDrift(inventory, currentCards, currentDetails, expected) {
  const currentDetailUrls = new Set(Object.entries(currentDetails).flatMap(([id, images]) => Object.keys(images).map((url) => `${id}\n${url}`)));
  const expectedDetailUrls = new Set(inventory.flatMap((item) => item.detailUrls.map((url) => `${item.id}\n${url}`)));
  return {
    drift: renderCardManifest(currentCards) !== renderCardManifest(expected.cards) || stableJson(currentDetails) !== stableJson(expected.details),
    liveExperienceCount: inventory.length,
    liveSourceImageCount: inventory.reduce((total, item) => total + item.detailUrls.length, 0),
    currentCardCount: Object.keys(currentCards).length,
    expectedCardCount: Object.keys(expected.cards).length,
    currentDetailExperienceCount: Object.keys(currentDetails).length,
    currentDetailSourceImageCount: currentDetailUrls.size,
    expectedDetailSourceImageCount: expectedDetailUrls.size,
    missingDetailImageCount: [...expectedDetailUrls].filter((value) => !currentDetailUrls.has(value)).length,
    staleDetailImageCount: [...currentDetailUrls].filter((value) => !expectedDetailUrls.has(value)).length,
    snapshotHash: snapshotHash(inventory),
  };
}

async function loadState() {
  const [rows, cardSource, detailSource] = await Promise.all([fetchPublicExperiences(), readFile(CARD_MANIFEST_PATH, 'utf8'), readFile(DETAIL_MANIFEST_PATH, 'utf8')]);
  const inventory = normalizeInventory(rows);
  const currentCards = parseCardManifest(cardSource);
  const currentDetails = JSON.parse(detailSource);
  const expected = buildExpectedManifests(inventory, currentCards);
  return { inventory, currentCards, currentDetails, expected, summary: summarizeDrift(inventory, currentCards, currentDetails, expected) };
}

async function appendGithubOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

async function downloadSource(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error('empty response body');
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
    }
  }
  throw new Error(`Failed to download ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function prepare(state, outputDirectory) {
  const { default: sharp } = await import('sharp');
  const objectsDirectory = path.join(outputDirectory, 'objects');
  await mkdir(objectsDirectory, { recursive: true });
  const specifications = [];
  for (const experience of state.inventory) {
    const card = state.expected.cards[experience.id];
    specifications.push({ originUrl: card.originUrl, key: card.smallKey, width: 384, quality: 65 }, { originUrl: card.originUrl, key: card.largeKey, width: 640, quality: 65 });
    for (const [originUrl, entry] of Object.entries(state.expected.details[experience.id])) {
      specifications.push(
        { originUrl, key: entry.smallKey, width: 480, quality: 75 },
        { originUrl, key: entry.mediumKey, width: 960, quality: 75 },
        { originUrl, key: entry.largeKey, width: 1440, quality: 75 },
      );
    }
  }
  const keys = specifications.map((item) => item.key);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate expected R2 object key.');
  const sourceCache = new Map();
  const objects = [];
  for (const specification of specifications) {
    let source = sourceCache.get(specification.originUrl);
    if (!source) {
      source = await downloadSource(specification.originUrl);
      sourceCache.set(specification.originUrl, source);
    }
    const destination = path.join(objectsDirectory, specification.key);
    await mkdir(path.dirname(destination), { recursive: true });
    await sharp(source).rotate().resize({ width: specification.width, withoutEnlargement: true }).webp({ quality: specification.quality, effort: 5 }).toFile(destination);
    const bytes = await readFile(destination);
    objects.push({ key: specification.key, path: path.relative(outputDirectory, destination), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), contentType: 'image/webp' });
  }
  const previousKeys = new Set([
    ...Object.values(state.currentCards).flatMap((entry) => [entry.smallKey, entry.largeKey]),
    ...Object.values(state.currentDetails).flatMap((images) => Object.values(images).flatMap((entry) => [entry.smallKey, entry.mediumKey, entry.largeKey])),
  ]);
  const expectedKeys = new Set(objects.map((item) => item.key));
  const retainedStaleKeys = [...previousKeys].filter((key) => !expectedKeys.has(key)).sort();
  await Promise.all([
    writeFile(path.join(outputDirectory, 'publicExperienceCardImages.ts'), renderCardManifest(state.expected.cards)),
    writeFile(path.join(outputDirectory, 'publicExperienceDetailImages.generated.json'), stableJson(state.expected.details)),
    writeFile(path.join(outputDirectory, 'objects.json'), stableJson(objects)),
    writeFile(path.join(outputDirectory, 'plan.json'), stableJson({ version: 1, createdAt: new Date().toISOString(), snapshotHash: state.summary.snapshotHash, summary: state.summary, expectedObjectCount: objects.length, retainedStaleKeys })),
  ]);
  return { ...state.summary, expectedObjectCount: objects.length, retainedStaleObjectCount: retainedStaleKeys.length, outputDirectory };
}

async function main() {
  const args = parseArgs();
  if (args.command === 'verify-snapshot') {
    if (!args.plan) throw new Error('--plan is required for verify-snapshot.');
    const [state, plan] = await Promise.all([loadState(), readFile(args.plan, 'utf8').then(JSON.parse)]);
    if (state.summary.snapshotHash !== plan.snapshotHash) throw new Error(`Production image inventory changed during reconciliation: expected ${plan.snapshotHash}, received ${state.summary.snapshotHash}`);
    console.log(stableJson({ snapshotStable: true, ...state.summary }));
    return;
  }
  const state = await loadState();
  await mkdir(args.output, { recursive: true });
  await writeFile(path.join(args.output, 'audit.json'), stableJson(state.summary));
  await appendGithubOutput('drift', state.summary.drift ? 'true' : 'false');
  await appendGithubOutput('snapshot_hash', state.summary.snapshotHash);
  if (args.command === 'audit') {
    console.log(stableJson(state.summary));
    return;
  }
  if (args.command !== 'prepare') throw new Error(`Unknown command: ${args.command}`);
  if (!state.summary.drift) {
    console.log(stableJson({ ...state.summary, skipped: 'no-drift' }));
    return;
  }
  console.log(stableJson(await prepare(state, args.output)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
