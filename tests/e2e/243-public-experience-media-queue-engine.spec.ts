import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import detailImageManifest from '../../app/data/publicExperienceDetailImages.generated.json';
import {
  buildPublicExperienceMediaInventory,
  createCloudflareImagesPublicExperienceTransformer,
  createR2PublicExperienceMediaMirrorStore,
  derivativeMetadata,
  mirrorPublicExperienceMedia,
  parsePublicExperienceMediaQueueMessage,
  PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL,
  PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
  PUBLIC_EXPERIENCE_MEDIA_SCHEDULED_TRANSFORM_ENGINE,
  PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_ENGINE,
  PublicExperienceMediaMirrorError,
  type MirrorObjectMetadata,
  type PublicExperienceMediaMirrorDependencies,
  type PublicExperienceMediaMirrorStore,
  type PublicExperienceMediaRow,
  type PublicExperienceMediaTransformer,
} from '../../app/utils/publicExperienceMediaQueueMirror';
import {
  buildPublicExperienceOriginalKey,
  normalizePublicExperienceSourceUrl,
} from '../../app/utils/publicExperienceMediaKeys';

const SOURCE_URL =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/source.jpg';
const ITINERARY_URL =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/itinerary/stop.jpg';
const SOURCE_BYTES = new TextEncoder().encode('source-image');
const NOW = new Date('2026-09-13T12:00:00.000Z');

const message = {
  schema: PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
  version: 1 as const,
  experienceId: '42',
  reason: 'edit' as const,
  eventId: 'event_20260913_0001',
};

const activeRow: PublicExperienceMediaRow = {
  id: 42,
  status: 'active',
  is_active: true,
  photos: [SOURCE_URL],
  itinerary: [],
  image_url: null,
};

type StoredObject = MirrorObjectMetadata & { bytes: Uint8Array };

class FakeStore implements PublicExperienceMediaMirrorStore {
  readonly objects = new Map<string, StoredObject>();
  readonly createCalls: Array<{
    key: string;
    body: Uint8Array;
    contentType: string;
    cacheControl: string;
    customMetadata: Record<string, string>;
    sha256: string;
  }> = [];
  beforeCreate?: (store: FakeStore, input: FakeStore['createCalls'][number]) => void;

  async head(key: string) {
    const value = this.objects.get(key);
    if (!value) return null;
    return {
      size: value.size,
      httpMetadata: { ...value.httpMetadata },
      customMetadata: { ...value.customMetadata },
    };
  }

  async getBytes(key: string) {
    const value = this.objects.get(key);
    return value ? value.bytes.slice() : null;
  }

  async createIfAbsent(input: FakeStore['createCalls'][number]) {
    this.createCalls.push({ ...input, body: input.body.slice() });
    if (this.beforeCreate) {
      const callback = this.beforeCreate;
      this.beforeCreate = undefined;
      callback(this, input);
    }
    if (this.objects.has(input.key)) return false;
    this.objects.set(input.key, {
      bytes: input.body.slice(),
      size: input.body.byteLength,
      httpMetadata: {
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      },
      customMetadata: { ...input.customMetadata },
    });
    return true;
  }
}

class FakeTransformer implements PublicExperienceMediaTransformer {
  readonly calls: Array<{ width: number; quality: number; format: string }> = [];

  constructor(private readonly engineMarker = 'cloudflare-images') {}

  async transform(input: {
    source: Uint8Array;
    width: number;
    quality: number;
    format: 'image/webp';
  }) {
    this.calls.push({
      width: input.width,
      quality: input.quality,
      format: input.format,
    });
    return {
      bytes: new TextEncoder().encode(
        `${this.engineMarker}:${input.width}:${input.quality}:${new TextDecoder().decode(input.source)}`
      ),
      contentType: 'image/webp',
    };
  }
}

function sourceResponse(bytes = SOURCE_BYTES, contentType = 'image/jpeg') {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    },
  });
}

function dependencies(options: {
  rows?: Array<PublicExperienceMediaRow | null>;
  store?: FakeStore;
  transformer?: PublicExperienceMediaTransformer;
  response?: Response;
} = {}) {
  const rows = options.rows || [activeRow, activeRow];
  let loadIndex = 0;
  const store = options.store || new FakeStore();
  const transformer = options.transformer || new FakeTransformer();
  const dependencySet: PublicExperienceMediaMirrorDependencies = {
    loadLatestExperience: async () => rows[Math.min(loadIndex++, rows.length - 1)],
    fetchSource: async () => options.response || sourceResponse(),
    store,
    transformer,
    now: () => NOW,
  };
  return {
    dependencySet,
    store,
    transformer,
    getTransformCalls: () =>
      transformer instanceof FakeTransformer ? transformer.calls : [],
    getLoadCount: () => loadIndex,
  };
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

test.describe('dormant public experience media Queue mirror engine', () => {
  test('validates the minimal versioned message and rejects payload expansion', () => {
    expect(parsePublicExperienceMediaQueueMessage(message)).toEqual(message);
    expect(parsePublicExperienceMediaQueueMessage({ ...message, sourceUrl: SOURCE_URL })).toBeNull();
    expect(parsePublicExperienceMediaQueueMessage({ ...message, reason: 'delete' })).toBeNull();
    expect(parsePublicExperienceMediaQueueMessage({ ...message, experienceId: SOURCE_URL })).toBeNull();
  });

  test('valid message reloads the latest active row and conditionally creates originals and derivatives', async () => {
    const harness = dependencies();
    const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);

    expect(outcome.status).toBe('success');
    expect(outcome.disposition).toBe('ack');
    expect(harness.getLoadCount()).toBe(2);
    expect(outcome.originalCreatedCount).toBe(1);
    expect(outcome.derivativeCreatedCount).toBe(5);
    expect(harness.store.createCalls).toHaveLength(6);
    expect(harness.store.createCalls.every((call) => call.cacheControl === PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL)).toBe(true);
  });

  test('duplicate at-least-once delivery is idempotent and performs no second write', async () => {
    const store = new FakeStore();
    const first = dependencies({ store });
    expect((await mirrorPublicExperienceMedia(message, first.dependencySet)).status).toBe('success');
    const writesAfterFirst = store.createCalls.length;
    const second = dependencies({ store });
    const outcome = await mirrorPublicExperienceMedia(message, second.dependencySet);

    expect(outcome.status).toBe('already_exact');
    expect(outcome.originalExactSkipCount).toBe(1);
    expect(outcome.derivativeExactSkipCount).toBe(5);
    expect(store.createCalls).toHaveLength(writesAfterFirst);
    expect(second.getTransformCalls()).toHaveLength(0);
  });

  test('reads an authoritative R2 source directly and does not mirror an original-of-original', async () => {
    const legacy = normalizePublicExperienceSourceUrl(SOURCE_URL);
    const sourceSha = sha256(SOURCE_BYTES);
    const r2Key = buildPublicExperienceOriginalKey(legacy.sourceKey, sourceSha, 'image/jpeg');
    const r2Url = `https://media-canary.locally-travel.com/${r2Key}?legacy=${legacy.derivativeIdentity}`;
    const store = new FakeStore();
    store.objects.set(r2Key, {
      bytes: SOURCE_BYTES,
      size: SOURCE_BYTES.byteLength,
      httpMetadata: { contentType: 'image/jpeg', cacheControl: PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL },
      customMetadata: {
        sha256: sourceSha,
        source_key_sha256: legacy.sourceKeySha256,
        source_byte_sha256: sourceSha,
        output_byte_sha256: sourceSha,
        source_size: String(SOURCE_BYTES.byteLength),
      },
    });
    let fetchCount = 0;
    const row = { ...activeRow, photos: [r2Url] };
    const harness = dependencies({ rows: [row, row], store });
    harness.dependencySet.fetchSource = async () => {
      fetchCount += 1;
      throw new Error('R2 source must not use HTTP');
    };
    const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);
    expect(outcome.status).toBe('success');
    expect(outcome.originalCreatedCount).toBe(0);
    expect(outcome.originalExactSkipCount).toBe(1);
    expect(fetchCount).toBe(0);
    expect(store.createCalls.every((call) => !call.key.startsWith('originals/v1/'))).toBe(true);
    expect(store.createCalls).toHaveLength(5);
  });

  test('fails closed before transform when authoritative R2 source proof conflicts', async () => {
    const legacy = normalizePublicExperienceSourceUrl(SOURCE_URL);
    const sourceSha = sha256(SOURCE_BYTES);
    const r2Key = buildPublicExperienceOriginalKey(legacy.sourceKey, sourceSha, 'image/jpeg');
    const r2Url = `https://media-canary.locally-travel.com/${r2Key}?legacy=${legacy.derivativeIdentity}`;
    const store = new FakeStore();
    store.objects.set(r2Key, {
      bytes: SOURCE_BYTES,
      size: SOURCE_BYTES.byteLength,
      httpMetadata: { contentType: 'image/jpeg', cacheControl: PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL },
      customMetadata: {
        source_key_sha256: legacy.sourceKeySha256,
        source_byte_sha256: '0'.repeat(64),
        output_byte_sha256: sourceSha,
        source_size: String(SOURCE_BYTES.byteLength),
      },
    });
    const row = { ...activeRow, photos: [r2Url] };
    const harness = dependencies({ rows: [row, row], store });
    const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);
    expect(outcome.status).toBe('permanent_conflict');
    expect(outcome.diagnosticCode).toBe('r2_source_conflict');
    expect(harness.getTransformCalls()).toHaveLength(0);
    expect(store.createCalls).toHaveLength(0);
  });

  test('inactive or deleted latest row is an acknowledged zero-write no-op', async () => {
    for (const row of [{ ...activeRow, is_active: false }, null]) {
      const harness = dependencies({ rows: [row] });
      const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);
      expect(outcome.status).toBe('ineligible_noop');
      expect(outcome.disposition).toBe('ack');
      expect(harness.store.createCalls).toHaveLength(0);
      expect(harness.getTransformCalls()).toHaveLength(0);
    }
  });

  test('stale event payload cannot override the current authoritative row', async () => {
    const harness = dependencies();
    const outcome = await mirrorPublicExperienceMedia(
      { ...message, reason: 'create', eventId: 'old_event_00000001' },
      harness.dependencySet
    );
    expect(outcome.status).toBe('success');
    expect(harness.getLoadCount()).toBe(2);
    expect(outcome.sourceCount).toBe(1);
  });

  test('source drift after immutable writes is retryable and never reported as success', async () => {
    const changedRow = { ...activeRow, photos: [ITINERARY_URL] };
    const harness = dependencies({ rows: [activeRow, changedRow] });
    const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);
    expect(outcome.status).toBe('source_drift');
    expect(outcome.disposition).toBe('retry');
    expect(outcome.originalCreatedCount + outcome.derivativeCreatedCount).toBeGreaterThan(0);
  });

  test('invalid Production Storage namespace and query/hash variants fail closed', async () => {
    for (const invalidSource of [
      'https://example.com/storage/v1/object/public/experiences/experience/id/hero/a.jpg',
      `${SOURCE_URL}?variant=1`,
      SOURCE_URL.replace('/experiences/', '/avatars/'),
      SOURCE_URL.replace('source.jpg', '%ZZ.jpg'),
    ]) {
      const row = { ...activeRow, photos: [invalidSource] };
      const harness = dependencies({ rows: [row] });
      const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);
      expect(outcome.status).toBe('permanent_conflict');
      expect(outcome.disposition).toBe('dead_letter');
      expect(outcome.diagnosticStage).toBe('inventory_build');
      expect(harness.store.createCalls).toHaveLength(0);
    }
  });

  test('deduplicates repeated source references and derivative specifications', () => {
    const inventory = buildPublicExperienceMediaInventory({
      ...activeRow,
      photos: [SOURCE_URL, SOURCE_URL],
      itinerary: [{ image_url: SOURCE_URL }, { image_url: ITINERARY_URL }, { image_url: ITINERARY_URL }],
      image_url: SOURCE_URL,
    });
    expect(inventory.sources).toHaveLength(2);
    expect(inventory.derivatives).toHaveLength(8);
    expect(new Set(inventory.derivatives.map((item) => item.key)).size).toBe(8);
  });

  test('matches all current card/detail manifests through the canonical inventory contract', () => {
    let sourceCount = 0;
    let derivativeCount = 0;
    for (const [experienceId, card] of Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)) {
      const detailEntries = Object.entries(
        detailImageManifest[experienceId as keyof typeof detailImageManifest]
      );
      const remaining = detailEntries
        .map(([sourceUrl]) => sourceUrl)
        .filter((sourceUrl) => sourceUrl !== card.originUrl);
      const inventory = buildPublicExperienceMediaInventory({
        id: experienceId,
        status: 'active',
        is_active: true,
        photos: [card.originUrl],
        itinerary: remaining.map((image_url) => ({ image_url })),
      });
      const actualKeys = new Set(inventory.derivatives.map((item) => item.key));
      const expectedKeys = new Set([
        card.smallKey,
        card.largeKey,
        ...detailEntries.flatMap(([, entry]) => [entry.smallKey, entry.mediumKey, entry.largeKey]),
      ]);
      expect(actualKeys).toEqual(expectedKeys);
      sourceCount += inventory.sources.length;
      derivativeCount += inventory.derivatives.length;
    }
    expect(sourceCount).toBe(263);
    expect(derivativeCount).toBe(855);
  });

  test('uses exact card/detail dimensions and Cloudflare Images q65/q75 WebP calls', async () => {
    const transformer = new FakeTransformer();
    const row = {
      ...activeRow,
      itinerary: [{ image_url: ITINERARY_URL }],
    };
    const harness = dependencies({ rows: [row, row], transformer });
    await mirrorPublicExperienceMedia(message, harness.dependencySet);

    expect(transformer.calls).toEqual([
      { width: 384, quality: 65, format: 'image/webp' },
      { width: 640, quality: 65, format: 'image/webp' },
      { width: 480, quality: 75, format: 'image/webp' },
      { width: 960, quality: 75, format: 'image/webp' },
      { width: 1440, quality: 75, format: 'image/webp' },
      { width: 480, quality: 75, format: 'image/webp' },
      { width: 960, quality: 75, format: 'image/webp' },
      { width: 1440, quality: 75, format: 'image/webp' },
    ]);
  });

  test('uses the current immutable original identity and exact metadata contract', async () => {
    const harness = dependencies();
    await mirrorPublicExperienceMedia(message, harness.dependencySet);
    const normalized = normalizePublicExperienceSourceUrl(SOURCE_URL);
    const sourceSha = sha256(SOURCE_BYTES);
    const originalKey = buildPublicExperienceOriginalKey(
      normalized.sourceKey,
      sourceSha,
      'image/jpeg'
    );
    const original = harness.store.objects.get(originalKey);

    expect(original?.bytes).toEqual(SOURCE_BYTES);
    expect(original?.customMetadata).toMatchObject({
      sha256: sourceSha,
      source_key_sha256: sha256(new TextEncoder().encode(normalized.sourceKey)),
      source_byte_sha256: sourceSha,
      output_byte_sha256: sourceSha,
      source_size: String(SOURCE_BYTES.byteLength),
      provenance_status: 'verified',
      transform_schema_version: '1',
      transform_engine: 'source-copy',
    });
  });

  test('an exact pre-existing original is skipped while a conflicting original fails permanently', async () => {
    const store = new FakeStore();
    const first = dependencies({ store });
    await mirrorPublicExperienceMedia(message, first.dependencySet);
    const originalEntry = [...store.objects.entries()].find(([key]) => key.startsWith('originals/v1/'))!;
    const originalWriteCount = store.createCalls.filter((call) => call.key.startsWith('originals/v1/')).length;

    const exact = dependencies({ store });
    expect((await mirrorPublicExperienceMedia(message, exact.dependencySet)).originalExactSkipCount).toBe(1);
    expect(store.createCalls.filter((call) => call.key.startsWith('originals/v1/'))).toHaveLength(originalWriteCount);

    originalEntry[1].customMetadata.source_byte_sha256 = '0'.repeat(64);
    const conflict = dependencies({ store });
    const outcome = await mirrorPublicExperienceMedia(message, conflict.dependencySet);
    expect(outcome.status).toBe('permanent_conflict');
    expect(outcome.diagnosticCode).toBe('original_conflict');
    expect(outcome.diagnosticStage).toBe('original_check');
  });

  test('a conditional-create race validates the winner and never overwrites it', async () => {
    const store = new FakeStore();
    store.beforeCreate = (currentStore, input) => {
      currentStore.objects.set(input.key, {
        bytes: input.body.slice(),
        size: input.body.byteLength,
        httpMetadata: {
          contentType: input.contentType,
          cacheControl: input.cacheControl,
        },
        customMetadata: { ...input.customMetadata, additional_provenance: 'preserved' },
      });
    };
    const harness = dependencies({ store });
    const outcome = await mirrorPublicExperienceMedia(message, harness.dependencySet);
    expect(outcome.status).toBe('success');
    expect([...store.objects.values()][0].customMetadata.additional_provenance).toBe('preserved');
  });

  test('valid repaired Sharp provenance is an exact skip and extra metadata is preserved', async () => {
    const store = new FakeStore();
    const first = dependencies({ store });
    await mirrorPublicExperienceMedia(message, first.dependencySet);
    const derivative = [...store.objects.entries()].find(([key]) => !key.startsWith('originals/v1/'))!;
    const metadata = derivative[1].customMetadata;
    derivative[1].customMetadata = {
      sha256: metadata.sha256,
      output_byte_sha256: metadata.output_byte_sha256,
      source_key_sha256: metadata.source_key_sha256,
      source_byte_sha256: metadata.source_byte_sha256,
      transform_width: metadata.transform_width,
      transform_quality: metadata.transform_quality,
      transform_format: metadata.transform_format,
      provenance_status: 'legacy-observed',
      sharp_version: 'historical',
    };
    const writes = store.createCalls.length;

    const second = dependencies({ store });
    const outcome = await mirrorPublicExperienceMedia(message, second.dependencySet);
    expect(outcome.status).toBe('already_exact');
    expect(store.createCalls).toHaveLength(writes);
    expect(derivative[1].customMetadata.sharp_version).toBe('historical');
  });

  test('valid Queue provenance skips, while conflicting source/spec proof fails closed', async () => {
    const store = new FakeStore();
    await mirrorPublicExperienceMedia(message, dependencies({ store }).dependencySet);
    const queueDerivative = [...store.objects.values()].find(
      (object) => object.customMetadata.transform_engine === PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_ENGINE
    )!;
    expect((await mirrorPublicExperienceMedia(message, dependencies({ store }).dependencySet)).status).toBe('already_exact');

    queueDerivative.customMetadata.transform_quality = '1';
    const conflict = await mirrorPublicExperienceMedia(message, dependencies({ store }).dependencySet);
    expect(conflict.status).toBe('permanent_conflict');
    expect(conflict.diagnosticCode).toBe('derivative_conflict');
    expect(conflict.diagnosticStage).toBe('derivative_process');
  });

  test('accepts self-consistent scheduled Sharp provenance with different bytes and rejects unknown engines', async () => {
    const store = new FakeStore();
    await mirrorPublicExperienceMedia(message, dependencies({ store }).dependencySet);
    const derivative = [...store.objects.entries()].find(([key]) => key.includes('-w384-q65.webp'))!;
    const queueOutputSha = derivative[1].customMetadata.output_byte_sha256;
    const sharpBytes = new TextEncoder().encode('scheduled-sharp-output');
    const sharpSha = sha256(sharpBytes);
    derivative[1].bytes = sharpBytes;
    derivative[1].size = sharpBytes.byteLength;
    derivative[1].customMetadata = {
      ...derivative[1].customMetadata,
      sha256: sharpSha,
      output_byte_sha256: sharpSha,
      transform_engine: PUBLIC_EXPERIENCE_MEDIA_SCHEDULED_TRANSFORM_ENGINE,
      additional_provenance: 'preserved',
    };
    const writesBefore = store.createCalls.length;

    const exact = await mirrorPublicExperienceMedia(message, dependencies({ store }).dependencySet);
    expect(sharpSha).not.toBe(queueOutputSha);
    expect(exact.status).toBe('already_exact');
    expect(store.createCalls).toHaveLength(writesBefore);
    expect(derivative[1].customMetadata.additional_provenance).toBe('preserved');

    derivative[1].customMetadata.transform_engine = 'unknown-transformer';
    const conflict = await mirrorPublicExperienceMedia(message, dependencies({ store }).dependencySet);
    expect(conflict.status).toBe('permanent_conflict');
    expect(conflict.disposition).toBe('dead_letter');
    expect(conflict.diagnosticCode).toBe('derivative_conflict');
    expect(store.createCalls).toHaveLength(writesBefore);
  });

  test('Cloudflare Images and hypothetical Sharp bytes may diverge without changing the key contract', async () => {
    const cfStore = new FakeStore();
    const cfHarness = dependencies({
      store: cfStore,
      transformer: new FakeTransformer('cloudflare-images'),
    });
    await mirrorPublicExperienceMedia(message, cfHarness.dependencySet);
    const derivativeEntry = [...cfStore.objects.entries()].find(([key]) => key.includes('-w384-q65.webp'))!;
    const hypotheticalSharpBytes = new TextEncoder().encode('sharp-linux-output');

    expect(derivativeEntry[1].bytes).not.toEqual(hypotheticalSharpBytes);
    expect(derivativeEntry[0]).toContain('-w384-q65.webp');
    expect(derivativeEntry[1].customMetadata.output_byte_sha256).toBe(sha256(derivativeEntry[1].bytes));
    expect((await mirrorPublicExperienceMedia(message, dependencies({ store: cfStore }).dependencySet)).status).toBe('already_exact');
  });

  test('Cloudflare Images binding adapter uses raw stream, exact width, WebP, and quality', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const output = new TextEncoder().encode('binding-webp');
    const adapter = createCloudflareImagesPublicExperienceTransformer({
      input(stream) {
        calls.push({ inputIsStream: stream instanceof ReadableStream });
        return {
          transform(options) {
            calls.push(options);
            return this;
          },
          async output(options) {
            calls.push(options);
            return {
              contentType: () => 'image/webp',
              image: () => new ReadableStream({
                start(controller) {
                  controller.enqueue(output);
                  controller.close();
                },
              }),
            };
          },
        };
      },
    });
    expect(await adapter.transform({ source: SOURCE_BYTES, width: 640, quality: 65, format: 'image/webp' })).toEqual({
      bytes: output,
      contentType: 'image/webp',
    });
    expect(calls).toEqual([
      { inputIsStream: true },
      { width: 640 },
      { format: 'image/webp', quality: 65 },
    ]);
  });

  test('R2 binding adapter makes create-only put requests and validates conditional conflicts', async () => {
    const puts: Array<Record<string, unknown>> = [];
    let exists = false;
    const adapter = createR2PublicExperienceMediaMirrorStore({
      async head() { return null; },
      async get() { return null; },
      async put(key, value, options) {
        puts.push({ key, value, options });
        if (exists) return null;
        exists = true;
        return { size: value.byteLength };
      },
    });
    const input = {
      key: 'cards/example.webp',
      body: new Uint8Array([1]),
      contentType: 'image/webp',
      cacheControl: PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL,
      customMetadata: { sha256: 'a'.repeat(64) },
      sha256: 'a'.repeat(64),
    };
    expect(await adapter.createIfAbsent(input)).toBe(true);
    expect(await adapter.createIfAbsent(input)).toBe(false);
    expect(puts[0].options).toMatchObject({ onlyIf: { etagDoesNotMatch: '*' } });
  });

  test('source/Images failures are bounded, typed, and do not expose raw URLs', async () => {
    const sourceFailure = dependencies({ response: new Response('', { status: 503 }) });
    const first = await mirrorPublicExperienceMedia(message, sourceFailure.dependencySet);
    expect(first.status).toBe('transient_failure');
    expect(first.disposition).toBe('retry');
    expect(first.diagnosticCode).toBe('source_http_server_error');
    expect(first.diagnosticStage).toBe('source_fetch');
    expect(first.httpStatus).toBe(503);
    expect(JSON.stringify(first)).not.toContain('https://');

    const invalidType = dependencies({ response: sourceResponse(SOURCE_BYTES, 'text/html') });
    const second = await mirrorPublicExperienceMedia(message, invalidType.dependencySet);
    expect(second.status).toBe('permanent_conflict');
    expect(second.disposition).toBe('dead_letter');
    expect(JSON.stringify(second)).not.toContain('11111111-1111-4111-8111-111111111111');

    const oversized = dependencies({
      response: new Response(SOURCE_BYTES, {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': String(10 * 1024 * 1024 + 1),
        },
      }),
    });
    const third = await mirrorPublicExperienceMedia(message, oversized.dependencySet);
    expect(third.status).toBe('permanent_conflict');
    expect(third.diagnosticCode).toBe('invalid_source_size');

    const imagesFailure = dependencies({
      transformer: {
        async transform() {
          throw new Error(`provider failed for ${SOURCE_URL}`);
        },
      },
    });
    const fourth = await mirrorPublicExperienceMedia(message, imagesFailure.dependencySet);
    expect(fourth.status).toBe('transient_failure');
    expect(fourth.disposition).toBe('retry');
    expect(fourth.diagnosticStage).toBe('derivative_process');
    expect(JSON.stringify(fourth)).not.toContain(SOURCE_URL);
  });

  test('final latest-row failure preserves completed counts and its bounded stage', async () => {
    const base = dependencies();
    let loadCount = 0;
    const outcome = await mirrorPublicExperienceMedia(message, {
      ...base.dependencySet,
      async loadLatestExperience() {
        loadCount += 1;
        if (loadCount === 1) return activeRow;
        throw new PublicExperienceMediaMirrorError(
          'transient',
          'latest_row_fetch_network_error'
        );
      },
    });

    expect(outcome).toMatchObject({
      status: 'transient_failure',
      disposition: 'retry',
      diagnosticCode: 'latest_row_fetch_network_error',
      diagnosticStage: 'final_row_load',
      sourceCount: 1,
      derivativeCount: 5,
      originalCreatedCount: 1,
      derivativeCreatedCount: 5,
    });
  });

  test('contains no overwrite, Copy, Delete, or scheduled activation path', () => {
    const engineSource = readFileSync('app/utils/publicExperienceMediaQueueMirror.ts', 'utf8');
    const scheduledWorkflow = readFileSync('.github/workflows/public-experience-image-reconciliation.yml', 'utf8');

    expect(engineSource).not.toMatch(/\.(delete|copy|overwrite)\s*\(/i);
    expect(engineSource).not.toContain('upload_file');
    expect(scheduledWorkflow).not.toContain('publicExperienceMediaQueueMirror');
  });

  test('records complete provenance without binding deterministic keys to Sharp byte output', () => {
    const inventory = buildPublicExperienceMediaInventory(activeRow);
    const specification = inventory.derivatives[0];
    const metadata = derivativeMetadata({
      sourceKeySha256: specification.sourceKeySha256,
      sourceByteSha256: 'a'.repeat(64),
      sourceSize: 123,
      outputByteSha256: 'b'.repeat(64),
      specification,
      generatedAt: NOW.toISOString(),
    });
    expect(metadata).toEqual({
      sha256: 'b'.repeat(64),
      output_byte_sha256: 'b'.repeat(64),
      source_key_sha256: specification.sourceKeySha256,
      source_byte_sha256: 'a'.repeat(64),
      source_size: '123',
      transform_width: '384',
      transform_quality: '65',
      transform_format: 'webp',
      transform_schema_version: '1',
      transform_engine: 'cloudflare-images-binding',
      derivative_role: 'card',
      provenance_status: 'verified',
      generated_at: NOW.toISOString(),
    });
    expect(metadata).not.toHaveProperty('source_url');
    expect(metadata).not.toHaveProperty('source_object_key');
  });
});
