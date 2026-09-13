import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildOriginalKey,
  extensionForContentType,
  parseArgs,
  sanitizeSourcePlanSummary,
  sha256,
  stableJson,
} from './plan-public-experience-media-repair.mjs';

const packageJournalScript = new URL(
  './package-r2-repair-journal.sh',
  import.meta.url,
).pathname;
const testArtifactKey = 'test-only-r2-repair-artifact-key-32-bytes-minimum';

function packageJournal({ action, applyOutcome, journal = true, receipt = true }) {
  const root = mkdtempSync(join(tmpdir(), 'r2-repair-journal-'));
  const repairDir = join(root, 'repair');
  const encryptedOutput = join(root, 'repair-journal.tar.gz.enc');
  const decryptedArchive = join(root, 'repair-journal.tar.gz');
  mkdirSync(repairDir);
  if (journal) {
    writeFileSync(join(repairDir, 'rollback-journal.json'), '{"version":1}\n');
  }
  if (receipt) {
    writeFileSync(join(repairDir, `${action}-receipt.json`), '{"verified":true}\n');
  }
  const env = { ...process.env, R2_REPAIR_ARTIFACT_KEY: testArtifactKey };
  const result = spawnSync(
    'bash',
    [packageJournalScript, repairDir, action, applyOutcome, encryptedOutput],
    { encoding: 'utf8', env },
  );
  const artifactExists = existsSync(encryptedOutput);
  let entries = [];
  if (artifactExists) {
    execFileSync(
      'openssl',
      [
        'enc',
        '-d',
        '-aes-256-cbc',
        '-pbkdf2',
        '-in',
        encryptedOutput,
        '-out',
        decryptedArchive,
        '-pass',
        'env:R2_REPAIR_ARTIFACT_KEY',
      ],
      { env, stdio: 'ignore' },
    );
    entries = execFileSync('tar', ['-tzf', decryptedArchive], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((entry) => entry.replace(/^\.\//, ''))
      .sort();
  }
  rmSync(root, { force: true, recursive: true });
  return {
    artifactExists,
    entries,
    status: result.status,
    stderr: result.stderr,
  };
}

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

test('packages canary and full receipts under their original filenames', () => {
  const canary = packageJournal({ action: 'canary', applyOutcome: 'success' });
  assert.equal(canary.status, 0);
  assert.deepEqual(canary.entries, [
    'canary-receipt.json',
    'rollback-journal.json',
  ]);

  const full = packageJournal({ action: 'full', applyOutcome: 'success' });
  assert.equal(full.status, 0);
  assert.deepEqual(full.entries, ['full-receipt.json', 'rollback-journal.json']);
});

test('preserves a partial-apply journal without requiring a receipt', () => {
  const partial = packageJournal({
    action: 'canary',
    applyOutcome: 'failure',
    receipt: false,
  });
  assert.equal(partial.status, 0);
  assert.deepEqual(partial.entries, ['rollback-journal.json']);
});

test('fails a successful apply missing its receipt after preserving the journal', () => {
  const missingReceipt = packageJournal({
    action: 'canary',
    applyOutcome: 'success',
    receipt: false,
  });
  assert.notEqual(missingReceipt.status, 0);
  assert.equal(missingReceipt.artifactExists, true);
  assert.deepEqual(missingReceipt.entries, ['rollback-journal.json']);
  assert.match(missingReceipt.stderr, /missing its receipt/);
});

test('allows a pre-write failure with no journal to produce no artifact', () => {
  const preWriteFailure = packageJournal({
    action: 'canary',
    applyOutcome: 'failure',
    journal: false,
    receipt: false,
  });
  assert.equal(preWriteFailure.status, 0);
  assert.equal(preWriteFailure.artifactExists, false);
  assert.deepEqual(preWriteFailure.entries, []);
});
