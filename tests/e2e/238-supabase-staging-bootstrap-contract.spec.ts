import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('supabase/staging/required-objects.json', 'utf8'));
const schemaContract = readFileSync('supabase/staging/schema-contract.sql', 'utf8');
const inventory = readFileSync('supabase/staging/schema-only-inventory.sql', 'utf8');
const fixtures = readFileSync('scripts/supabase/staging-fixtures.mjs', 'utf8');

function fixtureGuard(env: Record<string, string>) {
  return spawnSync(process.execPath, ['scripts/supabase/staging-fixtures.mjs', 'seed'], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test.describe('Supabase staging bootstrap contract', () => {
  test('records the missing base schema instead of claiming migrations are replayable', () => {
    expect(manifest.repoBaselineMissing).toEqual(expect.arrayContaining([
      'profiles',
      'users',
      'experiences',
      'bookings',
      'inquiries',
      'inquiry_messages',
      'notifications',
    ]));
    expect(packageJson.scripts['supabase:staging:contract']).toBeTruthy();
  });

  test('keeps the schema inventory and assertion transactions read-only', () => {
    expect(schemaContract).toContain('BEGIN READ ONLY;');
    expect(schemaContract).toContain('ROLLBACK;');
    expect(schemaContract).toContain('LOCALLY_STAGING_SCHEMA_CONTRACT_PASS');
    expect(inventory).toContain('BEGIN READ ONLY;');
    expect(inventory).toContain('pg_get_functiondef');
    expect(inventory).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\s+/i);
  });

  test('captures every metadata class required for a schema-only baseline', () => {
    for (const requiredFragment of [
      "'owner', pg_get_userbyid(relation.relowner)",
      "'rls_enabled', relation.relrowsecurity",
      "'rls_forced', relation.relforcerowsecurity",
      "'security_invoker'",
      "'sequences'",
      "'owned_by'",
      "'function_execute_grants'",
      "'sequence_grants'",
      "acldefault('s', sequence.relowner)",
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
    expect(inventory).toContain("to_jsonb(bucket) - 'owner' - 'owner_id'");
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
