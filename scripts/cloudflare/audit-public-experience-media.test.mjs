import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRANSFORM_PROVENANCE_SCHEMA,
  buildManifestAudit,
  buildSourceScopes,
  buildStorageListRequest,
  classifyReadiness,
  normalizeSupabaseExperienceObjectKey,
  parseArgs,
  renderSummary,
  sanitizeReport,
} from './audit-public-experience-media.mjs';

const baseUrl = 'https://uhinvcydgzqlpnvieyal.supabase.co';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const url = (user, kind, name) => `${baseUrl}/storage/v1/object/public/experiences/experience/${user}/${kind}/${encodeURIComponent(name)}`;

test('normalizes only exact Production experiences object URLs without logging identities', () => {
  assert.equal(
    normalizeSupabaseExperienceObjectKey(url(userA, 'hero', '한 장.jpg')),
    `experience/${userA}/hero/한 장.jpg`,
  );
  assert.equal(normalizeSupabaseExperienceObjectKey('https://example.com/image.jpg'), null);
  assert.equal(normalizeSupabaseExperienceObjectKey(`${baseUrl}/storage/v1/object/public/avatars/${userA}/a.jpg`), null);
  assert.equal(normalizeSupabaseExperienceObjectKey(`${baseUrl}/storage/v1/object/public/experiences/../secret`), null);
});

test('separates public-active, all-db-referenced, and storage-all scopes', () => {
  const activeHero = url(userA, 'hero', 'a.jpg');
  const activeItinerary = url(userA, 'itinerary', 'b.jpg');
  const inactiveHero = url(userB, 'hero', 'c.jpg');
  const legacy = url(userB, 'hero', 'legacy.jpg');
  const rows = [
    {
      id: 1,
      status: 'active',
      is_active: true,
      photos: [activeHero, activeHero],
      itinerary: [{ image_url: activeItinerary }],
      image_url: activeHero,
    },
    {
      id: 2,
      status: 'draft',
      is_active: false,
      photos: [inactiveHero],
      itinerary: [],
      image_url: legacy,
    },
  ];
  const storage = [activeHero, activeItinerary, inactiveHero, legacy, url(userB, 'itinerary', 'orphan.jpg')].map((item, index) => ({
    key: normalizeSupabaseExperienceObjectKey(item),
    size: 100 + index,
    contentType: 'image/jpeg',
    etag: `etag-${index}`,
    cacheControl: 'max-age=3600',
  }));
  const result = buildSourceScopes(rows, storage);

  assert.equal(result.sourceScopes.publicActive.experienceCount, 1);
  assert.equal(result.sourceScopes.publicActive.distinctObjectCount, 2);
  assert.deepEqual(result.sourceScopes.publicActive.references, { photos: 2, itinerary: 1, legacyImageUrl: 1 });
  assert.equal(result.sourceScopes.allDbReferenced.experienceCount, 2);
  assert.equal(result.sourceScopes.allDbReferenced.distinctObjectCount, 4);
  assert.equal(result.sourceScopes.storageAll.objectCount, 5);
  assert.equal(result.sourceScopes.storageAll.unreferencedObjectCount, 1);
  assert.equal(result.sourceScopes.allDbReferenced.missingObjectCount, 0);
  assert.match(result.sourceScopes.publicActive.identitySetDigest, /^[0-9a-f]{64}$/);
  assert.match(result.sourceScopes.allDbReferenced.identitySetDigest, /^[0-9a-f]{64}$/);
  assert.match(result.sourceScopes.storageAll.identitySetDigest, /^[0-9a-f]{64}$/);
  assert.deepEqual(result.reconciliationInventory, [{ id: '1', heroUrls: [activeHero], detailUrls: [activeHero, activeItinerary] }]);
});

test('reports missing source references without exposing their value', () => {
  const missing = url(userA, 'hero', 'missing.jpg');
  const result = buildSourceScopes([{ id: 1, status: 'active', is_active: true, photos: [missing], itinerary: [], image_url: null }], []);
  assert.equal(result.sourceScopes.publicActive.missingObjectCount, 1);
  assert.doesNotMatch(JSON.stringify(result.sourceScopes), /missing\.jpg|11111111-1111/);
});

test('builds current/expected manifest drift and future provenance contracts', () => {
  const origin = url(userA, 'hero', 'a.jpg');
  const inventory = [{ id: '10', heroUrls: [origin], detailUrls: [origin] }];
  const currentCards = {
    99: { originUrl: origin, smallKey: 'cards/stale-small.webp', largeKey: 'cards/stale-large.webp' },
  };
  const result = buildManifestAudit(inventory, currentCards, {});
  assert.equal(result.summary.expectedCardExperienceCount, 1);
  assert.equal(result.summary.missingManifestDerivativeKeyCount, 5);
  assert.equal(result.summary.staleManifestDerivativeKeyCount, 2);
  assert.deepEqual(Object.values(TRANSFORM_PROVENANCE_SCHEMA), [
    'source_key_sha256',
    'source_byte_sha256',
    'output_byte_sha256',
    'transform_width',
    'transform_quality',
    'transform_format',
    'sharp_version',
    'libvips_version',
    'runtime_id',
    'generated_at',
  ]);
});

test('marks Supabase Storage listing as a bounded read operation', () => {
  const request = buildStorageListRequest(baseUrl, 'public-anon-value', 'experience', 100);
  assert.equal(request.operation, 'storage-list-read');
  assert.equal(request.mutation, false);
  assert.equal(request.init.method, 'POST');
  assert.match(request.url, /\/storage\/v1\/object\/list\/experiences$/);
  assert.doesNotMatch(request.url, /upload|move|copy|delete/i);
  assert.deepEqual(JSON.parse(request.init.body), {
    prefix: 'experience',
    limit: 100,
    offset: 100,
    sortBy: { column: 'name', order: 'asc' },
  });
});

test('full downloads require an explicit full command', () => {
  assert.equal(parseArgs([]).mode, 'metadata');
  assert.equal(parseArgs(['metadata']).mode, 'metadata');
  assert.equal(parseArgs(['full']).mode, 'full');
  assert.throws(() => parseArgs(['scheduled-full']), /metadata or full/);
});

test('readiness permits Wave 1.2 repair but blocks source or downloaded SHA failures', () => {
  const source = { publicActive: { missingObjectCount: 0, invalidReferenceCount: 0 } };
  const repair = {
    expected: { total: 5 },
    expectedMissing: { total: 1 },
    metadata: { cacheControlMismatchCount: 0, contentTypeMismatchCount: 0, customShaCoverage: 2 },
    downloadedShaVerification: { mismatchCount: 0 },
  };
  assert.equal(classifyReadiness(source, repair), 'GO_WAVE_1_2_REPAIR_REQUIRED');
  assert.equal(classifyReadiness({ publicActive: { missingObjectCount: 1, invalidReferenceCount: 0 } }, repair), 'NO_GO_SOURCE_PARITY');
  assert.equal(classifyReadiness(source, { ...repair, downloadedShaVerification: { mismatchCount: 1 } }), 'NO_GO_R2_SHA_MISMATCH');
});

test('machine and human reports reject URLs, UUID paths, and credential material', () => {
  assert.throws(() => sanitizeReport({ value: 'https://example.com' }), /forbidden/);
  assert.throws(() => sanitizeReport({ value: userA }), /forbidden/);
  assert.throws(() => sanitizeReport({ credential: 'value' }), /forbidden/);
  const report = sanitizeReport({ count: 1, digest: 'a'.repeat(64) });
  assert.deepEqual(report, { count: 1, digest: 'a'.repeat(64) });

  const summary = renderSummary({
    mode: 'metadata', generatedAt: '2026-09-13T00:00:00.000Z', readiness: 'GO_WAVE_1_2_REPAIR_REQUIRED',
    sourceScopes: { publicActive: { experienceCount: 1, distinctObjectCount: 2 }, allDbReferenced: { distinctObjectCount: 3, missingObjectCount: 0 }, storageAll: { objectCount: 4 } },
    r2: {
      expected: { total: 5 }, expectedMissing: { total: 0 }, taxonomy: { staleKnownDerivative: 1, unclassifiedExtra: 2, original: 0 },
      metadata: { cacheControlMismatchCount: 1, contentTypeMismatchCount: 0, customShaCoverage: 2 }, actual: { objectCount: 6 },
      downloadedShaVerification: { verifiedCount: 0, unverifiableMetadataCount: 0, mismatchCount: 0 },
    },
    safety: { r2MutationRequests: 0, supabaseMutationRequests: 0 },
    originalsCoverage: { actualObjectCount: 0, allDbReferencedObjectCount: 3 },
  });
  assert.doesNotMatch(summary, /https?:\/\/|11111111-1111|secret|credential/i);
});
