import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const migrationPath = 'docs/migrations/v3_40_36_users_authorization_boundary.sql';
const migrationSource = readFileSync(migrationPath, 'utf8');
const normalizedMigration = migrationSource.replace(/\s+/g, ' ').trim();

const adminAccessSource = readFileSync('app/utils/adminAccess.ts', 'utf8');
const authContextSource = readFileSync('app/context/AuthContext.tsx', 'utf8');
const adminActionSource = readFileSync('app/actions/admin.ts', 'utf8');

function findUsersConsumerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findUsersConsumerFiles(path);
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) return [];

    const source = readFileSync(path, 'utf8');
    return /\.from\(['"]users['"]\)/.test(source) ? [path] : [];
  });
}

test.describe('users authorization boundary migration', () => {
  test('atomically replaces the audited public policies with authenticated self-read', () => {
    expect(normalizedMigration.startsWith('-- v3.40.36')).toBe(true);
    expect(normalizedMigration).toMatch(/\bBEGIN;/i);
    expect(normalizedMigration.endsWith('COMMIT;')).toBe(true);

    for (const policy of [
      'Public profiles are viewable by everyone',
      'Users can insert their own profile',
      'Admins can update user roles',
      'Users can update own profile',
    ]) {
      expect(normalizedMigration).toContain(
        `DROP POLICY IF EXISTS "${policy}" ON public.users;`
      );
    }

    expect(normalizedMigration).toContain(
      'CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);'
    );
    expect(normalizedMigration).not.toMatch(
      /CREATE POLICY [^;]+ ON public\.users FOR (?:INSERT|UPDATE|DELETE)/i
    );
  });

  test('removes anonymous and direct client writes while preserving authenticated self-read', () => {
    expect(normalizedMigration).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon, authenticated;'
    );
    expect(normalizedMigration).toContain(
      'GRANT SELECT ON TABLE public.users TO authenticated;'
    );
    expect(normalizedMigration).not.toMatch(/GRANT [^;]+ ON TABLE public\.users TO anon/i);
    expect(normalizedMigration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE|TRUNCATE|TRIGGER|REFERENCES)[^;]* ON TABLE public\.users TO authenticated/i
    );
  });

  test('fails closed on drift and verifies the final policy and grant catalog', () => {
    expect(normalizedMigration).toContain('Unexpected public.users drift.');
    expect(normalizedMigration).toContain(
      'Known legacy public.users policies have unexpected definitions'
    );
    expect(normalizedMigration).toContain(
      'Known target public.users policy has an unexpected definition'
    );
    expect(normalizedMigration).toContain('Unexpected final public.users policies');
    expect(normalizedMigration).toContain('anon retains unexpected public.users privileges');
    expect(normalizedMigration).toContain(
      'authenticated has unexpected public.users privileges'
    );
    expect(normalizedMigration).toContain(
      'service_role public.users privileges changed unexpectedly'
    );
  });

  test('preserves the service-role admin and host authorization dependencies', () => {
    expect(normalizedMigration).toContain("to_regprocedure('public.is_admin_reader()')");
    expect(normalizedMigration).toContain("pg_get_userbyid(procedure.proowner) = 'postgres'");
    expect(normalizedMigration).toContain(
      "has_table_privilege('service_role', 'public.users', 'SELECT')"
    );
    expect(normalizedMigration).toContain(
      "has_table_privilege('service_role', 'public.users', 'INSERT')"
    );
    expect(normalizedMigration).toContain(
      "has_table_privilege('service_role', 'public.users', 'UPDATE')"
    );

    expect(adminAccessSource).toContain("supabase.from('users').select('role').eq('id', userId)");
    expect(adminAccessSource).toContain("supabase.from('admin_whitelist')");
    expect(authContextSource).toContain(".from('host_applications')");
    expect(authContextSource).toContain(".select('status')");
    expect(authContextSource).not.toMatch(/\.from\(['"]users['"]\)/);

    expect(adminActionSource).toContain('const supabaseAdmin = createAdminClient();');
    expect(adminActionSource).toMatch(
      /supabaseAdmin\s*\.from\('users'\)\s*\.upsert\(userRolePayload/
    );
  });

  test('keeps the application consumer surface explicit and server-oriented', () => {
    expect(findUsersConsumerFiles('app').sort()).toEqual([
      join('app', 'actions', 'admin.ts'),
      join('app', 'api', 'admin', 'users-summary', 'route.ts'),
      join('app', 'utils', 'adminAccess.ts'),
      join('app', 'utils', 'adminAlertCenter.ts'),
    ]);
  });

  test('does not change data, schema, profiles, or completed inquiry boundaries', () => {
    expect(normalizedMigration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(normalizedMigration).not.toMatch(/\bUPDATE\s+public\./i);
    expect(normalizedMigration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(normalizedMigration).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(normalizedMigration).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(normalizedMigration).not.toMatch(/public\.(?:profiles|inquiries|inquiry_messages)\b/i);
  });
});
