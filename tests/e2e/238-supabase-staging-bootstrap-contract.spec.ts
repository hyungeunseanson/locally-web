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
    expect(currentManifest.objects.publicTables).toHaveLength(39);
    expect(baselineManifest.historicalSql.applyAfterBaseline).toEqual([]);
    expect(currentManifest.migrationLedger.map(({ version }: { version: string }) => version)).toEqual([
      '20260912034545',
      '20260912050655',
    ]);
    expect(manifest.freshProjectApplyOrder).toEqual([
      'supabase/migrations/20260912034545_production_schema_baseline.sql',
      'supabase/migrations/20260912050655_service_concierge_assignment.sql',
      'supabase/staging/post-baseline-current-state-overlay.sql',
    ]);
    expect(packageJson.scripts['supabase:staging:baseline:check']).toBeTruthy();
    expect(packageJson.scripts['supabase:staging:current:check']).toBeTruthy();
    expect(packageJson.scripts['supabase:staging:contract']).toBeTruthy();
  });

  test('keeps the schema inventory and assertion transactions read-only', () => {
    expect(schemaContract).toContain('BEGIN READ ONLY;');
    expect(schemaContract).toContain('ROLLBACK;');
    expect(schemaContract).toContain('LOCALLY_STAGING_SCHEMA_CONTRACT_PASS');
    expect(baselineContract).toContain('BEGIN READ ONLY;');
    expect(baselineContract).toContain('ROLLBACK;');
    expect(baselineContract).toContain('LOCALLY_PRODUCTION_BASELINE_CATALOG_PASS');
    expect(currentContract).toContain('BEGIN READ ONLY;');
    expect(currentContract).toContain('ROLLBACK;');
    expect(currentContract).toContain('LOCALLY_PRODUCTION_CURRENT_STATE_CONTRACT_PASS');
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
      "pg_get_function_identity_arguments",
      "'realtime_publication'",
      "'realtime_tables'",
      "'replica_identity'",
      "'storage_buckets'",
      "schemaname IN ('public', 'storage')",
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

  test('reproduces the exact seven-table Production Realtime publication', () => {
    expect(manifest.realtimePublicationTables).toEqual([
      'admin_audit_logs',
      'admin_task_comments',
      'admin_tasks',
      'admin_whitelist',
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
    expect(currentManifest.objects.publicTables).toHaveLength(39);
    expect(currentManifest.objects.publicViews).toHaveLength(2);
    expect(currentManifest.objects.publicTableColumns).toBe(510);
    expect(currentManifest.objects.publicViewColumns).toBe(27);
    expect(currentManifest.objects.functionOverloads).toHaveLength(44);
    expect(currentManifest.objects.applicationTriggers).toHaveLength(11);
    expect(currentManifest.objects.indexes).toBe(113);
    expect(currentManifest.objects.constraints).toEqual({
      total: 179,
      primaryKey: 39,
      foreignKey: 59,
      unique: 14,
      check: 67,
    });
    expect(currentManifest.objects.rls.enabled).toHaveLength(37);
    expect(currentManifest.objects.rls.disabled).toEqual([
      'admin_job_runs',
      'admin_support_unread_alert_batches',
    ]);
    expect(currentManifest.objects.rls.forced).toEqual([]);
    expect(currentManifest.objects.rls.publicPolicies).toBe(111);
    expect(currentManifest.objects.storageObjectPolicies).toHaveLength(15);
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

  test('keeps the staging-only current-state overlay outside migrations and fail-closed', () => {
    expect(currentStateOverlay).toContain("target_ref = 'uhinvcydgzqlpnvieyal'");
    expect(currentStateOverlay).toContain("current_setting('locally.staging_target_ref', true)");
    expect(currentStateOverlay.indexOf('$target_guard$')).toBeLessThan(
      currentStateOverlay.indexOf('DROP POLICY IF EXISTS')
    );
    expect(currentStateOverlay.match(/DROP POLICY IF EXISTS/g)).toHaveLength(1);
    expect(currentStateOverlay).toContain('Authenticated users can upload chat images');
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
      'Authenticated users can upload chat images',
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
