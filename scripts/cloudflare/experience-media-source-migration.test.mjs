import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExperienceDeletePlan,
  buildExperienceLocatorMigrationPlan,
  buildMigratedR2Locator,
  digestPayload,
  parseLegacyExperienceSourceUrl,
  validateExperienceDeletePlan,
  validateExperienceLocatorMigrationPlan,
} from './experience-media-source-migration.mjs';

const sourceUrl = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/a.jpg';
const source = parseLegacyExperienceSourceUrl(sourceUrl);
const sourceByteSha256 = 'a'.repeat(64);
const r2Key = `originals/v1/${source.sourceKeySha256.slice(0, 2)}/${source.sourceKeySha256}/${sourceByteSha256}.jpg`;
const proof = { sourceUrl, r2Key, sourceByteSha256, r2ByteSha256: sourceByteSha256, sourceSize: 4, r2Size: 4 };

test('binds exact legacy source identity and bytes into a canonical R2 locator', () => {
  const locator = buildMigratedR2Locator(proof);
  assert.match(locator, /\/originals\/v1\/.+\?legacy=[0-9a-f]{12}$/);
  assert.throws(() => buildMigratedR2Locator({ ...proof, sourceByteSha256: 'b'.repeat(64) }));
});

test('migrates only locator strings while preserving photo order and itinerary content', () => {
  const row = {
    id: 42,
    photos: ['unchanged', sourceUrl],
    image_url: sourceUrl,
    itinerary: [{ title: 'Keep me', image_url: sourceUrl, nested: { value: 1 } }],
    itinerary_i18n: { en: [{ title: 'Also keep', image_url: sourceUrl, captions: [sourceUrl] }] },
  };
  const plan = buildExperienceLocatorMigrationPlan({ rows: [row], proofs: [proof], createdAt: 'excluded' });
  validateExperienceLocatorMigrationPlan(plan);
  assert.deepEqual(plan.changes[0].after.photos.map((value) => value === 'unchanged'), [true, false]);
  assert.equal(plan.changes[0].after.itinerary[0].title, 'Keep me');
  assert.equal(plan.changes[0].after.itinerary_i18n.en[0].title, 'Also keep');
  assert.equal(plan.changes[0].after.itinerary_i18n.en[0].captions[0], sourceUrl);
  assert.equal(plan.planDigest, buildExperienceLocatorMigrationPlan({ rows: [row], proofs: [proof], createdAt: 'different' }).planDigest);
  const tampered = structuredClone(plan);
  tampered.changes[0].after.photos.reverse();
  assert.throws(() => validateExperienceLocatorMigrationPlan(tampered), /digest/);
});

test('delete approval binds bucket, path, bytes, proof, refcount, classification, and hard ceilings', () => {
  const object = { name: 'experience/owner/hero/a.jpg', size: 4, sourceByteSha256, currentDbRefCount: 0, r2Exact: true, backupExact: true, classification: 'referenced-migrated', deleteReason: 'locator migrated and proofs exact' };
  const plan = buildExperienceDeletePlan({ objects: [object], createdAt: 'excluded' });
  validateExperienceDeletePlan(plan, [object]);
  const tampered = structuredClone(plan);
  tampered.objects[0].size = 5;
  assert.throws(() => validateExperienceDeletePlan(tampered, [object]), /digest/);
  assert.throws(() => buildExperienceDeletePlan({ objects: [{ ...object, currentDbRefCount: 1 }], createdAt: 'excluded' }));
  assert.throws(() => buildExperienceDeletePlan({ objects: [{ ...object, classification: 'unknown' }], createdAt: 'excluded' }));
  assert.equal(plan.planDigest, digestPayload({ schema: plan.schema, bucket: plan.bucket, objects: plan.objects }));
});
