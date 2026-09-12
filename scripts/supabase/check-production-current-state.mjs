import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const manifestPath = resolve(root, 'supabase/staging/production-current-state.manifest.json');
const requiredPath = resolve(root, 'supabase/staging/required-objects.json');
const contractPath = resolve(root, 'supabase/staging/current-state-contract.sql');
const overlayPath = resolve(root, 'supabase/staging/post-baseline-current-state-overlay.sql');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const required = JSON.parse(await readFile(requiredPath, 'utf8'));
const contract = await readFile(contractPath, 'utf8');
const overlay = await readFile(overlayPath, 'utf8');

function fail(message) {
  throw new Error(`Production current-state contract failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function exact(label, actual, expected) {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
    fail(`${label} differs\nactual=${JSON.stringify(sorted(actual))}\nexpected=${JSON.stringify(sorted(expected))}`);
  }
}

async function sha256(path) {
  const contents = await readFile(resolve(root, path));
  return createHash('sha256').update(contents).digest('hex');
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const immutableCheckpoint = {
  'supabase/migrations/20260912034545_production_schema_baseline.sql':
    'dd9acf12964f5a9006baaa95323c179781a359286d8a2ea722782998ec10a1a4',
  'supabase/staging/production-baseline.manifest.json':
    '916d076d97d350437e6dc46691903c1bed2b692f386cb04002d03faad94759ed',
  'supabase/staging/baseline-contract.sql':
    'f44f3e3160394c221b1d3557242bd9bae2884d8f47c726f2d08f46808c43a210',
  'scripts/supabase/check-production-baseline.mjs':
    '250bd49867991ba56ee43d2e90d9e7d25e09c9c96e6ba6294545229b4335d2b0',
};

for (const [path, expectedHash] of Object.entries(immutableCheckpoint)) {
  assert(await sha256(path) === expectedHash, `immutable checkpoint bytes changed: ${path}`);
}

const expectedLedger = [
  {
    version: '20260912034545',
    name: 'remote_schema',
    repositoryFile: 'supabase/migrations/20260912034545_production_schema_baseline.sql',
  },
  {
    version: '20260912050655',
    name: 'service_concierge_assignment',
    repositoryFile: 'supabase/migrations/20260912050655_service_concierge_assignment.sql',
  },
];
exact('migration versions', manifest.migrationLedger.map(({ version }) => version), expectedLedger.map(({ version }) => version));
for (const [index, expected] of expectedLedger.entries()) {
  const actual = manifest.migrationLedger[index];
  assert(actual.version === expected.version && actual.name === expected.name,
    `migration ledger entry ${index} differs`);
  assert(actual.repositoryFile === expected.repositoryFile,
    `repository migration path differs for ${expected.version}`);
  assert(await sha256(actual.repositoryFile) === actual.repositorySha256,
    `repository migration hash differs for ${expected.version}`);
}

const migrationFiles = (await readdir(resolve(root, 'supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort();
exact('repository migration files', migrationFiles, expectedLedger.map(({ repositoryFile }) => repositoryFile.split('/').at(-1)));

const objects = manifest.objects;
assert(objects.publicTables.length === 39, 'expected 39 public tables');
assert(objects.publicViews.length === 2, 'expected 2 public views');
assert(objects.publicTableColumns === 510, 'expected 510 public table columns');
assert(objects.publicViewColumns === 27, 'expected 27 public view columns');
assert(objects.functionOverloads.length === 44, 'expected 44 public function overloads');
assert(objects.applicationTriggers.length === 11, 'expected 11 application triggers');
assert(objects.indexes === 113, 'expected 113 public indexes');
assert(objects.constraints.total === 179, 'expected 179 constraints');
assert(objects.constraints.primaryKey === 39, 'expected 39 primary keys');
assert(objects.constraints.foreignKey === 59, 'expected 59 foreign keys');
assert(objects.constraints.unique === 14, 'expected 14 unique constraints');
assert(objects.constraints.check === 67, 'expected 67 check constraints');
assert(objects.rls.enabled.length === 37, 'expected 37 RLS-enabled tables');
assert(objects.rls.disabled.length === 2, 'expected 2 RLS-disabled tables');
assert(objects.rls.forced.length === 0, 'expected zero FORCE RLS tables');
assert(objects.rls.publicPolicies === 111, 'expected 111 public policies');
assert(objects.realtimePublication.tables.length === 7, 'expected seven Realtime tables');
assert(objects.storageBuckets.length === 6, 'expected six Storage buckets');
assert(objects.storageObjectPolicies.length === 15, 'expected 15 Storage policies');

exact('required tables', required.applicationTables, objects.publicTables);
exact('required views', required.applicationViews, objects.publicViews);
exact(
  'required function names',
  required.applicationFunctions,
  new Set(objects.functionOverloads.map((identity) => identity.match(/^public\.([^()]+)\(/)?.[1]).filter(Boolean))
);
exact(
  'required triggers',
  required.applicationTriggers,
  objects.applicationTriggers.map((identity) => identity.split('.').at(-1))
);
exact('required Realtime tables', required.realtimePublicationTables, objects.realtimePublication.tables);
exact('active concierge tables', required.activeConcierge.tables, manifest.activeConcierge.tables);
exact(
  'active concierge function names',
  required.activeConcierge.functions,
  manifest.activeConcierge.functionOverloads.map((identity) => identity.match(/^public\.([^()]+)\(/)[1])
);

for (const staleName of [
  ...required.forbiddenCurrentObjects.tables,
  ...required.forbiddenCurrentObjects.functions,
  ...required.forbiddenCurrentObjects.triggers,
]) {
  assert(!required.applicationTables.includes(staleName), `stale table remains required: ${staleName}`);
  assert(!required.applicationFunctions.includes(staleName), `stale function remains required: ${staleName}`);
  assert(!required.applicationTriggers.includes(staleName), `stale trigger remains required: ${staleName}`);
}

const postMigration = await readFile(
  resolve(root, 'supabase/migrations/20260912050655_service_concierge_assignment.sql'),
  'utf8'
);
const createdTables = [...postMigration.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z0-9_]+)/gi)]
  .map((match) => match[1]);
exact('post-baseline concierge tables', createdTables, manifest.activeConcierge.tables);

const replacedFunctions = [...postMigration.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/gi)]
  .map((match) => match[1]);
exact(
  'post-baseline function definitions',
  replacedFunctions,
  [...required.activeConcierge.functions, 'create_service_request_with_booking_atomic']
);
for (const functionName of required.activeConcierge.functions) {
  assert(new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]+ FROM PUBLIC, anon, authenticated;`, 'i').test(postMigration),
    `missing direct execute revoke for ${functionName}`);
  assert(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([^;]+ TO service_role;`, 'i').test(postMigration),
    `missing service_role execute grant for ${functionName}`);
}

assert(contract.includes('BEGIN READ ONLY;'), 'current-state contract is not read-only');
assert(contract.trimEnd().endsWith('ROLLBACK;'), 'current-state contract must end with ROLLBACK');
assert(contract.includes('LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS'),
  'current-state contract pass marker is missing');
assert(!/^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|CREATE\s+|DROP\s+|TRUNCATE\s+)/gim.test(contract),
  'current-state contract contains a mutating statement');

const overlayWithoutComments = overlay.replace(/^\s*--.*$/gm, '');
assert(overlay.includes("target_ref = 'uhinvcydgzqlpnvieyal'"), 'overlay Production ref deny is missing');
assert(overlay.indexOf('$target_guard$') < overlay.indexOf('DROP POLICY'), 'overlay guard must precede the write');
assert((overlayWithoutComments.match(/DROP POLICY/g) ?? []).length === 1, 'overlay must drop exactly one policy');
assert(overlayWithoutComments.includes('DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;'),
  'overlay targets the wrong policy');
assert(!/^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|CREATE\s+|TRUNCATE\s+)/gim.test(overlayWithoutComments),
  'overlay contains an unrelated mutation');

const appFiles = await sourceFiles(resolve(root, 'app'));
const appSources = await Promise.all(appFiles.map(async (path) => ({ path, source: await readFile(path, 'utf8') })));
for (const functionName of required.activeConcierge.functions) {
  assert(appSources.some(({ source }) => source.includes(functionName)),
    `active concierge function has no application callsite: ${functionName}`);
}
for (const functionName of required.legacyCompatibility.functions) {
  assert(!appSources.some(({ source }) => source.includes(functionName)),
    `legacy compatibility function is called by application runtime: ${functionName}`);
}
for (const routePath of required.legacyCompatibility.disabledRoutes) {
  const source = await readFile(resolve(root, routePath), 'utf8');
  assert(source.includes('SERVICE_MARKETPLACE_DISABLED') && source.includes('status: 410'),
    `legacy marketplace route is not fail-closed: ${routePath}`);
}
assert(appSources.some(({ source }) => source.includes(".from('service_applications')")),
  'service_applications historical compatibility reads/cleanup disappeared');

console.log(JSON.stringify({
  migrationVersions: manifest.migrationLedger.map(({ version }) => version),
  publicTables: objects.publicTables.length,
  publicViews: objects.publicViews.length,
  publicTableColumns: objects.publicTableColumns,
  publicViewColumns: objects.publicViewColumns,
  functionOverloads: objects.functionOverloads.length,
  applicationTriggers: objects.applicationTriggers.length,
  indexes: objects.indexes,
  constraints: objects.constraints,
  rlsEnabled: objects.rls.enabled.length,
  rlsDisabled: objects.rls.disabled.length,
  forceRls: objects.rls.forced.length,
  publicPolicies: objects.rls.publicPolicies,
  realtimeTables: objects.realtimePublication.tables.length,
  storageBuckets: objects.storageBuckets.length,
  storagePolicies: objects.storageObjectPolicies.length,
  activeConciergeTables: manifest.activeConcierge.tables.length,
  activeConciergeFunctions: manifest.activeConcierge.functionOverloads.length,
  result: 'LOCALLY_PRODUCTION_CURRENT_STATE_STATIC_PASS',
}, null, 2));
