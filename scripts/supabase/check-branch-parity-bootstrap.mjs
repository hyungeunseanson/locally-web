import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const bootstrapPath = resolve(root, 'supabase/staging/branch-parity-bootstrap.sql');
const bootstrap = await readFile(bootstrapPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(bootstrap.includes("target_ref <> 'ekfwkplibbqvbgqjumml'"), 'Exact canary branch ref guard is missing.');
assert(bootstrap.includes("target_ref = 'uhinvcydgzqlpnvieyal'"), 'Production ref deny is missing.');
assert(bootstrap.indexOf('$target_guard$') < bootstrap.indexOf('CREATE TRIGGER'), 'Target guard must run before writes.');
assert(bootstrap.includes('8ad838c47b834a9cfeaf0af4500f4774'), 'Production handle_new_user hash is missing.');
assert(bootstrap.includes('c3ff5767c8e4934ae05b3d96550441c8'), 'Production bucket hash is missing.');
assert(bootstrap.includes('d6b381fd629405acfdd615593031de5c'), 'Production storage-policy hash is missing.');
assert(bootstrap.includes('187e09746bfa0365859b736dad40fd9f'), 'Known branch grant hash is missing.');
assert(bootstrap.includes('42e662640922b11d00ed04eebdb4fc13'), 'Production grant hash is missing.');
assert((bootstrap.match(/CREATE POLICY /g) || []).length === 16, 'Expected exactly 16 storage policies.');
assert((bootstrap.match(/REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE/g) || []).length === 7, 'Expected seven exact grant repairs.');
assert(bootstrap.includes("('admin_files', 'admin_files', true, 10485760, null)"), 'admin_files bucket metadata differs.');
assert(bootstrap.includes("('verification-docs', 'verification-docs', false, null, null)"), 'verification-docs must remain private.');
assert(!/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b[\s\S]*uhinvcydgzqlpnvieyal/i.test(bootstrap), 'Production ref must not be a write target.');

const migrationFiles = await readdir(resolve(root, 'supabase/migrations'));
for (const file of migrationFiles) {
  const source = await readFile(resolve(root, 'supabase/migrations', file), 'utf8');
  assert(!source.includes('ekfwkplibbqvbgqjumml'), `Branch-specific SQL leaked into migration ${file}.`);
}

console.log('LOCALLY_STAGING_BRANCH_PARITY_BOOTSTRAP_CONTRACT_PASS');
