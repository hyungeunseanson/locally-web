import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const migrationPath = 'docs/migrations/v3_40_26_create_service_booking_atomic_execute_lockdown.sql';
const migrationSource = readFileSync(migrationPath, 'utf8');
const baselineSource = readFileSync('supabase_service_matching_migration.sql', 'utf8');
const targetSignature = 'public.create_service_booking_atomic(uuid,uuid,uuid,text,text)';

const normalizeSql = (value: string) => value.replace(/\s+/g, '').toLowerCase();

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test.describe('Legacy service-booking RPC execute lockdown contract', () => {
  test('limits exactly the audited overload to service_role', () => {
    const normalizedMigration = normalizeSql(migrationSource);

    expect(normalizedMigration).toContain(
      normalizeSql(`GRANT EXECUTE ON FUNCTION ${targetSignature} TO service_role;`)
    );
    expect(normalizedMigration).toContain(
      normalizeSql(`REVOKE EXECUTE ON FUNCTION ${targetSignature} FROM PUBLIC, anon, authenticated;`)
    );
    expect(migrationSource.match(/\bGRANT\s+EXECUTE\s+ON\s+FUNCTION\b/gi)).toHaveLength(1);
    expect(migrationSource.match(/\bREVOKE\s+EXECUTE\s+ON\s+FUNCTION\b/gi)).toHaveLength(1);
  });

  test('keeps the migration transactional and permission-only', () => {
    expect(migrationSource).toMatch(/^\s*--[^\n]*\n(?:--[^\n]*\n)*\s*BEGIN;/i);
    expect(migrationSource).toMatch(/COMMIT;\s*$/i);
    expect(migrationSource).toContain(`to_regprocedure(target_signature)::oid`);
    expect(migrationSource).toContain(`target_owner IS DISTINCT FROM 'postgres'`);
    expect(migrationSource).toContain(`target_security_definer IS DISTINCT FROM true`);
    expect(migrationSource).toContain(`has_function_privilege('service_role', target_oid, 'EXECUTE')`);

    expect(migrationSource).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(migrationSource).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(migrationSource).not.toMatch(/\bALTER\s+(?:TABLE|FUNCTION|VIEW|DEFAULT\s+PRIVILEGES)\b/i);
    expect(migrationSource).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
    expect(migrationSource).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  });

  test('keeps fresh installations on the same server-only policy', () => {
    const normalizedBaseline = normalizeSql(baselineSource);

    expect(normalizedBaseline).toContain(
      normalizeSql(`GRANT EXECUTE ON FUNCTION ${targetSignature} TO service_role;`)
    );
    expect(normalizedBaseline).toContain(
      normalizeSql(`REVOKE EXECUTE ON FUNCTION ${targetSignature} FROM PUBLIC, anon, authenticated;`)
    );
    expect(normalizedBaseline).not.toContain(
      normalizeSql(`GRANT EXECUTE ON FUNCTION ${targetSignature} TO authenticated;`)
    );
  });

  test('keeps the only repository caller behind the server service-role client', () => {
    const legacyRoutePath = 'app/api/services/bookings/route.ts';
    const legacyRouteSource = readFileSync(legacyRoutePath, 'utf8');
    const adminClientSource = readFileSync('app/utils/supabase/admin.ts', 'utf8');

    expect(legacyRouteSource).toContain('createAdminClient');
    expect(legacyRouteSource).toContain(".rpc('create_service_booking_atomic'");
    expect(adminClientSource).toContain("import 'server-only'");
    expect(adminClientSource).toContain('SUPABASE_SERVICE_ROLE_KEY');

    for (const sourcePath of listSourceFiles('app')) {
      if (sourcePath === legacyRoutePath) continue;
      const source = readFileSync(sourcePath, 'utf8');
      expect(source, `${sourcePath} must not call the legacy RPC`).not.toContain(
        'create_service_booking_atomic'
      );
      expect(source, `${sourcePath} must not call the legacy route`).not.toContain(
        '/api/services/bookings'
      );
    }
  });

  test('keeps the current service-request flow on its replacement atomic RPC', () => {
    const requestPageSource = readFileSync('app/services/request/page.tsx', 'utf8');
    const requestRouteSource = readFileSync('app/api/services/requests/route.ts', 'utf8');

    expect(requestPageSource).toContain("fetch('/api/services/requests'");
    expect(requestRouteSource).toContain("const rpcName = 'create_service_request_with_booking_atomic'");
    expect(requestRouteSource).toContain('createAdminClient');
    expect(requestRouteSource).not.toContain('create_service_booking_atomic');
  });
});
