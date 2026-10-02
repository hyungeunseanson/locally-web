import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const manifestPath = resolve(root, 'supabase/staging/production-current-state.manifest.json');
const requiredPath = resolve(root, 'supabase/staging/required-objects.json');
const contractPath = resolve(root, 'supabase/staging/current-state-contract.sql');
const overlayPath = resolve(root, 'supabase/staging/post-baseline-current-state-overlay.sql');

const expectedFingerprints = {
  storageBuckets: '7419cabe695cd50a522314a749216c05',
  storagePolicies: '898e8b7f917fd0f4530ef30c9b61961e',
  publicRlsPolicies: 'e5a16a4215c569060fbf895453a5cd00',
  publicRelationGrants: 'a9c644ba2ab5c795f29aff57092aa002',
  stagingOverlayBaselineStoragePolicies: 'd6b381fd629405acfdd615593031de5c',
  stagingOverlayTargetStorageBuckets: 'c3ff5767c8e4934ae05b3d96550441c8',
  stagingOverlayTargetStoragePolicies: '38c973a52a0bebe8fa78b3f53089e427',
};

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
  {
    version: '20260915141606',
    name: 'p0_storage_rpc_security_hardening',
    repositoryFile: 'supabase/migrations/20260915141606_p0_storage_rpc_security_hardening.sql',
  },
  {
    version: '20260916024355',
    name: 'experience_media_locator_cas',
    repositoryFile: 'supabase/migrations/20260916024355_experience_media_locator_cas.sql',
  },
  {
    version: '20260916032730',
    name: 'experience_storage_lockdown',
    repositoryFile: 'supabase/migrations/20260916032730_experience_storage_lockdown.sql',
  },
  {
    version: '20260916111416',
    name: 'review_tour_end_db_foundation',
    repositoryFile: 'supabase/migrations/20260916111416_review_tour_end_db_foundation.sql',
  },
  {
    version: '20260916134243',
    name: 'review_direct_write_lockdown',
    repositoryFile: 'supabase/migrations/20260916134243_review_direct_write_lockdown.sql',
  },
  {
    version: '20260918000000',
    name: 'proxy_card_intake_atomic',
    repositoryFile: 'supabase/migrations/20260918000000_proxy_card_intake_atomic.sql',
  },
  {
    version: '20260922081710',
    name: 'experience_payment_claim_and_pending_cleanup',
    repositoryFile: 'supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql',
  },
  {
    version: '20260922125140',
    name: 'close_refunded_phone_proxy_requests',
    repositoryFile: 'supabase/migrations/20260922125140_close_refunded_phone_proxy_requests.sql',
  },
  {
    version: '20260923013312',
    name: 'ops_anomaly_monitor_snapshot',
    repositoryFile: 'supabase/migrations/20260923013312_ops_anomaly_monitor_snapshot.sql',
  },
  {
    version: '20260923084232',
    name: 'one_time_review_request_reminders',
    repositoryFile: 'supabase/migrations/20260923084232_one_time_review_request_reminders.sql',
  },
  {
    version: '20260929144521',
    name: 'harden_public_host_applications_security_barrier',
    repositoryFile: 'supabase/migrations/20260929144521_harden_public_host_applications_security_barrier.sql',
  },
  {
    version: '20260930022348',
    name: 'move_is_admin_reader_to_private_schema',
    repositoryFile: 'supabase/migrations/20260930022348_move_is_admin_reader_to_private_schema.sql',
  },
  {
    version: '20261002024534',
    repositoryVersion: '20261001170718',
    name: 'admin_message_monitoring_phase_1',
    repositoryFile: 'supabase/migrations/20261001170718_admin_message_monitoring_phase_1.sql',
    repositorySha256: 'aee6d14e1a897579e5dc6454221cb52d4bab822952096425e0b110eeb907ae95',
  },
  {
    version: '20261002024638',
    repositoryVersion: '20261002015110',
    name: 'admin_message_monitoring_historical_reinquiry',
    repositoryFile: 'supabase/migrations/20261002015110_admin_message_monitoring_historical_reinquiry.sql',
    repositorySha256: '80f34eea7ad6e2405aa38962a886c97e8713bfa1fefe72f0d9647686489747a1',
  },
];
const expectedPendingMigrations = [{
  version: '20261002041848',
  name: 'admin_attention_badges_phase_2',
  repositoryFile: 'supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql',
  repositorySha256: '2957a758c9b4fdbd1caf9b73ba8cccc8cf74733730a3bbe7e26033150aa821fe',
  status: 'prepared-not-applied',
}];
exact('migration versions', manifest.migrationLedger.map(({ version }) => version), expectedLedger.map(({ version }) => version));
for (const [index, expected] of expectedLedger.entries()) {
  const actual = manifest.migrationLedger[index];
  assert(actual.version === expected.version && actual.name === expected.name,
    `migration ledger entry ${index} differs`);
  assert(actual.repositoryFile === expected.repositoryFile,
    `repository migration path differs for ${expected.version}`);
  assert(await sha256(actual.repositoryFile) === actual.repositorySha256,
    `repository migration hash differs for ${expected.version}`);
  if (expected.repositoryVersion) {
    assert(actual.repositoryVersion === expected.repositoryVersion,
      `repository filename version differs for ${expected.version}`);
    assert(actual.repositoryFile.split('/').at(-1).startsWith(`${actual.repositoryVersion}_`),
      `repository filename mapping differs for ${expected.version}`);
    assert(actual.repositorySha256 === expected.repositorySha256
      && actual.ledgerStatementsSha256 === expected.repositorySha256,
    `applied ledger SQL bytes differ for ${expected.version}`);
    const sql = await readFile(resolve(root, actual.repositoryFile));
    const digest = createHash('md5').update(sql).digest('hex');
    assert(contract.includes(`${actual.version}:${actual.name}:1:${digest}`),
      `read-only ledger SQL assertion differs for ${expected.version}`);
  }
}

const migrationFiles = (await readdir(resolve(root, 'supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort();
exact(
  'repository migration files',
  migrationFiles,
  [...expectedLedger, ...expectedPendingMigrations]
    .map(({ repositoryFile }) => repositoryFile.split('/').at(-1))
);
assert(
  JSON.stringify(required.pendingProductionMigrations) === JSON.stringify(expectedPendingMigrations),
  'pending Production migration contract differs'
);

// Prepared Phase 2 is not in the Production ledger or catalog assertions.
for (const pending of expectedPendingMigrations) {
  assert(await sha256(pending.repositoryFile) === pending.repositorySha256, 'prepared attention migration bytes differ');
}

const objects = manifest.objects;
for (const [name, fingerprint] of Object.entries(expectedFingerprints)) {
  if (!name.startsWith('stagingOverlayTarget')) {
    assert(manifest.securityFingerprints[name] === fingerprint,
      `security fingerprint differs: ${name}`);
  }
}
assert(objects.publicTables.length === 39, 'expected 39 public tables');
assert(objects.publicViews.length === 2, 'expected 2 public views');
assert(objects.publicTableColumns === 517, 'expected 517 public table columns');
assert(objects.publicViewColumns === 27, 'expected 27 public view columns');
assert(objects.functionOverloads.length === 58, 'expected 58 public function overloads');
exact('private function overloads', objects.privateFunctionOverloads, [
  'private.advance_support_version()',
  'private.is_admin_reader()',
  'private.is_inquiry_admin_sender(p_sender uuid)',
  'private.prepare_support_message()'
]);
assert(objects.applicationTriggers.length === 14, 'expected 14 application triggers');
assert(objects.indexes === 119, 'expected 119 public indexes');
assert(objects.constraints.total === 180, 'expected 180 constraints');
assert(objects.constraints.primaryKey === 39, 'expected 39 primary keys');
assert(objects.constraints.foreignKey === 59, 'expected 59 foreign keys');
assert(objects.constraints.unique === 14, 'expected 14 unique constraints');
assert(objects.constraints.check === 68, 'expected 68 check constraints');
assert(objects.rls.enabled.length === 37, 'expected 37 RLS-enabled tables');
assert(objects.rls.disabled.length === 2, 'expected 2 RLS-disabled tables');
assert(objects.rls.forced.length === 0, 'expected zero FORCE RLS tables');
assert(objects.rls.publicPolicies === 106, 'expected 106 public policies');
assert(objects.realtimePublication.tables.length === 8, 'expected eight Realtime tables');
assert(objects.storageBuckets.length === 6, 'expected six Storage buckets');
assert(objects.storageObjectPolicies.length === 16, 'expected 16 Storage policies');

exact('required tables', required.applicationTables, objects.publicTables);
exact('required views', required.applicationViews, objects.publicViews);
exact(
  'required function names',
  required.applicationFunctions,
  new Set([...objects.functionOverloads, ...objects.privateFunctionOverloads]
    .map((identity) => identity.match(/^(?:public|private)\.([^()]+)\(/)?.[1]).filter(Boolean))
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
for (const [name, fingerprint] of Object.entries(expectedFingerprints)) {
  if (!name.startsWith('stagingOverlay')) {
    assert(contract.includes(fingerprint), `current-state contract omits ${name} fingerprint`);
  }
}
for (const canonicalField of [
  'policy_def.schemaname', 'policy_def.tablename', 'policy_def.policyname',
  'policy_def.permissive', 'policy_def.cmd', 'array_to_string(policy_def.roles',
  'policy_def.qual', 'policy_def.with_check', 'class_def.relkind',
  'acl_entry.grantee', 'acl_entry.privilege_type', 'acl_entry.is_grantable',
  'bucket_def.id', 'bucket_def.name', 'bucket_def.public',
  'bucket_def.file_size_limit', 'bucket_def.allowed_mime_types',
]) {
  assert(contract.includes(canonicalField),
    `current-state contract omits canonical security field: ${canonicalField}`);
}
assert(!/^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|CREATE\s+|DROP\s+|TRUNCATE\s+)/gim.test(contract),
  'current-state contract contains a mutating statement');

const overlayWithoutComments = overlay.replace(/^\s*--.*$/gm, '');
assert(overlay.includes("target_ref = 'uhinvcydgzqlpnvieyal'"), 'overlay Production ref deny is missing');
assert(overlay.indexOf('$target_guard$') < overlay.indexOf('DROP POLICY'), 'overlay guard must precede the write');
assert((overlayWithoutComments.match(/DROP POLICY/g) ?? []).length === 1, 'overlay must drop exactly one policy');
assert(!overlayWithoutComments.includes('DROP POLICY IF EXISTS'), 'overlay must fail when the one-time policy is absent');
assert(overlayWithoutComments.includes('DROP POLICY "Authenticated users can upload chat images" ON storage.objects;'),
  'overlay targets the wrong policy');
for (const fingerprint of [
  expectedFingerprints.stagingOverlayTargetStorageBuckets,
  expectedFingerprints.stagingOverlayBaselineStoragePolicies,
  expectedFingerprints.stagingOverlayTargetStoragePolicies,
]) {
  assert(overlay.includes(fingerprint), `overlay omits required fingerprint: ${fingerprint}`);
}
assert(overlay.includes('policy_count <> 16'), 'overlay does not require the 16-policy baseline');
assert(overlay.includes('policy_count <> 15'), 'overlay does not require the 15-policy current state');
assert(overlay.includes('IF NOT EXISTS ('), 'overlay does not require the exact policy before writing');
assert(!/^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|CREATE\s+|TRUNCATE\s+)/gim.test(overlayWithoutComments),
  'overlay contains an unrelated mutation');

const appFiles = await sourceFiles(resolve(root, 'app'));
const appSources = await Promise.all(appFiles.map(async (path) => ({ path, source: await readFile(path, 'utf8') })));
const paymentClaim = manifest.paymentClaim;
const paymentClaimMigration = await readFile(resolve(root,
  'supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql'), 'utf8');
assert(paymentClaim.columns.length === 5, 'expected five payment claim columns');
assert(paymentClaim.indexes.length === 3, 'expected three payment claim indexes');
assert(paymentClaim.securityDefinerFunctions.length === 7, 'expected seven payment claim DEFINER functions');
exact('payment claim INVOKER function', paymentClaim.securityInvokerFunctions,
  ['public.guard_experience_payment_claim_columns()']);
exact('payment claim direct execute roles', paymentClaim.directExecuteRoles, ['service_role']);
assert(paymentClaim.searchPath === '', 'payment claim search_path must remain empty');
for (const column of paymentClaim.columns) {
  assert(column.nullable && column.default === null, `payment claim column defaults differ: ${column.name}`);
  assert(paymentClaimMigration.includes(`ADD COLUMN ${column.name} ${column.type}`),
    `payment claim column differs from migration: ${column.name}`);
  assert(contract.includes(`${column.name}|${column.type}|YES|`),
    `payment claim column contract missing: ${column.name}`);
}
for (const object of [...paymentClaim.indexes, paymentClaim.constraint, paymentClaim.trigger]) {
  assert(paymentClaimMigration.includes(object.name), `payment claim object missing from migration: ${object.name}`);
  assert(contract.includes(object.definition.replaceAll("'", "''")),
    `payment claim catalog definition missing from contract: ${object.name}`);
}
for (const identity of [...paymentClaim.securityDefinerFunctions, ...paymentClaim.securityInvokerFunctions]) {
  assert(objects.functionOverloads.includes(identity), `payment claim overload missing: ${identity}`);
}
for (const identity of paymentClaim.securityDefinerFunctions) {
  const functionName = identity.match(/^public\.([^()]+)\(/)[1];
  assert(appSources.some(({ source }) => source.includes(functionName)),
    `payment claim function has no application callsite: ${functionName}`);
}
assert(contract.includes('$payment_claim_contract$'), 'payment claim security contract is missing');

const monitoring = manifest.adminMessageMonitoring;
assert(manifest.schemaContractVersion === 4 && required.schemaContractVersion === 4,
  'expected current-state contract version 4');
assert(monitoring.columns.length === 2 && monitoring.indexes.length === 1
  && monitoring.triggers.length === 2 && monitoring.functions.length === 5,
  'admin monitoring object counts differ');
exact('chat direct write roles', monitoring.directWriteRoles, ['service_role']);
exact('chat public RPC execute roles', monitoring.publicRpcExecuteRoles, ['service_role']);
exact('chat private helper execute roles', monitoring.privateHelperExecuteRoles, ['postgres']);
exact('removed chat UPDATE policies', monitoring.removedUpdatePolicies, [
  'Users can update own inquiries', 'Users can update messages in their inquiries',
]);
for (const column of monitoring.columns) {
  assert(column.nullable && column.default === null, `chat column defaults differ: ${column.name}`);
  assert(contract.includes(`${column.table}|${column.name}|${column.type}|YES|`),
    `chat column contract missing: ${column.name}`);
}
for (const object of [...monitoring.indexes, ...monitoring.triggers]) {
  assert(contract.includes(object.definition.replaceAll("'", "''")),
    `chat catalog definition missing: ${object.name}`);
}
for (const fn of monitoring.functions) {
  const isPublic = fn.identity.startsWith('public.');
  assert((isPublic ? objects.functionOverloads : objects.privateFunctionOverloads).includes(fn.identity),
    `chat function inventory missing: ${fn.identity}`);
  assert(fn.owner === 'postgres' && fn.securityDefiner
    && JSON.stringify(fn.configuration) === JSON.stringify(['search_path=""'])
    && fn.acl === (isPublic ? '{postgres=X/postgres,service_role=X/postgres}' : '{postgres=X/postgres}'),
  `chat function security differs: ${fn.identity}`);
  const tuple = [fn.identity, fn.owner, fn.securityDefiner, fn.volatility, fn.result,
    fn.configuration.join(','), fn.acl, fn.bodyMd5].join('|');
  assert(contract.includes(tuple.replaceAll("'", "''")),
    `chat function body/ACL assertion missing: ${fn.identity}`);
}
for (const fragment of ['$admin_message_monitoring_contract$', '$admin_monitoring_ledger_contract$',
  'has_any_column_privilege', 'index_def.indisvalid', "trigger_def.tgenabled = 'O'", 'rowfilter IS NOT NULL']) {
  assert(contract.includes(fragment), `chat safety assertion missing: ${fragment}`);
}

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
