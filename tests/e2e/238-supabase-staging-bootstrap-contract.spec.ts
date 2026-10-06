import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('supabase/staging/required-objects.json', 'utf8'));
const baselineManifest = JSON.parse(
  readFileSync('supabase/staging/production-baseline.manifest.json', 'utf8')
);
const currentManifest = JSON.parse(
  readFileSync('supabase/staging/production-current-state.manifest.json', 'utf8')
);
const baselineContract = readFileSync('supabase/staging/baseline-contract.sql', 'utf8');
const currentContract = readFileSync('supabase/staging/current-state-contract.sql', 'utf8');
const adminReaderTargetContract = readFileSync('supabase/staging/admin-reader-private-contract.sql', 'utf8');
const attentionTargetContract = readFileSync('supabase/staging/admin-attention-target-contract.sql', 'utf8');
const schemaContract = readFileSync('supabase/staging/schema-contract.sql', 'utf8');
const inventory = readFileSync('supabase/staging/schema-only-inventory.sql', 'utf8');
const currentStateOverlay = readFileSync(
  'supabase/staging/post-baseline-current-state-overlay.sql',
  'utf8'
);
const fixtures = readFileSync('scripts/supabase/staging-fixtures.mjs', 'utf8');

function fixtureGuard(env: Record<string, string>) {
  return spawnSync(process.execPath, ['scripts/supabase/staging-fixtures.mjs', 'seed'], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test.describe('Supabase staging bootstrap contract', () => {
  test('uses the canonical baseline without treating historical patches as replayable', () => {
    expect(baselineManifest.objects.publicTables).toHaveLength(36);
    expect(currentManifest.objects.publicTables).toHaveLength(44);
    expect(baselineManifest.historicalSql.applyAfterBaseline).toEqual([]);
    expect(currentManifest.migrationLedger.map(({ version }: { version: string }) => version)).toEqual([
      '20260912034545',
      '20260912050655',
      '20260915141606',
      '20260916024355',
      '20260916032730',
      '20260916111416',
      '20260916134243',
      '20260918000000',
      '20260922081710',
      '20260922125140',
      '20260923013312',
      '20260923084232',
      '20260929144521',
      '20260930022348',
      '20261002024534',
      '20261002024638',
      '20261002075149',
      '20261003012400',
      '20261003134417',
      '20261004053224',
      '20261005082309',
      '20261005104924',
      '20261006013755',
      '20261006105322',
      '20261006133015',
    ]);
    expect(manifest.freshProjectApplyOrder).toEqual([
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
      'supabase/migrations/20261006105322_community_media_authority.sql',
      'supabase/migrations/20261006133015_admin_chat_canonical_recency.sql',
    ]);
    expect(manifest.pendingPrivateTables).toBeUndefined();
    expect(manifest.pendingApplicationFunctions).toBeUndefined();
    expect(manifest.applicationPrivateTables).toEqual(["private.admin_monitor_cutover", "private.community_media_authority", "private.community_media_context", "private.community_media_plan_receipts", "private.host_profile_auth_cas", "private.host_profile_operation_context", "private.host_profile_source_authority", "private.phone_followup_tasks"]);
    expect(manifest.applicationFunctions).toEqual(expect.arrayContaining([
      'ack_admin_inquiry_snapshot', 'get_admin_attention',
    ]));
    expect(manifest.pendingProductionMigrations).toEqual([]);
    expect(packageJson.scripts['supabase:staging:baseline:check']).toBeTruthy();
    expect(packageJson.scripts['supabase:staging:current:check']).toBeTruthy();
    expect(packageJson.scripts['supabase:staging:contract']).toBeTruthy();
  });

  test('keeps the schema inventory and assertion transactions read-only', () => {
    const capture = readFileSync(currentManifest.source.captureSql, 'utf8');
    expect(capture.match(/^BEGIN TRANSACTION READ ONLY;$/gm)).toHaveLength(7);
    expect(capture.match(/^ROLLBACK;$/gm)).toHaveLength(7);
    expect(currentManifest.migrationLedger.slice(-4).map((entry: { version: string }) => entry.version))
      .toEqual(['20261005104924', '20261006013755', '20261006105322', '20261006133015']);
    expect(currentManifest.migrationLedger.some((entry: { version: string }) => entry.version === '20261005104924')).toBe(true);
    expect(currentManifest.pendingProductionMigrations).toEqual(manifest.pendingProductionMigrations);
    expect(currentManifest.appliedFinancialAuthority.functions).toHaveLength(25);
    expect(currentManifest.appliedHostAuthority.functions).toHaveLength(12);
    expect(currentManifest.appliedHostAuthority.triggers).toHaveLength(13);
    expect(currentManifest.appliedHostAuthority.authority).toEqual([{ singleton: true, r2_enabled: true }]);
    expect(currentContract).toContain('$host_authority_production_contract$');
    expect(schemaContract).not.toContain('$host_authority_production_contract$');
    expect(currentManifest.appliedFinancialAuthority.clientBookingDml).toBe(false);
    expect(currentManifest.appliedFinancialAuthority.completion42702Qualified).toBe(true);
    expect(currentContract).toContain('$solo_financial_catalog_contract$');
    expect(currentContract).toContain('$solo_financial_ledger_contract$');
    expect(manifest.selectiveProductionRollout).toEqual({
      allowedVersions: ['20261005104924'], requiresFreshProductionLedger: true,
      blanketPendingMigrationApply: false, runbook: 'docs/solo-guarantee-p0-rollout.md',
    });
    expect(schemaContract).toContain('BEGIN READ ONLY;');
    expect(schemaContract).toContain('ROLLBACK;');
    expect(schemaContract).toContain('LOCALLY_STAGING_SCHEMA_CONTRACT_PASS');
    expect(schemaContract.match(/\('experiences', false\)/g)).toHaveLength(2);
    expect(schemaContract).not.toContain("('experiences', true)");
    for (const retiredPolicy of [
      'Auth Users Upload',
      'Experience object owners can delete',
      'Experience object owners can update',
      'Public Access',
    ]) {
      expect(schemaContract).not.toContain(retiredPolicy);
    }
    expect(baselineContract).toContain('BEGIN READ ONLY;');
    expect(baselineContract).toContain('ROLLBACK;');
    expect(baselineContract).toContain('LOCALLY_PRODUCTION_BASELINE_CATALOG_PASS');
    expect(currentContract).toContain('BEGIN READ ONLY;');
    expect(currentContract).toContain('ROLLBACK;');
    expect(currentContract).toContain('LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS');
    expect(adminReaderTargetContract).toContain('BEGIN READ ONLY;');
    expect(adminReaderTargetContract).toContain('ROLLBACK;');
    expect(adminReaderTargetContract).toContain("to_regprocedure('public.is_admin_reader()')");
    expect(adminReaderTargetContract).toContain('private.is_admin_reader()');
    expect(schemaContract).toContain("WHEN required.name = 'is_admin_reader' THEN 'private'");
    expect(schemaContract).toContain("to_regprocedure('public.is_admin_reader()')");
    expect(inventory).toContain('BEGIN READ ONLY;');
    expect(inventory).toContain('pg_get_functiondef');
    expect(inventory).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\s+/i);
  });

  test('captures every metadata class required for a schema-only baseline', () => {
    for (const requiredFragment of [
      "'owner', pg_get_userbyid(cls.relowner)",
      "'rls_enabled', cls.relrowsecurity",
      "'rls_forced', cls.relforcerowsecurity",
      "'security_invoker'",
      "'sequences'",
      "'owned_by'",
      "'function_execute_grants'",
      "'sequence_grants'",
      "acldefault('s', grant_seq.relowner)",
      "'table_and_view_grants'",
      "'column_grants'",
      "proc_nsp.nspname IN ('public', 'private')",
      "grant_proc_nsp.nspname IN ('public', 'private')",
      "pg_get_function_identity_arguments",
      "'realtime_publication'",
      "'realtime_tables'",
      "'replica_identity'",
      "'storage_buckets'",
      "schemaname IN ('public', 'private', 'storage')",
      "'body_md5', md5(proc_def.prosrc)",
      "'acl', proc_def.proacl::text",
      "'extensions'",
      "'custom_types'",
    ]) {
      expect(inventory).toContain(requiredFragment);
    }
    expect(inventory).toContain("to_jsonb(bucket_meta) - 'owner' - 'owner_id'");

    for (const unsafeAlias of [
      'constraint',
      'sequence',
      'trigger',
      'type',
      'range',
      'procedure',
      'language',
      'extension',
      'publication',
      'namespace',
      'relation',
    ]) {
      expect(inventory).not.toMatch(
        new RegExp(`\\b(?:from|join)\\s+[a-z0-9_.]+\\s+(?:as\\s+)?${unsafeAlias}\\b`, 'i')
      );
    }
  });

  test('preserves actual applied ledger versions and unchanged repository SQL bytes', () => {
    expect(currentManifest.migrationLedger.slice(14,17)).toEqual([
      {
        version: '20261002024534', name: 'admin_message_monitoring_phase_1',
        repositoryVersion: '20261001170718',
        repositoryFile: 'supabase/migrations/20261001170718_admin_message_monitoring_phase_1.sql',
        repositorySha256: 'aee6d14e1a897579e5dc6454221cb52d4bab822952096425e0b110eeb907ae95',
        ledgerStatementsSha256: 'aee6d14e1a897579e5dc6454221cb52d4bab822952096425e0b110eeb907ae95',
      },
      {
        version: '20261002024638', name: 'admin_message_monitoring_historical_reinquiry',
        repositoryVersion: '20261002015110',
        repositoryFile: 'supabase/migrations/20261002015110_admin_message_monitoring_historical_reinquiry.sql',
        repositorySha256: '80f34eea7ad6e2405aa38962a886c97e8713bfa1fefe72f0d9647686489747a1',
        ledgerStatementsSha256: '80f34eea7ad6e2405aa38962a886c97e8713bfa1fefe72f0d9647686489747a1',
      },
      {
        version: '20261002075149', name: 'admin_attention_badges_phase_2',
        repositoryVersion: '20261002041848',
        repositoryFile: 'supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql',
        repositorySha256: 'd20d5774318f8fe52dc41d13a533728b13c98a20fab812cd693737dba0de51a2',
        ledgerStatementsSha256: 'd20d5774318f8fe52dc41d13a533728b13c98a20fab812cd693737dba0de51a2',
      },
    ]);
    expect(currentManifest.schemaContractVersion).toBe(9);
    expect(manifest.schemaContractVersion).toBe(9);
    expect(currentManifest.migrationLedger.slice(17, 19)).toEqual([
      {
        version: '20261003012400', name: 'phone_followup_tasks', repositoryVersion: '20261002140902',
        repositoryFile: 'supabase/migrations/20261002140902_phone_followup_tasks.sql',
        repositorySha256: '88769a249dca3d7b2f0cbd2dc6a8cf2197960213a357bac71353978a5ae0e396',
        ledgerStatementsSha256: '88769a249dca3d7b2f0cbd2dc6a8cf2197960213a357bac71353978a5ae0e396',
      },
      {
        version: '20261003134417', name: 'admin_chat_bounded_search', repositoryVersion: '20261003122803',
        repositoryFile: 'supabase/migrations/20261003122803_admin_chat_bounded_search.sql',
        repositorySha256: '0e9776caab4c826924eade21baa229ec73a27857d9c1c9bb75a97b25b1b31724',
        ledgerStatementsSha256: '0e9776caab4c826924eade21baa229ec73a27857d9c1c9bb75a97b25b1b31724',
      },
    ]);
    expect(currentContract).toContain('$phone_search_ledger_contract$');
    expect(currentManifest.adminChatSearch).toMatchObject({
      minimumQueryLength: 2, resultLimit: 25, lockTimeout: '2s', publicRpcExecuteRoles: ['service_role'],
      helperExecuteRoles: ['anon', 'authenticated', 'service_role'],
    });
    expect(currentManifest.adminChatSearch.functions.every((fn: { securityDefiner: boolean }) => !fn.securityDefiner)).toBe(true);
    expect(currentManifest.adminChatSearch.indexes).toHaveLength(12);
    expect(currentManifest.phoneFollowup.directTableRoles).toEqual([]);
  });

  test('rejects chat schema, grants, function and applied-ledger drift in local PostgreSQL', () => {
    const result = spawnSync(process.execPath, ['scripts/supabase/production-current-state-contract.test.mjs'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 25_000,
    });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('CURRENT_STATE_CATALOG_DRIFT_TEST_PASS');
    expect(result.stdout).toContain('"driftChecks":88');
    expect(result.stdout).toContain('"staticDriftChecks":5');
    expect(result.stdout).toContain('"productionMutation":0');
  });

  test('checks applied attention security while separating Production and fresh staging cutover markers', () => {
    const attention = currentManifest.adminAttention;
    expect(attention.directExecuteRoles).toEqual(['service_role']);
    expect(attention.searchPath).toBe('');
    expect(attention.functions).toHaveLength(4);
    expect(attention.cutover.rlsEnabled).toBe(true);
    expect(attention.cutover.rlsForced).toBe(false);
    expect(attention.cutover.policies).toBe(0);
    expect(attention.cutover.clientAccessRoles).toEqual([]);
    expect(attention.cutover.serverSelectRoles).toEqual(['service_role']);
    expect(attention.cutover.productionMarker).toEqual({
      singleton: true, conversations: 40, messages: 410,
      applied_at: '2026-10-02T07:51:49.802096+00:00',
    });
    const assertions = attentionTargetContract.match(
      /DO \$admin_attention_contract\$[\s\S]*?\$admin_attention_contract\$;/
    )?.[0];
    expect(assertions).toBeTruthy();
    for (const contract of [currentContract, schemaContract, attentionTargetContract]) {
      expect(contract).toContain('BEGIN READ ONLY;');
      expect(contract).toContain('ROLLBACK;');
      expect(contract).toContain(assertions!);
    }
    expect(currentContract).toContain('$admin_attention_production_marker$');
    expect(schemaContract).not.toContain('$admin_attention_production_marker$');
    expect(attentionTargetContract).not.toContain('$admin_attention_production_marker$');
    expect(currentManifest.adminMessageMonitoring.indexes.map(({ name }: { name: string }) => name))
      .toContain('inquiry_messages_admin_unseen_idx');
    for (const identity of attention.functions) {
      const definition = currentManifest.adminMessageMonitoring.functions.find(
        (entry: { identity: string }) => entry.identity === identity
      );
      expect(definition.securityDefiner).toBe(true);
      expect(definition.acl).toBe('{postgres=X/postgres,service_role=X/postgres}');
      expect(definition.configuration).toEqual(['search_path=""']);
      expect(currentContract).toContain(definition.bodyMd5);
      expect(schemaContract).toContain(definition.bodyMd5);
    }
  });

  test('captures applied payment claim objects and service-only security without widening the canary', () => {
    const claim = currentManifest.paymentClaim;
    expect(claim.columns.map(({ name }: { name: string }) => name)).toEqual([
      'payment_claim_state', 'payment_claim_expires_at', 'payment_provider',
      'payment_provider_reference', 'payment_claim_token',
    ]);
    expect(claim.indexes.map(({ name }: { name: string }) => name)).toEqual([
      'bookings_payment_claim_reconciliation_idx', 'bookings_payment_provider_reference_key',
      'bookings_pending_cleanup_candidate_idx',
    ]);
    expect(claim.constraint.name).toBe('bookings_payment_claim_state_check');
    expect(claim.trigger.name).toBe('bookings_payment_claim_columns_server_only');
    expect(claim.securityDefinerFunctions).toHaveLength(7);
    expect(claim.securityInvokerFunctions).toEqual(['public.guard_experience_payment_claim_columns()']);
    expect(claim.directExecuteRoles).toEqual(['service_role']);
    expect(claim.searchPath).toBe('');
    for (const identity of [...claim.securityDefinerFunctions, ...claim.securityInvokerFunctions]) {
      expect(currentManifest.objects.functionOverloads).toContain(identity);
      expect(manifest.applicationFunctions).toContain(identity.split('.')[1].split('(')[0]);
    }
    for (const object of [...claim.indexes, claim.constraint, claim.trigger]) {
      expect(currentContract).toContain(object.definition.replaceAll("'", "''"));
    }
    expect(currentContract).toContain("procedure_def.prosecdef <> (procedure_def.proname <> 'guard_experience_payment_claim_columns')");
    expect(currentContract).toContain("coalesce(procedure_def.proconfig, ARRAY[]::text[]) <> ARRAY['search_path=\"\"']::text[]");
    expect(manifest.applicationTriggers).toContain(claim.trigger.name);
    expect(manifest.functionalCanaryMinimum.functions).not.toContain('claim_experience_payment_atomic');
    expect(manifest.functionalCanaryMinimum.functions).not.toContain('cancel_expired_pending_bookings_atomic');
  });

  test('reproduces the exact eight-table Production Realtime publication', () => {
    expect(manifest.realtimePublicationTables).toEqual([
      'admin_audit_logs',
      'admin_task_comments',
      'admin_tasks',
      'admin_whitelist',
      'inquiries',
      'inquiry_messages',
      'notifications',
      'profiles',
    ]);
    expect(manifest.functionalCanaryMinimum.realtimePublicationTables).toEqual([
      'inquiry_messages',
      'notifications',
      'profiles',
    ]);
    expect(schemaContract).toContain('supabase_realtime differs from Production parity');
    expect(schemaContract).toContain("'unexpected:' || publication.schemaname");
  });

  test('rejects the known Production project before any fixture write', () => {
    const result = fixtureGuard({
      SUPABASE_STAGING_URL: 'https://uhinvcydgzqlpnvieyal.supabase.co',
      SUPABASE_STAGING_SERVICE_ROLE_KEY: 'not-a-real-key',
      SUPABASE_STAGING_PROJECT_REF: 'uhinvcydgzqlpnvieyal',
      SUPABASE_STAGING_PROJECT_VERIFIED: 'true',
      SUPABASE_STAGING_ALLOW_WRITES: 'true',
      LOCALLY_STAGING_FIXTURE_PASSWORD: 'not-a-real-password',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('known Production Supabase project');
  });

  test('models the exact Production current-state inventory and concierge boundary', () => {
    expect(currentManifest.objects.publicTables).toHaveLength(44);
    expect(currentManifest.objects.publicViews).toHaveLength(2);
    expect(currentManifest.objects.publicTableColumns).toBe(606);
    expect(currentManifest.objects.publicViewColumns).toBe(27);
    expect(currentManifest.objects.functionOverloads).toHaveLength(107);
    expect(currentManifest.objects.privateFunctionOverloads).toEqual([
  "private.admin_chat_phone_title(category text, form_data jsonb)",
  "private.adopt_phone_followup_link()",
  "private.advance_support_version()",
  "private.apply_community_media_locators(p_plan_digest text, p_assets jsonb, p_posts jsonb, p_rollback boolean)",
  "private.apply_host_profile_media_locators(p_owner_id uuid, p_asset_id uuid, p_old_url text, p_references jsonb, p_rollback boolean)",
  "private.assert_booking_payout_safe(p_booking bookings)",
  "private.bump_experience_media_revision()",
  "private.canonical_experience_media_locator(p_url text)",
  "private.capture_phone_followup()",
  "private.commit_community_post_images(p_actor_id uuid, p_post_id uuid, p_expected_revision bigint, p_expected_images text[], p_images text[])",
  "private.community_media_backup_contract()",
  "private.community_media_migration_inventory()",
  "private.delete_pending_phone_followup()",
  "private.guard_booking_money_transition()",
  "private.guard_community_asset_identity()",
  "private.guard_community_media_writer()",
  "private.guard_community_physical_delete()",
  "private.guard_community_reference_zero_journal()",
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
  "private.set_community_legacy_writer_freeze(p_frozen boolean, p_smoke_asset_id uuid, p_sha256 text)",
  "private.solo_refund_due(p_booking bookings)",
  "private.sync_community_media_assets()",
  "private.sync_experience_media_assets()",
  "private.sync_host_profile_assets()",
  "private.sync_profile_avatar_assets()"
]);
    expect(currentManifest.objects.applicationTriggers).toHaveLength(43);
    expect(currentManifest.objects.indexes).toBe(150);
    expect(currentManifest.objects.privateTables).toEqual(["admin_monitor_cutover", "community_media_authority", "community_media_context", "community_media_plan_receipts", "host_profile_auth_cas", "host_profile_operation_context", "host_profile_source_authority", "phone_followup_tasks"]);
    expect(currentManifest.objects.privateTableColumns).toBe(29);
    expect(currentManifest.objects.privateIndexes).toBe(10);
    expect(currentManifest.objects.privateConstraints).toBe(21);
    expect(currentManifest.objects.constraints).toEqual({
      "check": 101,
      "total": 225,
      "unique": 18,
      "foreignKey": 62,
      "primaryKey": 44
});
    expect(currentManifest.objects.rls.enabled).toHaveLength(42);
    expect(currentManifest.objects.rls.disabled).toEqual([
      'admin_job_runs',
      'admin_support_unread_alert_batches',
    ]);
    expect(currentManifest.objects.rls.forced).toEqual([]);
    expect(currentManifest.objects.rls.publicPolicies).toBe(106);
    expect(currentManifest.objects.storageObjectPolicies).toHaveLength(16);
    expect(currentManifest.securityFingerprints).toMatchObject({
      storageBuckets: '7419cabe695cd50a522314a749216c05',
      storagePolicies: '898e8b7f917fd0f4530ef30c9b61961e',
      publicRlsPolicies: 'e5a16a4215c569060fbf895453a5cd00',
      publicRelationGrants: '23a636eb7731f130f48aaeceb415c8cf',
      privateRelationGrants: '5c6eec1ba4930757fff2e15e64d79d30',
      stagingOverlayBaselineStoragePolicies: 'd6b381fd629405acfdd615593031de5c',
    });
    for (const fingerprint of [
      currentManifest.securityFingerprints.storageBuckets,
      currentManifest.securityFingerprints.storagePolicies,
      currentManifest.securityFingerprints.publicRlsPolicies,
      currentManifest.securityFingerprints.publicRelationGrants,
      currentManifest.securityFingerprints.privateRelationGrants,
    ]) {
      expect(currentContract).toContain(fingerprint);
    }
    expect(currentManifest.activeConcierge.tables).toEqual([
      'service_request_schedule_items',
      'service_assignment_history',
      'service_refund_operations',
    ]);
    expect(currentManifest.activeConcierge.functionOverloads).toHaveLength(8);
    expect(currentManifest.activeConcierge.directExecuteRoles).toEqual(['service_role']);
    expect(currentManifest.legacyCompatibility.disabledRoutes).toEqual([
      'app/api/services/applications/route.ts',
      'app/api/services/select-host/route.ts',
    ]);
    expect(currentManifest.legacyCompatibility.status).toBe(410);
  });

  test('keeps the superseded staging-only overlay as fail-closed historical evidence', () => {
    expect(currentStateOverlay).toContain("target_ref = 'uhinvcydgzqlpnvieyal'");
    expect(currentStateOverlay).toContain("current_setting('locally.staging_target_ref', true)");
    expect(currentStateOverlay.indexOf('$target_guard$')).toBeLessThan(
      currentStateOverlay.indexOf('DROP POLICY "Authenticated users can upload chat images"')
    );
    expect(currentStateOverlay).not.toContain('DROP POLICY IF EXISTS');
    expect(currentStateOverlay.match(/^DROP POLICY .*$/gm)).toEqual([
      'DROP POLICY "Authenticated users can upload chat images" ON storage.objects;',
    ]);
    expect(currentStateOverlay).toContain('Authenticated users can upload chat images');
    expect(currentStateOverlay).toContain('policy_count <> 16');
    expect(currentStateOverlay).toContain('d6b381fd629405acfdd615593031de5c');
    expect(currentStateOverlay).toContain('policy_count <> 15');
    expect(currentStateOverlay).toContain('38c973a52a0bebe8fa78b3f53089e427');
    expect(currentStateOverlay.match(/c3ff5767c8e4934ae05b3d96550441c8/g)).toHaveLength(2);
    expect(currentStateOverlay).toContain('IF NOT EXISTS (');
    expect(currentStateOverlay).toContain('LOCALLY_STAGING_CURRENT_STATE_OVERLAY_PASS');
  });

  test('does not require retired comment-like objects in the current state', () => {
    for (const staleName of [
      'community_comment_likes',
      'increment_comment_like_count',
      'decrement_comment_like_count',
      'on_comment_like_added',
      'on_comment_like_removed',
    ]) {
      expect(manifest.applicationTables).not.toContain(staleName);
      expect(manifest.applicationFunctions).not.toContain(staleName);
      expect(manifest.applicationTriggers).not.toContain(staleName);
    }
    expect(manifest.forbiddenCurrentObjects.storagePolicies).toEqual([
      'Anyone can update their own avatar',
      'Anyone can upload an avatar',
      'Authenticated Delete',
      'Authenticated Update',
      'Authenticated Upload',
      'Authenticated users can upload chat images',
      'Auth Users Upload',
      'Experience object owners can delete',
      'Experience object owners can update',
      'Owner Delete',
      'Owner Update',
      'Public Access',
    ]);
  });

  test('requires an exact verified staging ref and explicit write opt-in', () => {
    const result = fixtureGuard({
      SUPABASE_STAGING_URL: 'https://abcdefghijklmnopqrst.supabase.co',
      SUPABASE_STAGING_SERVICE_ROLE_KEY: 'not-a-real-key',
      SUPABASE_STAGING_PROJECT_REF: 'tsrqponmlkjihgfedcba',
      SUPABASE_STAGING_PROJECT_VERIFIED: 'true',
      SUPABASE_STAGING_ALLOW_WRITES: 'true',
      LOCALLY_STAGING_FIXTURE_PASSWORD: 'not-a-real-password',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('must exactly match');
  });

  test('uses only synthetic fixtures with state-scoped cleanup', () => {
    expect(fixtures).toContain('@example.com');
    expect(fixtures).toContain('Synthetic staging experience');
    expect(fixtures).toContain(".from('experiences')");
    expect(fixtures).toContain(".from('inquiries')");
    expect(fixtures).toContain(".from('notifications')");
    expect(fixtures).toContain(".from('bookings')");
    expect(fixtures).toContain("client.auth.admin.deleteUser(user.id)");
    expect(fixtures).not.toContain('.env.local');
    expect(fixtures).not.toContain('PAYPAL_CLIENT_SECRET');
    expect(fixtures).not.toContain('NICEPAY_MERCHANT_KEY');
    expect(fixtures).not.toContain('PORTONE_API_SECRET');
  });
});
