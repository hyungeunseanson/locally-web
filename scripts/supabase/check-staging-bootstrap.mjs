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
const adminReaderTargetContract = await readFile(
  resolve(root, 'supabase/staging/admin-reader-private-contract.sql'),
  'utf8'
);
const attentionTargetContract = await readFile(resolve(root, 'supabase/staging/admin-attention-target-contract.sql'), 'utf8');
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

exact('applied private tables', required.applicationPrivateTables, ["private.admin_monitor_cutover", "private.host_profile_auth_cas", "private.host_profile_operation_context", "private.host_profile_source_authority", "private.phone_followup_tasks"]);
if ('pendingPrivateTables' in required || 'pendingApplicationFunctions' in required) fail('applied attention objects remain pending');
if (!attentionTargetContract.includes('BEGIN READ ONLY;') || !attentionTargetContract.trimEnd().endsWith('ROLLBACK;')
  || !attentionTargetContract.includes('ADMIN_ATTENTION_TARGET_CONTRACT_PASS')
  || current.adminAttention.functions.some(identity => !current.objects.functionOverloads.includes(identity))) {
  fail('applied attention contract must verify current server-only RPCs read-only');
}
const attentionAssertions = attentionTargetContract.match(/DO \$admin_attention_contract\$[\s\S]*?\$admin_attention_contract\$;/)?.[0];
if (!attentionAssertions || !currentContract.includes(attentionAssertions) || !schemaContract.includes(attentionAssertions)
  || schemaContract.includes('$admin_attention_production_marker$')) {
  fail('current/staging must share cutover security assertions; exact Production counters are not staging seed expectations');
}

const expectedAppliedOrder = [
  'supabase/migrations/20260912034545_production_schema_baseline.sql',
  'supabase/migrations/20260912050655_service_concierge_assignment.sql',
  'supabase/migrations/20260915141606_p0_storage_rpc_security_hardening.sql',
  'supabase/migrations/20260916024355_experience_media_locator_cas.sql',
  'supabase/migrations/20260916032730_experience_storage_lockdown.sql',
  'supabase/migrations/20260916111416_review_tour_end_db_foundation.sql',
  'supabase/migrations/20260916134243_review_direct_write_lockdown.sql',
  'supabase/migrations/20260918000000_proxy_card_intake_atomic.sql',
  'supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql',
  'supabase/migrations/20260922125140_close_refunded_phone_proxy_requests.sql',
  'supabase/migrations/20260923013312_ops_anomaly_monitor_snapshot.sql',
  'supabase/migrations/20260923084232_one_time_review_request_reminders.sql',
  'supabase/migrations/20260929144521_harden_public_host_applications_security_barrier.sql',
  'supabase/migrations/20260930022348_move_is_admin_reader_to_private_schema.sql',
  'supabase/migrations/20261001170718_admin_message_monitoring_phase_1.sql',
  'supabase/migrations/20261002015110_admin_message_monitoring_historical_reinquiry.sql',
  'supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql',
  'supabase/migrations/20261002140902_phone_followup_tasks.sql',
  'supabase/migrations/20261003122803_admin_chat_bounded_search.sql',
  'supabase/migrations/20261004053224_media_lifecycle_foundation.sql',
  'supabase/migrations/20261005082309_avatar_media_authority.sql',
  'supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql',
  'supabase/migrations/20261006013755_host_profile_media_authority.sql',
];
const expectedPendingOrder = [
  'supabase/migrations/20261006105322_community_media_authority.sql',
  'supabase/migrations/20261006133015_admin_chat_canonical_recency.sql',
];
const expectedApplyOrder = [...expectedAppliedOrder];
exact('fresh-project apply order', required.freshProjectApplyOrder, expectedApplyOrder);
exact(
  'pending Production migrations',
  required.pendingProductionMigrations.map((entry) => entry.repositoryFile),
  expectedPendingOrder
);

const migrationFiles = (await readdir(resolve(root, 'supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => `supabase/migrations/${name}`);
exact('ordered repository migrations', migrationFiles, [...expectedAppliedOrder, ...expectedPendingOrder]);
exact(
  'manifest repository migrations',
  current.migrationLedger.map((entry) => entry.repositoryFile),
  expectedAppliedOrder
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
const chatAssertions = currentContract.match(/DO \$admin_message_monitoring_contract\$[\s\S]*?\$admin_message_monitoring_contract\$;/)?.[0];
if (!chatAssertions || !schemaContract.includes(chatAssertions)) {
  fail('staging schema must enforce the same applied chat security contract');
}
if (!adminReaderTargetContract.includes('BEGIN READ ONLY;')
    || !adminReaderTargetContract.trimEnd().endsWith('ROLLBACK;')
    || !adminReaderTargetContract.includes("to_regprocedure('public.is_admin_reader()')")
    || !adminReaderTargetContract.includes('private.is_admin_reader()')) {
  fail('admin-reader-private-contract.sql must verify the target in a read-only transaction');
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
  storageBuckets: '7419cabe695cd50a522314a749216c05',
  storagePolicies: '898e8b7f917fd0f4530ef30c9b61961e',
  publicRlsPolicies: 'e5a16a4215c569060fbf895453a5cd00',
  publicRelationGrants: '23a636eb7731f130f48aaeceb415c8cf',
  privateRelationGrants: 'ee6e712c55f00b284ed8a988b04b163d',
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
  pendingProductionMigrations: expectedPendingOrder,
  clonedProductionBranchAction: 'run current-state-contract.sql only',
  functionalCanaryTableCount: required.functionalCanaryMinimum.tables.length,
  activeConciergeTableCount: required.activeConcierge.tables.length,
  activeConciergeFunctionCount: required.activeConcierge.functions.length,
  result: 'LOCALLY_STAGING_BOOTSTRAP_CONTRACT_PASS',
}, null, 2));
