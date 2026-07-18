import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const migrationPath = 'docs/migrations/v3_40_25_server_rpc_execute_lockdown.sql';
const migrationSource = readFileSync(migrationPath, 'utf8');

const expectedSignatures = [
  'public.claim_due_admin_support_unread_alert_batches(integer)',
  'public.complete_service_booking_if_due_atomic(text)',
  'public.confirm_service_bank_payment_atomic(text)',
  'public.create_service_request_with_booking_atomic(uuid,text,text,text,text,date,text,integer,text[],integer,text,text)',
  'public.get_experience_completion_due_backlog()',
  'public.lease_experience_translation_task(text,timestamp with time zone,integer,integer)',
  'public.lease_experience_translation_task(text,timestamp with time zone,integer)',
  'public.list_due_experience_completion_candidates(text)',
  'public.prune_notifications_retention(timestamp with time zone,integer)',
  'public.prune_team_workspace_comments(uuid,integer)',
  'public.prune_team_workspace_tasks(integer)',
  'public.record_translation_provider_outcome(text,integer,integer,boolean,integer)',
  'public.record_translation_provider_outcome(text,integer,integer,boolean)',
  'public.select_service_host_atomic(uuid,uuid,uuid)',
].sort();

const normalizeSql = (value: string) => value.replace(/\s+/g, ' ').trim();

function extractFunctionPrivilegeTargets(pattern: RegExp) {
  return [...migrationSource.matchAll(pattern)]
    .map((match) => normalizeSql(match[1]))
    .sort();
}

test.describe('Server RPC execute lockdown contract', () => {
  test('limits exactly the audited server RPC signatures', () => {
    const revokedTargets = extractFunctionPrivilegeTargets(
      /REVOKE EXECUTE ON FUNCTION\s+([^;]+?)\s+FROM PUBLIC,\s*anon,\s*authenticated;/gi
    );
    const grantedTargets = extractFunctionPrivilegeTargets(
      /GRANT EXECUTE ON FUNCTION\s+([^;]+?)\s+TO service_role;/gi
    );

    expect(revokedTargets).toEqual(expectedSignatures);
    expect(grantedTargets).toEqual(expectedSignatures);
    expect(new Set(revokedTargets).size).toBe(expectedSignatures.length);
    expect(new Set(grantedTargets).size).toBe(expectedSignatures.length);
  });

  test('hardens future postgres function defaults without touching Supabase internal defaults', () => {
    expect(migrationSource).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE postgres\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/i
    );
    expect(migrationSource).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;/i
    );
    expect(migrationSource).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+GRANT EXECUTE ON FUNCTIONS TO service_role;/i
    );
    expect(migrationSource).not.toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/i);
  });

  test('keeps the migration permission-only and excludes unrelated compatibility surfaces', () => {
    expect(migrationSource).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(migrationSource).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(migrationSource).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(migrationSource).not.toMatch(/\bCREATE\s+POLICY\b|\bDROP\s+POLICY\b/i);
    expect(migrationSource).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b|\bALTER\s+VIEW\b/i);

    for (const excludedFunction of [
      'create_service_booking_atomic',
      'is_admin_reader',
      'check_rate_limit',
      'handle_new_user',
      'mark_room_messages_read',
    ]) {
      expect(migrationSource).not.toMatch(new RegExp(`\\b${excludedFunction}\\b`, 'i'));
    }
  });

  test('keeps every active RPC entry point on the server service-role client', () => {
    const adminClientSource = readFileSync('app/utils/supabase/admin.ts', 'utf8');
    expect(adminClientSource).toContain("import 'server-only'");
    expect(adminClientSource).toContain('SUPABASE_SERVICE_ROLE_KEY');

    for (const entryPath of [
      'app/api/cron/notification-retention-cleanup/route.ts',
      'app/api/cron/experience-translations/route.ts',
      'app/api/cron/complete-trips/route.ts',
      'app/api/cron/complete-services/route.ts',
      'app/api/services/requests/route.ts',
      'app/api/services/select-host/route.ts',
      'app/api/admin/service-confirm-payment/route.ts',
      'app/api/admin/settlement-sync/route.ts',
      'app/api/admin/team/_shared.ts',
    ]) {
      expect(readFileSync(entryPath, 'utf8')).toContain('createAdminClient');
    }

    const translationRoute = readFileSync('app/api/cron/experience-translations/route.ts', 'utf8');
    expect(translationRoute).toContain('p_reserved_tokens: RESERVED_TOKENS[provider]');
    expect(translationRoute).toContain('p_reserved_token_count: reservedTokenCount ?? 0');
  });
});
