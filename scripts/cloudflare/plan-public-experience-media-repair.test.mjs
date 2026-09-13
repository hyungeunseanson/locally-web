import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOriginalKey,
  extensionForContentType,
  parseArgs,
  sanitizeSourcePlanSummary,
  sha256,
  stableJson,
} from './plan-public-experience-media-repair.mjs';

const sourceKey = 'experience/11111111-1111-4111-8111-111111111111/hero/photo.jpg';

test('builds immutable original keys from normalized identity and source bytes', () => {
  const keyHash = sha256(sourceKey);
  const byteHash = sha256(Buffer.from('source bytes'));
  assert.equal(
    buildOriginalKey(sourceKey, byteHash, 'image/jpeg; charset=binary'),
    `originals/v1/${keyHash.slice(0, 2)}/${keyHash}/${byteHash}.jpg`,
  );
  assert.equal(extensionForContentType('image/png'), 'png');
  assert.throws(() => extensionForContentType('application/octet-stream'), /Unsupported/);
});

test('defaults to plan and makes source verification explicit', () => {
  assert.deepEqual(parseArgs([]), {
    command: 'plan',
    output: new URL('../../.tmp/public-experience-media-repair', import.meta.url).pathname,
    sourcePlan: null,
  });
  assert.equal(parseArgs(['verify-source', '--source-plan=.tmp/private.json']).command, 'verify-source');
  assert.throws(() => parseArgs(['apply']), /plan or verify-source/);
});

test('stable JSON makes confirmation inputs deterministic', () => {
  assert.equal(stableJson({ z: 1, a: { y: 2, x: 3 } }), '{\n  "a": {\n    "x": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
});

test('public source-plan summary contains only hashed identities and aggregate counts', () => {
  const summary = sanitizeSourcePlanSummary({
    version: 1,
    target: { supabaseProjectRef: 'uhinvcydgzqlpnvieyal', bucket: 'experiences' },
    generatedAt: '2026-09-13T00:00:00.000Z',
    sourceSnapshotDigest: 'a'.repeat(64),
    sourceObjects: [{ sourceSize: 42 }],
    expectedDerivatives: [{ key: 'cards/safe.webp' }],
    sourceCounts: {
      publicActive: { experienceCount: 1, identitySetDigest: 'b'.repeat(64) },
    },
  });
  const serialized = JSON.stringify(summary);
  assert.equal(summary.publicActiveOriginalCount, 1);
  assert.equal(summary.publicActiveSourceBytes, 42);
  assert.doesNotMatch(serialized, /https?:\/\//);
  assert.doesNotMatch(serialized, /11111111-1111/);
  assert.doesNotMatch(serialized, /service.role|secret|credential/i);
});
