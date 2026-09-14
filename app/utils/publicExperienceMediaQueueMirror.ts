import {
  buildPublicExperienceCardKeys,
  buildPublicExperienceDetailKeys,
  buildPublicExperienceOriginalKey,
  isPublicExperienceR2Eligible,
  normalizePublicExperienceSourceUrl,
  PUBLIC_EXPERIENCE_CARD_DERIVATIVES,
  PUBLIC_EXPERIENCE_DETAIL_DERIVATIVES,
  sha256Hex,
} from './publicExperienceMediaKeys';
import provenanceContract from '../data/publicExperienceMediaProvenance.json';

export const PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA =
  'locally.public-experience-media-mirror';
export const PUBLIC_EXPERIENCE_MEDIA_MESSAGE_VERSION = 1 as const;
export const PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL =
  'public, max-age=31536000, immutable';
export const PUBLIC_EXPERIENCE_MEDIA_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_SCHEMA_VERSION =
  provenanceContract.transformSchemaVersion;
export const PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_ENGINE =
  provenanceContract.transformEngines.cloudflareImages;
export const PUBLIC_EXPERIENCE_MEDIA_SCHEDULED_TRANSFORM_ENGINE =
  provenanceContract.transformEngines.scheduledSharp;

const ALLOWED_DERIVATIVE_TRANSFORM_ENGINES = new Set(
  provenanceContract.allowedDerivativeEngines
);

export const PUBLIC_EXPERIENCE_MEDIA_REASONS = [
  'create',
  'edit',
  'activation',
  'reorder',
  'reconcile',
] as const;

const SUPPORTED_SOURCE_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type PublicExperienceMediaQueueReason =
  (typeof PUBLIC_EXPERIENCE_MEDIA_REASONS)[number];

export type PublicExperienceMediaQueueMessage = {
  schema: typeof PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA;
  version: typeof PUBLIC_EXPERIENCE_MEDIA_MESSAGE_VERSION;
  experienceId: string;
  reason: PublicExperienceMediaQueueReason;
  eventId: string;
};

export type PublicExperienceMediaRow = {
  id: number | string;
  status?: string | null;
  is_active?: boolean | null;
  photos?: unknown;
  itinerary?: unknown;
  image_url?: unknown;
};

type DerivativeRole = 'card' | 'detail';

export type PublicExperienceMediaDerivativeSpecification = {
  role: DerivativeRole;
  sourceKeySha256: string;
  key: string;
  width: number;
  quality: number;
  format: 'webp';
};

type SourceInventoryItem = {
  sourceUrl: string;
  sourceKey: string;
  sourceKeySha256: string;
};

export type PublicExperienceMediaInventory = {
  experienceId: string;
  sources: SourceInventoryItem[];
  derivatives: PublicExperienceMediaDerivativeSpecification[];
  snapshotDigest: string;
};

export type MirrorObjectMetadata = {
  size: number;
  httpMetadata: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata: Record<string, string>;
};

export interface PublicExperienceMediaMirrorStore {
  head(key: string): Promise<MirrorObjectMetadata | null>;
  getBytes(key: string): Promise<Uint8Array | null>;
  createIfAbsent(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    cacheControl: string;
    customMetadata: Record<string, string>;
    sha256: string;
  }): Promise<boolean>;
}

export interface PublicExperienceMediaTransformer {
  transform(input: {
    source: Uint8Array;
    width: number;
    quality: number;
    format: 'image/webp';
  }): Promise<{ bytes: Uint8Array; contentType: string }>;
}

export type PublicExperienceMediaMirrorDependencies = {
  loadLatestExperience: (
    experienceId: string
  ) => Promise<PublicExperienceMediaRow | null>;
  fetchSource: (sourceUrl: string) => Promise<Response>;
  store: PublicExperienceMediaMirrorStore;
  transformer: PublicExperienceMediaTransformer;
  now?: () => Date;
};

export type PublicExperienceMediaOutcomeStatus =
  | 'success'
  | 'already_exact'
  | 'ineligible_noop'
  | 'source_drift'
  | 'transient_failure'
  | 'permanent_conflict'
  | 'invalid_message';

export type PublicExperienceMediaQueueDisposition =
  | 'ack'
  | 'retry'
  | 'dead_letter';

export type PublicExperienceMediaMirrorOutcome = {
  status: PublicExperienceMediaOutcomeStatus;
  disposition: PublicExperienceMediaQueueDisposition;
  experienceId?: string;
  sourceSnapshotDigest?: string;
  sourceCount: number;
  derivativeCount: number;
  originalCreatedCount: number;
  originalExactSkipCount: number;
  derivativeCreatedCount: number;
  derivativeExactSkipCount: number;
  diagnosticCode?: string;
};

type R2ObjectLike = {
  size: number;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
};

type R2ObjectBodyLike = R2ObjectLike & {
  bytes(): Promise<Uint8Array>;
};

export interface PublicExperienceMediaR2BindingLike {
  head(key: string): Promise<R2ObjectLike | null>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: Uint8Array,
    options: {
      onlyIf: { etagDoesNotMatch: '*' };
      httpMetadata: { contentType: string; cacheControl: string };
      customMetadata: Record<string, string>;
      sha256: string;
    }
  ): Promise<R2ObjectLike | null>;
}

type ImagesTransformationResultLike = {
  contentType(): string;
  image(): ReadableStream<Uint8Array>;
};

type ImagesTransformerLike = {
  transform(options: { width: number }): ImagesTransformerLike;
  output(options: {
    format: 'image/webp';
    quality: number;
  }): Promise<ImagesTransformationResultLike>;
};

export interface PublicExperienceMediaImagesBindingLike {
  input(stream: ReadableStream<Uint8Array>): ImagesTransformerLike;
}

class MirrorEngineError extends Error {
  constructor(
    readonly kind: 'transient' | 'permanent',
    readonly diagnosticCode: string
  ) {
    super(diagnosticCode);
    this.name = 'MirrorEngineError';
  }
}

function normalizeContentType(value: string | null | undefined) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function normalizeExperienceId(value: number | string) {
  const normalized = String(value);
  if (!/^[1-9][0-9]{0,18}$/.test(normalized)) {
    throw new MirrorEngineError('permanent', 'invalid_experience_id');
  }
  return normalized;
}

function sourceUrlList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function itineraryUrlList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || !('image_url' in item)) return '';
      const imageUrl = item.image_url;
      return typeof imageUrl === 'string' ? imageUrl.trim() : '';
    })
    .filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function buildDerivativeSpecifications(
  experienceId: string,
  primarySourceUrl: string,
  detailSourceUrls: string[]
) {
  const specifications: PublicExperienceMediaDerivativeSpecification[] = [];
  const cardKeys = buildPublicExperienceCardKeys(experienceId, primarySourceUrl);
  for (const [index, derivative] of PUBLIC_EXPERIENCE_CARD_DERIVATIVES.entries()) {
    specifications.push({
      role: 'card',
      sourceKeySha256: sha256Hex(
        normalizePublicExperienceSourceUrl(primarySourceUrl).sourceKey
      ),
      key: index === 0 ? cardKeys.smallKey : cardKeys.largeKey,
      width: derivative.width,
      quality: derivative.quality,
      format: 'webp',
    });
  }

  for (const sourceUrl of detailSourceUrls) {
    const detailKeys = buildPublicExperienceDetailKeys(experienceId, sourceUrl);
    const keys = [detailKeys.smallKey, detailKeys.mediumKey, detailKeys.largeKey];
    const sourceKeySha256 = sha256Hex(
      normalizePublicExperienceSourceUrl(sourceUrl).sourceKey
    );
    for (const [index, derivative] of PUBLIC_EXPERIENCE_DETAIL_DERIVATIVES.entries()) {
      specifications.push({
        role: 'detail',
        sourceKeySha256,
        key: keys[index],
        width: derivative.width,
        quality: derivative.quality,
        format: 'webp',
      });
    }
  }

  if (new Set(specifications.map((item) => item.key)).size !== specifications.length) {
    throw new MirrorEngineError('permanent', 'duplicate_derivative_key');
  }
  return specifications;
}

export function buildPublicExperienceMediaInventory(
  row: PublicExperienceMediaRow
): PublicExperienceMediaInventory {
  const experienceId = normalizeExperienceId(row.id);
  const photos = sourceUrlList(row.photos);
  const itinerary = itineraryUrlList(row.itinerary);
  const legacy =
    typeof row.image_url === 'string' && row.image_url.trim()
      ? [row.image_url.trim()]
      : [];
  const heroUrls = unique(photos.length > 0 ? photos : legacy);
  if (heroUrls.length === 0) {
    throw new MirrorEngineError('permanent', 'missing_primary_source');
  }
  const detailUrls = unique([...heroUrls, ...itinerary]);
  const allSourceUrls = unique([...photos, ...itinerary, ...legacy]);
  const sourcesByKey = new Map<string, SourceInventoryItem>();

  for (const sourceUrl of allSourceUrls) {
    let normalized: ReturnType<typeof normalizePublicExperienceSourceUrl>;
    try {
      normalized = normalizePublicExperienceSourceUrl(sourceUrl);
    } catch {
      throw new MirrorEngineError('permanent', 'invalid_source_namespace');
    }
    const existing = sourcesByKey.get(normalized.sourceKey);
    if (existing && existing.sourceUrl !== normalized.sourceUrl) {
      throw new MirrorEngineError('permanent', 'ambiguous_source_identity');
    }
    sourcesByKey.set(normalized.sourceKey, {
      sourceUrl: normalized.sourceUrl,
      sourceKey: normalized.sourceKey,
      sourceKeySha256: sha256Hex(normalized.sourceKey),
    });
  }

  const derivatives = buildDerivativeSpecifications(
    experienceId,
    heroUrls[0],
    detailUrls
  );
  const sources = [...sourcesByKey.values()].sort((left, right) =>
    left.sourceKeySha256.localeCompare(right.sourceKeySha256)
  );
  const snapshotDigest = sha256Hex(
    JSON.stringify({
      experienceId,
      status: row.status ?? null,
      isActive: row.is_active ?? null,
      sources: sources.map((item) => ({
        sourceKeySha256: item.sourceKeySha256,
        sourceUrlSha256: sha256Hex(item.sourceUrl),
      })),
      derivatives: derivatives.map(({ key, role, width, quality, sourceKeySha256 }) => ({
        key,
        role,
        width,
        quality,
        sourceKeySha256,
      })),
    })
  );

  return { experienceId, sources, derivatives, snapshotDigest };
}

export function parsePublicExperienceMediaQueueMessage(
  value: unknown
): PublicExperienceMediaQueueMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const expectedKeys = ['eventId', 'experienceId', 'reason', 'schema', 'version'];
  if (Object.keys(record).sort().join('\0') !== expectedKeys.join('\0')) return null;
  if (
    record.schema !== PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA ||
    record.version !== PUBLIC_EXPERIENCE_MEDIA_MESSAGE_VERSION ||
    typeof record.experienceId !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(record.experienceId) ||
    typeof record.reason !== 'string' ||
    !PUBLIC_EXPERIENCE_MEDIA_REASONS.includes(
      record.reason as PublicExperienceMediaQueueReason
    ) ||
    typeof record.eventId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(record.eventId)
  ) {
    return null;
  }
  return {
    schema: record.schema,
    version: record.version,
    experienceId: record.experienceId,
    reason: record.reason as PublicExperienceMediaQueueReason,
    eventId: record.eventId,
  };
}

function bytesToStream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
  diagnosticCode: string
) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new MirrorEngineError('permanent', diagnosticCode);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function sha256Bytes(bytes: Uint8Array) {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', digestInput.buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function createCloudflareImagesPublicExperienceTransformer(
  binding: PublicExperienceMediaImagesBindingLike
): PublicExperienceMediaTransformer {
  return {
    async transform(input) {
      try {
        const result = await binding
          .input(bytesToStream(input.source))
          .transform({ width: input.width })
          .output({ format: input.format, quality: input.quality });
        const contentType = normalizeContentType(result.contentType());
        const bytes = await readBoundedStream(
          result.image(),
          PUBLIC_EXPERIENCE_MEDIA_MAX_SOURCE_BYTES,
          'images_output_too_large'
        );
        if (bytes.byteLength === 0 || contentType !== 'image/webp') {
          throw new MirrorEngineError('transient', 'images_invalid_output');
        }
        return { bytes, contentType };
      } catch (error) {
        if (error instanceof MirrorEngineError) throw error;
        throw new MirrorEngineError('transient', 'images_transform_failed');
      }
    },
  };
}

export function createR2PublicExperienceMediaMirrorStore(
  binding: PublicExperienceMediaR2BindingLike
): PublicExperienceMediaMirrorStore {
  return {
    async head(key) {
      const object = await binding.head(key);
      if (!object) return null;
      return {
        size: object.size,
        httpMetadata: {
          contentType: object.httpMetadata?.contentType,
          cacheControl: object.httpMetadata?.cacheControl,
        },
        customMetadata: { ...(object.customMetadata || {}) },
      };
    },
    async getBytes(key) {
      const object = await binding.get(key);
      return object ? object.bytes() : null;
    },
    async createIfAbsent(input) {
      const result = await binding.put(input.key, input.body, {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: {
          contentType: input.contentType,
          cacheControl: input.cacheControl,
        },
        customMetadata: input.customMetadata,
        sha256: input.sha256,
      });
      return result !== null;
    },
  };
}

function emptyOutcome(
  status: PublicExperienceMediaOutcomeStatus,
  disposition: PublicExperienceMediaQueueDisposition,
  overrides: Partial<PublicExperienceMediaMirrorOutcome> = {}
): PublicExperienceMediaMirrorOutcome {
  return {
    status,
    disposition,
    sourceCount: 0,
    derivativeCount: 0,
    originalCreatedCount: 0,
    originalExactSkipCount: 0,
    derivativeCreatedCount: 0,
    derivativeExactSkipCount: 0,
    ...overrides,
  };
}

async function readSource(response: Response) {
  if (!response.ok || !response.body) {
    throw new MirrorEngineError(
      response.status >= 500 || response.status === 429 ? 'transient' : 'permanent',
      'source_fetch_failed'
    );
  }
  const contentType = normalizeContentType(response.headers.get('content-type'));
  if (!SUPPORTED_SOURCE_CONTENT_TYPES.has(contentType)) {
    throw new MirrorEngineError('permanent', 'unsupported_source_content_type');
  }
  const declaredSize = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredSize) &&
    (declaredSize <= 0 || declaredSize > PUBLIC_EXPERIENCE_MEDIA_MAX_SOURCE_BYTES)
  ) {
    throw new MirrorEngineError('permanent', 'invalid_source_size');
  }
  const bytes = await readBoundedStream(
    response.body,
    PUBLIC_EXPERIENCE_MEDIA_MAX_SOURCE_BYTES,
    'source_too_large'
  );
  if (bytes.byteLength === 0) {
    throw new MirrorEngineError('permanent', 'empty_source');
  }
  return { bytes, contentType, sha256: await sha256Bytes(bytes) };
}

function originalMetadata(
  source: SourceInventoryItem,
  sourceSha256: string,
  sourceSize: number,
  copiedAt: string
) {
  return {
    sha256: sourceSha256,
    source_key_sha256: source.sourceKeySha256,
    source_byte_sha256: sourceSha256,
    output_byte_sha256: sourceSha256,
    source_size: String(sourceSize),
    provenance_status: 'verified',
    transform_schema_version: PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_SCHEMA_VERSION,
    transform_engine: 'source-copy',
    copied_at: copiedAt,
  };
}

export function derivativeMetadata(input: {
  sourceKeySha256: string;
  sourceByteSha256: string;
  sourceSize: number;
  outputByteSha256: string;
  specification: PublicExperienceMediaDerivativeSpecification;
  generatedAt: string;
}) {
  return {
    sha256: input.outputByteSha256,
    output_byte_sha256: input.outputByteSha256,
    source_key_sha256: input.sourceKeySha256,
    source_byte_sha256: input.sourceByteSha256,
    source_size: String(input.sourceSize),
    transform_width: String(input.specification.width),
    transform_quality: String(input.specification.quality),
    transform_format: input.specification.format,
    transform_schema_version: PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_SCHEMA_VERSION,
    transform_engine: PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_ENGINE,
    derivative_role: input.specification.role,
    provenance_status: 'verified',
    generated_at: input.generatedAt,
  };
}

async function inspectStoredObject(
  store: PublicExperienceMediaMirrorStore,
  key: string
) {
  const head = await store.head(key);
  if (!head) return null;
  const bytes = await store.getBytes(key);
  if (!bytes || bytes.byteLength !== head.size) {
    throw new MirrorEngineError('permanent', 'stored_object_unreadable');
  }
  return { head, bytes, sha256: await sha256Bytes(bytes) };
}

function commonHttpMetadataValid(
  object: Awaited<ReturnType<typeof inspectStoredObject>>,
  contentType: string
) {
  return Boolean(
    object &&
      normalizeContentType(object.head.httpMetadata.contentType) === contentType &&
      object.head.httpMetadata.cacheControl === PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL
  );
}

function originalIsExact(
  object: NonNullable<Awaited<ReturnType<typeof inspectStoredObject>>>,
  source: SourceInventoryItem,
  sourceSha256: string,
  contentType: string,
  sourceSize: number
) {
  const metadata = object.head.customMetadata;
  return (
    commonHttpMetadataValid(object, contentType) &&
    object.head.size === sourceSize &&
    object.sha256 === sourceSha256 &&
    metadata.source_key_sha256 === source.sourceKeySha256 &&
    metadata.source_byte_sha256 === sourceSha256 &&
    metadata.output_byte_sha256 === sourceSha256 &&
    metadata.source_size === String(sourceSize) &&
    (!metadata.sha256 || metadata.sha256 === sourceSha256)
  );
}

function derivativeIsExact(
  object: NonNullable<Awaited<ReturnType<typeof inspectStoredObject>>>,
  specification: PublicExperienceMediaDerivativeSpecification,
  sourceByteSha256: string,
  sourceSize: number
) {
  const metadata = object.head.customMetadata;
  const commonProof =
    commonHttpMetadataValid(object, 'image/webp') &&
    object.head.size === object.bytes.byteLength &&
    metadata.sha256 === object.sha256 &&
    metadata.output_byte_sha256 === object.sha256 &&
    metadata.source_key_sha256 === specification.sourceKeySha256 &&
    metadata.source_byte_sha256 === sourceByteSha256 &&
    metadata.transform_width === String(specification.width) &&
    metadata.transform_quality === String(specification.quality) &&
    metadata.transform_format === specification.format;
  if (!commonProof) return false;

  if (metadata.provenance_status === 'legacy-observed') return true;
  return (
    metadata.provenance_status === provenanceContract.provenanceStatus &&
    metadata.source_size === String(sourceSize) &&
    metadata.transform_schema_version ===
      PUBLIC_EXPERIENCE_MEDIA_TRANSFORM_SCHEMA_VERSION &&
    ALLOWED_DERIVATIVE_TRANSFORM_ENGINES.has(metadata.transform_engine) &&
    metadata.derivative_role === specification.role
  );
}

async function ensureOriginal(
  dependencies: PublicExperienceMediaMirrorDependencies,
  source: SourceInventoryItem,
  material: Awaited<ReturnType<typeof readSource>>,
  copiedAt: string
) {
  const key = buildPublicExperienceOriginalKey(
    source.sourceKey,
    material.sha256,
    material.contentType
  );
  const current = await inspectStoredObject(dependencies.store, key);
  if (current) {
    if (originalIsExact(current, source, material.sha256, material.contentType, material.bytes.byteLength)) {
      return 'exact' as const;
    }
    throw new MirrorEngineError('permanent', 'original_conflict');
  }

  const created = await dependencies.store.createIfAbsent({
    key,
    body: material.bytes,
    contentType: material.contentType,
    cacheControl: PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL,
    customMetadata: originalMetadata(
      source,
      material.sha256,
      material.bytes.byteLength,
      copiedAt
    ),
    sha256: material.sha256,
  });
  const after = await inspectStoredObject(dependencies.store, key);
  if (
    !after ||
    !originalIsExact(after, source, material.sha256, material.contentType, material.bytes.byteLength)
  ) {
    throw new MirrorEngineError('permanent', 'original_create_verification_failed');
  }
  return created ? ('created' as const) : ('exact' as const);
}

async function ensureDerivative(
  dependencies: PublicExperienceMediaMirrorDependencies,
  specification: PublicExperienceMediaDerivativeSpecification,
  material: Awaited<ReturnType<typeof readSource>>,
  generatedAt: string
) {
  const current = await inspectStoredObject(dependencies.store, specification.key);
  if (current) {
    if (derivativeIsExact(current, specification, material.sha256, material.bytes.byteLength)) {
      return 'exact' as const;
    }
    throw new MirrorEngineError('permanent', 'derivative_conflict');
  }

  const output = await dependencies.transformer.transform({
    source: material.bytes,
    width: specification.width,
    quality: specification.quality,
    format: 'image/webp',
  });
  if (
    normalizeContentType(output.contentType) !== 'image/webp' ||
    output.bytes.byteLength === 0 ||
    output.bytes.byteLength > PUBLIC_EXPERIENCE_MEDIA_MAX_SOURCE_BYTES
  ) {
    throw new MirrorEngineError('transient', 'images_invalid_output');
  }
  const outputSha256 = await sha256Bytes(output.bytes);
  const created = await dependencies.store.createIfAbsent({
    key: specification.key,
    body: output.bytes,
    contentType: 'image/webp',
    cacheControl: PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL,
    customMetadata: derivativeMetadata({
      sourceKeySha256: specification.sourceKeySha256,
      sourceByteSha256: material.sha256,
      sourceSize: material.bytes.byteLength,
      outputByteSha256: outputSha256,
      specification,
      generatedAt,
    }),
    sha256: outputSha256,
  });
  const after = await inspectStoredObject(dependencies.store, specification.key);
  if (
    !after ||
    !derivativeIsExact(after, specification, material.sha256, material.bytes.byteLength)
  ) {
    throw new MirrorEngineError('permanent', 'derivative_create_verification_failed');
  }
  return created ? ('created' as const) : ('exact' as const);
}

export async function mirrorPublicExperienceMedia(
  untrustedMessage: unknown,
  dependencies: PublicExperienceMediaMirrorDependencies
): Promise<PublicExperienceMediaMirrorOutcome> {
  const message = parsePublicExperienceMediaQueueMessage(untrustedMessage);
  if (!message) {
    return emptyOutcome('invalid_message', 'dead_letter', {
      diagnosticCode: 'invalid_message_schema',
    });
  }

  let inventory: PublicExperienceMediaInventory | undefined;
  const counts = {
    originalCreatedCount: 0,
    originalExactSkipCount: 0,
    derivativeCreatedCount: 0,
    derivativeExactSkipCount: 0,
  };
  try {
    const initialRow = await dependencies.loadLatestExperience(message.experienceId);
    if (!initialRow || !isPublicExperienceR2Eligible(initialRow)) {
      return emptyOutcome('ineligible_noop', 'ack', {
        experienceId: message.experienceId,
      });
    }
    if (normalizeExperienceId(initialRow.id) !== message.experienceId) {
      throw new MirrorEngineError('permanent', 'experience_identity_mismatch');
    }
    inventory = buildPublicExperienceMediaInventory(initialRow);
    const copiedAt = (dependencies.now || (() => new Date()))().toISOString();
    const materialBySourceIdentity = new Map<
      string,
      Awaited<ReturnType<typeof readSource>>
    >();

    for (const source of inventory.sources) {
      let response: Response;
      try {
        response = await dependencies.fetchSource(source.sourceUrl);
      } catch {
        throw new MirrorEngineError('transient', 'source_fetch_failed');
      }
      const material = await readSource(response);
      materialBySourceIdentity.set(source.sourceKeySha256, material);
      const originalResult = await ensureOriginal(
        dependencies,
        source,
        material,
        copiedAt
      );
      if (originalResult === 'created') counts.originalCreatedCount += 1;
      else counts.originalExactSkipCount += 1;
    }

    for (const specification of inventory.derivatives) {
      const material = materialBySourceIdentity.get(specification.sourceKeySha256);
      if (!material) {
        throw new MirrorEngineError('permanent', 'missing_source_material');
      }
      const derivativeResult = await ensureDerivative(
        dependencies,
        specification,
        material,
        copiedAt
      );
      if (derivativeResult === 'created') counts.derivativeCreatedCount += 1;
      else counts.derivativeExactSkipCount += 1;
    }

    const finalRow = await dependencies.loadLatestExperience(message.experienceId);
    let finalSnapshotDigest: string | null = null;
    if (finalRow && isPublicExperienceR2Eligible(finalRow)) {
      try {
        finalSnapshotDigest = buildPublicExperienceMediaInventory(finalRow).snapshotDigest;
      } catch {
        finalSnapshotDigest = null;
      }
    }
    if (finalSnapshotDigest !== inventory.snapshotDigest) {
      return emptyOutcome('source_drift', 'retry', {
        experienceId: message.experienceId,
        sourceSnapshotDigest: inventory.snapshotDigest,
        sourceCount: inventory.sources.length,
        derivativeCount: inventory.derivatives.length,
        ...counts,
        diagnosticCode: 'source_snapshot_changed',
      });
    }

    const status =
      counts.originalCreatedCount + counts.derivativeCreatedCount > 0
        ? 'success'
        : 'already_exact';
    return emptyOutcome(status, 'ack', {
      experienceId: message.experienceId,
      sourceSnapshotDigest: inventory.snapshotDigest,
      sourceCount: inventory.sources.length,
      derivativeCount: inventory.derivatives.length,
      ...counts,
    });
  } catch (error) {
    const permanent = error instanceof MirrorEngineError && error.kind === 'permanent';
    return emptyOutcome(
      permanent ? 'permanent_conflict' : 'transient_failure',
      permanent ? 'dead_letter' : 'retry',
      {
        experienceId: message.experienceId,
        sourceSnapshotDigest: inventory?.snapshotDigest,
        sourceCount: inventory?.sources.length || 0,
        derivativeCount: inventory?.derivatives.length || 0,
        ...counts,
        diagnosticCode:
          error instanceof MirrorEngineError
            ? error.diagnosticCode
            : 'unclassified_transient_failure',
      }
    );
  }
}
