import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const WIDTHS = [480, 960, 1440];
const QUALITY = 75;
const PUBLIC_EXPERIENCE_IMAGE_PATTERN = /^https:\/\/uhinvcydgzqlpnvieyal\.supabase\.co\/storage\/v1\/object\/public\/experiences\/experience\/[^/]+\/(?:hero|itinerary)\/[A-Za-z0-9._-]+$/;

function readArgument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const ids = requireValue('ids', readArgument('ids', ''))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const outputDirectory = path.resolve(readArgument('output', '.tmp/cloudflare-detail-canary'));
const manifestPath = path.resolve(
  readArgument('manifest', 'app/data/publicExperienceDetailImages.generated.json')
);

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  requireValue('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  requireValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  { auth: { persistSession: false } }
);

const { data: experiences, error } = await supabase
  .from('experiences')
  .select('id, photos, image_url, itinerary, status, is_active')
  .in('id', ids)
  .order('id');

if (error) throw error;
if (!experiences || experiences.length !== ids.length) {
  throw new Error(`Expected ${ids.length} public experiences, received ${experiences?.length || 0}.`);
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(path.dirname(manifestPath), { recursive: true });

const manifest = {};
const generatedKeys = new Set();

for (const experience of experiences) {
  if (experience.status !== 'active' || experience.is_active !== true) {
    throw new Error(`Experience ${experience.id} is not public and active.`);
  }

  const itineraryImages = Array.isArray(experience.itinerary)
    ? experience.itinerary.map((item) => String(item?.image_url || '').trim()).filter(Boolean)
    : [];
  const heroImages = Array.isArray(experience.photos) && experience.photos.length > 0
    ? experience.photos.map((url) => String(url || '').trim()).filter(Boolean)
    : [String(experience.image_url || '').trim()].filter(Boolean);
  const originUrls = Array.from(new Set([...heroImages, ...itineraryImages]));

  manifest[String(experience.id)] = {};

  for (const originUrl of originUrls) {
    if (!PUBLIC_EXPERIENCE_IMAGE_PATTERN.test(originUrl)) {
      throw new Error(`Refusing non-public or unexpected image URL: ${originUrl}`);
    }

    const response = await fetch(originUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${originUrl}: HTTP ${response.status}`);
    }

    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength === 0) throw new Error(`Downloaded empty image: ${originUrl}`);

    const hash = createHash('sha256').update(originUrl).digest('hex').slice(0, 12);
    const entry = {};

    for (const width of WIDTHS) {
      const fileName = `experience-${experience.id}-${hash}-w${width}-q${QUALITY}.webp`;
      const objectKey = `details/${fileName}`;
      if (generatedKeys.has(objectKey)) throw new Error(`Duplicate object key: ${objectKey}`);
      generatedKeys.add(objectKey);

      await sharp(source)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 5 })
        .toFile(path.join(outputDirectory, fileName));

      if (width === 480) entry.smallKey = objectKey;
      if (width === 960) entry.mediumKey = objectKey;
      if (width === 1440) entry.largeKey = objectKey;
    }

    manifest[String(experience.id)][originUrl] = entry;
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  experienceCount: experiences.length,
  imageCount: Object.values(manifest).reduce((total, images) => total + Object.keys(images).length, 0),
  objectCount: generatedKeys.size,
  outputDirectory,
  manifestPath,
}, null, 2));
