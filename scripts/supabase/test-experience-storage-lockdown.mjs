import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = 'supabase/migrations/20260916031212_experience_storage_lockdown.sql';
const sql = await readFile(migrationPath, 'utf8');
const withoutComments = sql.replace(/^\s*--.*$/gm, '');

assert.match(sql, /^BEGIN;/m);
assert.match(sql, /^COMMIT;/m);
assert(sql.indexOf('$preflight$') < sql.indexOf('UPDATE storage.buckets'), 'preflight must precede access changes');
assert(sql.includes("bucket_fingerprint IS DISTINCT FROM '384007869cd8ffb76874b05397c554da'"));
assert(sql.includes("policy_fingerprint IS DISTINCT FROM '27b4679aafb896ae579c14510bd9a9d7'"));
assert(sql.includes("policy_fingerprint IS DISTINCT FROM '1519cc7c3877bf1389c0e02c63bc223a'"));
assert.match(sql, /UPDATE storage\.buckets\s+SET public = false\s+WHERE id = 'experiences';/s);

assert.deepEqual(
  [...withoutComments.matchAll(/^DROP POLICY "([^"]+)" ON storage\.objects;$/gm)].map((match) => match[1]),
  [
    'Auth Users Upload',
    'Experience object owners can delete',
    'Experience object owners can update',
    'Public Access',
  ]
);
assert(!withoutComments.includes('DROP POLICY IF EXISTS'), 'lockdown must fail closed on policy drift');
assert(!/^\s*DELETE\s+FROM\s+storage\.objects/gim.test(withoutComments), 'lockdown must not delete Storage objects');
assert(!/^\s*(?:INSERT|UPDATE|DELETE)\s+public\.experiences/gim.test(withoutComments), 'lockdown must not mutate experience rows');
assert(sql.includes('experience_storage_lockdown_baseline'), 'object count/bytes baseline is required');
assert(sql.includes('target_object_count IS DISTINCT FROM baseline_object_count'));
assert(sql.includes('target_object_bytes IS DISTINCT FROM baseline_object_bytes'));
assert(sql.includes("legacy_locator_rows <> 0"), 'live legacy locator gate is required');

console.log(JSON.stringify({
  migrationPath,
  removedPolicies: 4,
  objectMutation: false,
  result: 'EXPERIENCE_STORAGE_LOCKDOWN_CONTRACT_PASS',
}, null, 2));
