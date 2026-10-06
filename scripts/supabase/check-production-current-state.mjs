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
  publicRelationGrants: '23a636eb7731f130f48aaeceb415c8cf',
  privateRelationGrants: 'ee6e712c55f00b284ed8a988b04b163d',
  stagingOverlayBaselineStoragePolicies: 'd6b381fd629405acfdd615593031de5c',
  stagingOverlayTargetStorageBuckets: 'c3ff5767c8e4934ae05b3d96550441c8',
  stagingOverlayTargetStoragePolicies: '38c973a52a0bebe8fa78b3f53089e427',
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const required = JSON.parse(await readFile(requiredPath, 'utf8'));
const contract = await readFile(contractPath, 'utf8');
const overlay = await readFile(overlayPath, 'utf8');
const capture = await readFile(resolve(root, 'supabase/staging/production-current-state.capture.sql'), 'utf8');

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
  {
    version: '20261002075149',
    repositoryVersion: '20261002041848',
    name: 'admin_attention_badges_phase_2',
    repositoryFile: 'supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql',
    repositorySha256: 'd20d5774318f8fe52dc41d13a533728b13c98a20fab812cd693737dba0de51a2',
  },
  {
    "version": "20261003012400",
    "name": "phone_followup_tasks",
    "repositoryVersion": "20261002140902",
    "repositoryFile": "supabase/migrations/20261002140902_phone_followup_tasks.sql",
    "repositorySha256": "88769a249dca3d7b2f0cbd2dc6a8cf2197960213a357bac71353978a5ae0e396"
  },
  {
    "version": "20261003134417",
    "name": "admin_chat_bounded_search",
    "repositoryVersion": "20261003122803",
    "repositoryFile": "supabase/migrations/20261003122803_admin_chat_bounded_search.sql",
    "repositorySha256": "0e9776caab4c826924eade21baa229ec73a27857d9c1c9bb75a97b25b1b31724"
  },
];
const observedAppliedMediaMigrations = [
  {
    "version": "20261004053224",
    "name": "media_lifecycle_foundation",
    "repositoryFile": "supabase/migrations/20261004053224_media_lifecycle_foundation.sql",
    "repositorySha256": "c8cd123855ba600070fd22ddaef6b6a37591110f18cec92829de37ff0fdb3cfd"
  },
  {
    "version": "20261005082309",
    "name": "avatar_media_authority",
    "repositoryFile": "supabase/migrations/20261005082309_avatar_media_authority.sql",
    "repositorySha256": "b8a749115d2e279ea8b0e37d17ef6c373d3eec5e5f51b555c7fd62b1e58d774f"
  }
];
expectedLedger.push(...observedAppliedMediaMigrations);
const observedAppliedFinancialMigrations = [
  {
    "version": "20261005104924",
    "repositoryVersion": "20261005104924",
    "name": "solo_guarantee_financial_authority",
    "repositoryFile": "supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql",
    "repositorySha256": "df95be49a1df1e5b1fbc1e89afa0ff589b8041c4d9ed54e5d39945eaeee09c11"
  }
];
expectedLedger.push(...observedAppliedFinancialMigrations);
expectedLedger.push({
  "version": "20261006013755",
  "name": "host_profile_media_authority",
  "repositoryFile": "supabase/migrations/20261006013755_host_profile_media_authority.sql",
  "repositorySha256": "913d253b2853fa2581fb886cfd2279db147bb84f5b5b55c7dc12386fa49220d8",
  "repositoryVersion": "20261006013755"
});
expectedLedger.push({
  "version": "20261006133015",
  "name": "admin_chat_canonical_recency",
  "repositoryFile": "supabase/migrations/20261006133015_admin_chat_canonical_recency.sql",
  "repositorySha256": "e2a79488d8b24a5d923f9247d5331eb2f9de95436a6ec790bf81981c00d8a889",
  "repositoryVersion": "20261006133015"
});
const expectedPendingMigrations = [
  {
    "version": "20261006105322",
    "name": "community_media_authority",
    "repositoryFile": "supabase/migrations/20261006105322_community_media_authority.sql",
    "repositorySha256": "55ac4184288d9213e31b4f40de928d7ccfd4c02765db90c0d2d7f8858c597912"
  }
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
    assert(contract.includes(`${actual.version}:${actual.name}:1:${digest}:${actual.repositorySha256}`),
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

assert(!('pendingPrivateTables' in required) && !('pendingApplicationFunctions' in required),
  'applied attention objects must not remain pending');
for (const pending of expectedPendingMigrations) {
  assert(await sha256(pending.repositoryFile) === pending.repositorySha256, 'prepared migration bytes differ');
}

assert(JSON.stringify(manifest.pendingProductionMigrations) === JSON.stringify(expectedPendingMigrations), 'manifest pending migration state differs');
assert(manifest.source.captureSql === 'supabase/staging/production-current-state.capture.sql'
  && manifest.source.postgresMajor === 17 && manifest.source.containsRows === false
  && manifest.source.containsStorageObjects === false, 'read-only capture provenance differs');
assert((capture.match(/^BEGIN TRANSACTION READ ONLY;$/gm) ?? []).length === 6
  && (capture.match(/^ROLLBACK;$/gm) ?? []).length === 6
  && !/^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|CREATE\s+|DROP\s+|TRUNCATE\s+)/gim.test(capture),
  'current-state capture must use only read-only transactions');
assert(JSON.stringify(manifest.selectiveProductionRollout) === JSON.stringify(required.selectiveProductionRollout)
  && JSON.stringify(required.selectiveProductionRollout.allowedVersions) === JSON.stringify(['20261005104924'])
  && required.selectiveProductionRollout.requiresFreshProductionLedger === true
  && required.selectiveProductionRollout.blanketPendingMigrationApply === false
  && required.selectiveProductionRollout.runbook === 'docs/solo-guarantee-p0-rollout.md', 'selective Production rollout rule differs');
assert(contract.includes('$media_authority_ledger_contract$') && contract.includes('$applied_media_catalog_contract$')
  && contract.includes("WHERE version='20261005104924'"), 'applied migration boundary assertions missing');
for (const entry of manifest.appliedMediaAuthority.ledgerEvidence) {
  assert(entry.statementCount === 1 && entry.statementsSha256 === expectedLedger.find(x => x.version === entry.version)?.repositorySha256
    && manifest.migrationLedger.find(x => x.version === entry.version)?.ledgerStatementsSha256 === entry.statementsSha256
    && contract.includes(`${entry.version}:${entry.name}:${entry.statementCount}:${entry.statementsMd5}:${entry.statementsSha256}`), 'applied media SQL evidence differs');
}
for (const fn of manifest.appliedMediaAuthority.functions) {
  assert(contract.includes([fn.identity,fn.owner,fn.securityDefiner,fn.volatility,fn.result,
    fn.configuration.join(','),fn.acl,fn.bodyMd5].join('|').replaceAll("'", "''")), `applied media function evidence missing: ${fn.identity}`);
}

assert(contract.includes('$solo_financial_ledger_contract$') && contract.includes('$solo_financial_catalog_contract$'), 'financial current-state assertions missing');
const financial = manifest.appliedFinancialAuthority;
assert(financial.functions.length === 25 && financial.columns.length === 46 && financial.indexes.length === 6
  && financial.constraints.length === 18 && financial.triggers.length === 4, 'financial catalog evidence counts differ');
assert(financial.clientBookingDml === false && financial.bookingSelectPreserved === true
  && financial.completion42702Qualified === true, 'financial authority evidence differs');
exact('financial public RPC roles', financial.publicRpcExecuteRoles, ['service_role']);
exact('financial private helper roles', financial.privateHelperExecuteRoles, ['service_role']);
const financialLedger = financial.ledgerEvidence[0];
assert(financialLedger.version === '20261005104924' && financialLedger.statementCount === 1
  && financialLedger.statementsSha256 === observedAppliedFinancialMigrations[0].repositorySha256
  && contract.includes(`${financialLedger.version}:${financialLedger.name}:1:${financialLedger.statementsMd5}:${financialLedger.statementsSha256}`), 'financial applied ledger evidence differs');
for (const fn of financial.functions) {
  assert(fn.acl === '{postgres=X/postgres,service_role=X/postgres}' && fn.owner === 'postgres', 'financial RPC grant evidence differs');
  assert(contract.includes([fn.identity,fn.owner,fn.securityDefiner,fn.volatility,fn.result,
    fn.configuration.join(','),fn.acl,fn.bodyMd5].join('|').replaceAll("'", "''")), `financial function evidence missing: ${fn.identity}`);
}
for (const column of financial.columns) {
  assert(contract.includes([column.table,column.name,column.type,column.notNull,column.default].join('|').replaceAll("'", "''")), `financial column evidence missing: ${column.name}`);
}
for (const object of [...financial.indexes,...financial.constraints,...financial.triggers]) {
  assert(contract.includes(object.definition.replaceAll("'", "''")), `financial object evidence missing: ${object.name}`);
}
const host = manifest.appliedHostAuthority;
assert(host.functions.length === 12 && host.tables.length === 3 && host.columns.length === 10
  && host.constraints.length === 8 && host.indexes.length === 3 && host.triggers.length === 13,
  'Host catalog evidence counts differ');
assert(JSON.stringify(host.authority) === JSON.stringify([{ singleton: true, r2_enabled: true }])
  && host.productionWrites === 0, 'live Host authority evidence differs');
assert(contract.includes('$host_authority_catalog_contract$') && contract.includes('$host_authority_production_contract$'),
  'Host applied contracts missing');
for (const fn of host.functions) {
  assert(fn.owner === 'postgres' && JSON.stringify(fn.configuration) === JSON.stringify(['search_path=""']),
    'Host function owner/search_path differs');
  assert(contract.includes([fn.identity,fn.owner,fn.securityDefiner,fn.volatility,fn.result,
    fn.configuration.join(','),fn.acl,fn.bodyMd5].join('|').replaceAll("'", "''")), 'Host function evidence missing');
}
for (const object of [...host.constraints,...host.indexes,...host.triggers]) {
  assert(contract.includes(object.definition.replaceAll("'", "''")), 'Host catalog definition missing');
}
const hostLedger = host.ledgerEvidence[0];
assert(hostLedger.version === '20261006013755' && hostLedger.statementCount === 1
  && hostLedger.statementsSha256 === expectedLedger.find(x => x.version === hostLedger.version).repositorySha256
  && contract.includes(`${hostLedger.version}:${hostLedger.name}:1:${hostLedger.statementsMd5}:${hostLedger.statementsSha256}`),
  'Host ledger evidence differs');
const recency = manifest.adminChatRecency;
assert(recency.functions.length === 2 && recency.indexes.length === 1
  && recency.maximumBatch === 100 && recency.existingFunctionsPreserved === 124
  && recency.productionBusinessWrites === 0
  && JSON.stringify(recency.publicRpcExecuteRoles) === JSON.stringify(['service_role']), 'Recency capture metadata differs');
assert(contract.includes('$admin_chat_recency_catalog_contract$')
  && contract.includes('$admin_chat_recency_ledger_contract$'), 'Recency current-state assertions missing');
for (const fn of recency.functions) {
  assert(fn.owner === 'postgres' && fn.securityDefiner === false && fn.volatility === 's'
    && JSON.stringify(fn.configuration) === JSON.stringify(['search_path=""'])
    && fn.acl === '{postgres=X/postgres,service_role=X/postgres}', 'Recency RPC security differs');
  assert(contract.includes([fn.identity,fn.owner,fn.securityDefiner,fn.volatility,fn.result,
    fn.configuration.join(','),fn.acl,fn.bodyMd5].join('|').replaceAll("'", "''")), 'Recency function evidence missing');
  assert(manifest.objects.functionOverloads.includes(fn.identity), 'Recency overload missing');
}
const recencyIndex = recency.indexes[0];
assert(recencyIndex.valid && recencyIndex.ready && !recencyIndex.unique && !recencyIndex.primary
  && recencyIndex.name === 'admin_chat_visible_message_recency'
  && contract.includes(recencyIndex.definition.replaceAll("'", "''"))
  && contract.includes(recencyIndex.predicate.replaceAll("'", "''")), 'Recency index evidence differs');
const recencyLedger = recency.ledgerEvidence[0];
assert(recencyLedger.version === '20261006133015' && recencyLedger.statementCount === 1
  && recencyLedger.statementsSha256 === expectedLedger.at(-1).repositorySha256
  && contract.includes(`${recencyLedger.version}:${recencyLedger.name}:1:${recencyLedger.statementsMd5}:${recencyLedger.statementsSha256}`), 'Recency ledger evidence differs');
const objects = manifest.objects;
for (const [name, fingerprint] of Object.entries(expectedFingerprints)) {
  if (!name.startsWith('stagingOverlayTarget')) {
    assert(manifest.securityFingerprints[name] === fingerprint,
      `security fingerprint differs: ${name}`);
  }
}
assert(objects.publicTables.length === 44, 'expected 44 public tables');
assert(objects.publicViews.length === 2, 'expected 2 public views');
assert(objects.publicTableColumns === 605, 'expected 605 public table columns');
assert(objects.publicViewColumns === 27, 'expected 27 public view columns');
assert(objects.functionOverloads.length === 99, 'expected 99 public function overloads');
exact('private function overloads', objects.privateFunctionOverloads, [
  "private.admin_chat_phone_title(category text, form_data jsonb)",
  "private.adopt_phone_followup_link()",
  "private.advance_support_version()",
  "private.apply_host_profile_media_locators(p_owner_id uuid, p_asset_id uuid, p_old_url text, p_references jsonb, p_rollback boolean)",
  "private.assert_booking_payout_safe(p_booking bookings)",
  "private.bump_experience_media_revision()",
  "private.canonical_experience_media_locator(p_url text)",
  "private.capture_phone_followup()",
  "private.delete_pending_phone_followup()",
  "private.guard_booking_money_transition()",
  "private.guard_host_profile_legacy_writer()",
  "private.guard_host_profile_reference_zero_journal()",
  "private.guard_unresolved_booking_delete()",
  "private.handle_phone_followup(p_request uuid, p_inquiry bigint, p_ids bigint[], p_admin uuid, p_complete boolean)",
  "private.has_phone_followup(p_request uuid)",
  "private.host_profile_auth_inventory()",
  "private.host_profile_legacy_writes_frozen()",
  "private.is_admin_reader()",
  "private.is_inquiry_admin_sender(p_sender uuid)",
  "private.journal_solo_refund_attempt()",
  "private.lock_booking_money(p_experience_id bigint)",
  "private.lock_host_profile_owner()",
  "private.prepare_support_message()",
  "private.solo_refund_due(p_booking bookings)",
  "private.sync_experience_media_assets()",
  "private.sync_host_profile_assets()",
  "private.sync_profile_avatar_assets()"
]);
assert(objects.applicationTriggers.length === 37, 'expected 37 application triggers');
assert(objects.indexes === 150, 'expected 150 public indexes');
assert(objects.constraints.total === 224, 'expected 224 constraints');
assert(objects.constraints.primaryKey === 44, 'expected 44 primary keys');
assert(objects.constraints.foreignKey === 62, 'expected 62 foreign keys');
assert(objects.constraints.unique === 18, 'expected 18 unique constraints');
assert(objects.constraints.check === 100, 'expected 100 check constraints');
assert(objects.rls.enabled.length === 42, 'expected 42 RLS-enabled tables');
assert(objects.rls.disabled.length === 2, 'expected 2 RLS-disabled tables');
assert(objects.rls.forced.length === 0, 'expected zero FORCE RLS tables');
assert(objects.rls.publicPolicies === 106, 'expected 106 public policies');
assert(objects.realtimePublication.tables.length === 8, 'expected eight Realtime tables');
assert(objects.storageBuckets.length === 6, 'expected six Storage buckets');
assert(objects.storageObjectPolicies.length === 16, 'expected 16 Storage policies');

exact('private tables', objects.privateTables, ["admin_monitor_cutover", "host_profile_auth_cas", "host_profile_operation_context", "host_profile_source_authority", "phone_followup_tasks"]);
exact('required private tables', required.applicationPrivateTables, objects.privateTables.map(name => `private.${name}`));
assert(objects.privateTableColumns === 19 && objects.privateIndexes === 7 && objects.privateConstraints === 15,
  'private cutover catalog counts differ');
exact('private RLS tables', objects.privateRls.enabled, ['admin_monitor_cutover', 'phone_followup_tasks']);
assert(objects.privateRls.forced.length === 0 && objects.privateRls.policies === 0, 'private RLS policy surface differs');

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

for (const section of [manifest.phoneFollowup, manifest.adminChatSearch]) {
  for (const fn of section.functions) {
    assert(contract.includes([fn.identity,fn.owner,fn.securityDefiner,fn.volatility,fn.result,
      fn.configuration.join(','),fn.acl,fn.bodyMd5].join('|').replaceAll("'", "''")),
    `applied Phone/search function assertion missing: ${fn.identity}`);
  }
  for (const index of (section.indexes ?? [...section.table.indexes, ...section.publicIndexes])) {
    assert(contract.includes(index.definition.replaceAll("'", "''")), `applied index assertion missing: ${index.name}`);
  }
}
assert(manifest.phoneFollowup.directTableRoles.length === 0 && manifest.adminChatSearch.resultLimit === 25
  && manifest.adminChatSearch.minimumQueryLength === 2 && manifest.adminChatSearch.lockTimeout === '2s',
  'applied Phone/search security or bounded search contract differs');

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
assert(manifest.schemaContractVersion === 8 && required.schemaContractVersion === 8,
  'expected current-state contract version 8');
assert(monitoring.columns.length === 2 && monitoring.indexes.length === 2
  && monitoring.triggers.length === 2 && monitoring.functions.length === 7,
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

const cutover = manifest.adminAttention.cutover;
assert(cutover.schema === 'private' && cutover.table === 'admin_monitor_cutover' && cutover.owner === 'postgres'
  && cutover.rlsEnabled && !cutover.rlsForced && cutover.policies === 0
  && cutover.acl === '{postgres=arwdDxtm/postgres,service_role=r/postgres}', 'cutover table security differs');
exact('cutover client roles', cutover.clientAccessRoles, []);
exact('cutover server SELECT roles', cutover.serverSelectRoles, ['service_role']);
assert(cutover.columns.length === 4 && cutover.constraints.length === 4, 'cutover shape differs');
for (const column of cutover.columns) {
  assert(!column.nullable && contract.includes(`${column.name}|${column.type}|NO|${column.default ?? ''}`),
    `cutover column assertion missing: ${column.name}`);
}
for (const constraint of cutover.constraints) {
  assert(contract.includes(`${constraint.name}|${constraint.type}|${constraint.definition}`), 'cutover constraint assertion missing');
}
assert(contract.includes(cutover.index.definition), 'cutover index assertion missing');
assert(cutover.productionMarker.singleton && cutover.productionMarker.messages === 410
  && cutover.productionMarker.conversations === 40
  && cutover.productionMarker.applied_at === '2026-10-02T07:51:49.802096+00:00', 'Production cutover evidence differs');
for (const fragment of ['$admin_attention_contract$', '$admin_attention_production_marker$', 'conversations = 40 AND messages = 410',
  "'2026-10-02T07:51:49.802096Z'", "sha256(convert_to(statements[1], 'UTF8'))"]) {
  assert(contract.includes(fragment), `applied attention assertion missing: ${fragment}`);
}
exact('attention function identities', manifest.adminAttention.functions, monitoring.functions.filter(fn => fn.identity.startsWith('public.')).map(fn => fn.identity));
exact('attention execute roles', manifest.adminAttention.directExecuteRoles, ['service_role']);
assert(manifest.adminAttention.searchPath === '', 'attention search_path differs');

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
