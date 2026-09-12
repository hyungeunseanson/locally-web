import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const required = JSON.parse(
  await readFile(resolve(root, 'supabase/staging/required-objects.json'), 'utf8')
);
const current = JSON.parse(
  await readFile(resolve(root, 'supabase/staging/production-current-state.manifest.json'), 'utf8')
);
const schemaContract = await readFile(
  resolve(root, 'supabase/staging/schema-contract.sql'),
  'utf8'
);
const currentContract = await readFile(
  resolve(root, 'supabase/staging/current-state-contract.sql'),
  'utf8'
);
const overlay = await readFile(
  resolve(root, 'supabase/staging/post-baseline-current-state-overlay.sql'),
  'utf8'
);

function fail(message) {
  throw new Error(`Staging bootstrap contract failed: ${message}`);
}

function exact(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} differs\nactual=${JSON.stringify(actual)}\nexpected=${JSON.stringify(expected)}`);
  }
}

const expectedApplyOrder = [
  'supabase/migrations/20260912034545_production_schema_baseline.sql',
  'supabase/migrations/20260912050655_service_concierge_assignment.sql',
  'supabase/staging/post-baseline-current-state-overlay.sql',
];
exact('fresh-project apply order', required.freshProjectApplyOrder, expectedApplyOrder);

const migrationFiles = (await readdir(resolve(root, 'supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => `supabase/migrations/${name}`);
exact('ordered repository migrations', migrationFiles, expectedApplyOrder.slice(0, 2));
exact(
  'manifest repository migrations',
  current.migrationLedger.map((entry) => entry.repositoryFile),
  expectedApplyOrder.slice(0, 2)
);

for (const table of required.functionalCanaryMinimum.tables) {
  if (!schemaContract.includes(`'${table}'`)) {
    fail(`schema-contract.sql does not cover table ${table}`);
  }
}
for (const name of required.functionalCanaryMinimum.functions) {
  if (!schemaContract.includes(`'${name}'`)) {
    fail(`schema-contract.sql does not cover function ${name}`);
  }
}

if (!currentContract.includes('BEGIN READ ONLY;') || !currentContract.trimEnd().endsWith('ROLLBACK;')) {
  fail('current-state-contract.sql must be a read-only transaction');
}
if (!currentContract.includes('LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS')) {
  fail('current-state-contract.sql pass marker is missing');
}

const guardIndex = overlay.indexOf('$target_guard$');
const writeIndex = overlay.indexOf('DROP POLICY "Authenticated users can upload chat images"');
if (guardIndex < 0 || writeIndex < 0 || guardIndex >= writeIndex) {
  fail('staging overlay target guard must run before its single policy change');
}
if (!overlay.includes("target_ref = 'uhinvcydgzqlpnvieyal'")) {
  fail('staging overlay does not explicitly deny the Production ref');
}
if (!overlay.includes('Authenticated users can upload chat images')) {
  fail('staging overlay does not target the reviewed chat-image INSERT policy');
}
if (overlay.includes('DROP POLICY IF EXISTS')) {
  fail('staging overlay must fail closed when its one-time policy is absent');
}
for (const requiredFragment of [
  'c3ff5767c8e4934ae05b3d96550441c8',
  'd6b381fd629405acfdd615593031de5c',
  '38c973a52a0bebe8fa78b3f53089e427',
  'policy_count <> 16',
  'policy_count <> 15',
  'IF NOT EXISTS (',
]) {
  if (!overlay.includes(requiredFragment)) {
    fail(`staging overlay omits fail-closed condition: ${requiredFragment}`);
  }
}

for (const [name, fingerprint] of Object.entries({
  storageBuckets: 'c3ff5767c8e4934ae05b3d96550441c8',
  storagePolicies: '38c973a52a0bebe8fa78b3f53089e427',
  publicRlsPolicies: '8e2720ce969cfa4252ec20069000fc4c',
  publicRelationGrants: '21aa717aae9fd797e1e51053688ddac3',
})) {
  if (current.securityFingerprints[name] !== fingerprint || !currentContract.includes(fingerprint)) {
    fail(`current-state security fingerprint differs: ${name}`);
  }
}

for (const staleName of [
  ...required.forbiddenCurrentObjects.tables,
  ...required.forbiddenCurrentObjects.functions,
  ...required.forbiddenCurrentObjects.triggers,
]) {
  if (required.applicationTables.includes(staleName)
      || required.applicationFunctions.includes(staleName)
      || required.applicationTriggers.includes(staleName)) {
    fail(`stale current-state object remains required: ${staleName}`);
  }
}

console.log(JSON.stringify({
  reproducibleFromHistoricalPatchesOnly: false,
  reproducibleFromImmutableBaselineOnly: false,
  freshProjectApplyOrder: expectedApplyOrder,
  clonedProductionBranchAction: 'run current-state-contract.sql only',
  functionalCanaryTableCount: required.functionalCanaryMinimum.tables.length,
  activeConciergeTableCount: required.activeConcierge.tables.length,
  activeConciergeFunctionCount: required.activeConcierge.functions.length,
  result: 'LOCALLY_STAGING_BOOTSTRAP_CONTRACT_PASS',
}, null, 2));
