import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const migrationPath = 'docs/migrations/v3_40_35_inquiry_rls_authorization_boundary.sql';
const migrationSource = readFileSync(migrationPath, 'utf8');
const normalizedMigration = migrationSource.replace(/\s+/g, ' ').trim();

const inquirySharedSource = readFileSync('app/api/inquiries/thread/shared.ts', 'utf8');
const guestHostChatSource = readFileSync('app/hooks/useChat.ts', 'utf8');
const adminChatSource = readFileSync('app/admin/dashboard/hooks/useAdminChatQuery.ts', 'utf8');

function findDirectMessageInsertFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findDirectMessageInsertFiles(path);
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) return [];

    const source = readFileSync(path, 'utf8');
    return /\.from\(['"]inquiry_messages['"]\)\s*\.insert\(/.test(source) ? [path] : [];
  });
}

function expectPolicyDrop(table: 'inquiries' | 'inquiry_messages', policy: string) {
  expect(normalizedMigration).toContain(
    `DROP POLICY IF EXISTS "${policy}" ON public.${table};`
  );
}

test.describe('Inquiry RLS authorization boundary migration', () => {
  test('atomically replaces every audited broad SELECT policy', () => {
    expect(normalizedMigration.startsWith('-- v3.40.35')).toBe(true);
    expect(normalizedMigration).toMatch(/\bBEGIN;/i);
    expect(normalizedMigration.endsWith('COMMIT;')).toBe(true);

    expectPolicyDrop('inquiries', 'Users can view all inquiries');
    expectPolicyDrop('inquiries', 'View own inquiries');
    expectPolicyDrop('inquiry_messages', 'Users can view all messages');
    expectPolicyDrop('inquiry_messages', 'Users can view own inquiry messages');
    expectPolicyDrop('inquiry_messages', 'View messages');

    expect(normalizedMigration).toContain(
      'CREATE POLICY inquiries_select_participant ON public.inquiries FOR SELECT TO authenticated USING ( auth.uid() = user_id OR auth.uid() = host_id );'
    );
    expect(normalizedMigration).toContain(
      'CREATE POLICY inquiries_select_admin ON public.inquiries FOR SELECT TO authenticated USING (public.is_admin_reader());'
    );
    expect(normalizedMigration).toContain(
      'CREATE POLICY inquiry_messages_select_admin ON public.inquiry_messages FOR SELECT TO authenticated USING (public.is_admin_reader());'
    );

    expect(normalizedMigration).toMatch(
      /CREATE POLICY inquiry_messages_select_participant ON public\.inquiry_messages FOR SELECT TO authenticated USING \( EXISTS \( SELECT 1 FROM public\.inquiries AS inquiry WHERE inquiry\.id = inquiry_messages\.inquiry_id AND \( inquiry\.user_id = auth\.uid\(\) OR inquiry\.host_id = auth\.uid\(\) \) \) \);/
    );
  });

  test('removes both direct message INSERT paths and the client grant', () => {
    expectPolicyDrop('inquiry_messages', 'Send messages');
    expectPolicyDrop('inquiry_messages', 'Users can insert inquiry messages');
    expect(normalizedMigration).toContain(
      'REVOKE INSERT ON TABLE public.inquiry_messages FROM anon, authenticated;'
    );
    expect(normalizedMigration).not.toMatch(
      /CREATE POLICY [^;]+ ON public\.inquiry_messages FOR INSERT/i
    );
    expect(normalizedMigration).toContain(
      "has_table_privilege('service_role', 'public.inquiry_messages', 'INSERT')"
    );
  });

  test('fails closed on policy drift and verifies the final catalog state', () => {
    expect(normalizedMigration).toContain('Unexpected inquiry policy drift.');
    expect(normalizedMigration).toContain('Known legacy policy names exist with unexpected definitions');
    expect(normalizedMigration).toContain('Known target policy names exist with unexpected definitions or grants');
    expect(normalizedMigration).toContain('A direct inquiry_messages INSERT policy remains');
    expect(normalizedMigration).toContain('A broad authenticated/admin-type SELECT condition remains');
    expect(normalizedMigration).toContain('Participant-only SELECT policy contract is incomplete');
    expect(normalizedMigration).toContain('Admin SELECT policy contract is incomplete');
    expect(normalizedMigration).toContain('Direct client inquiry_messages INSERT privilege remains');
  });

  test('leaves intentionally preserved policies, functions, schema, and data untouched', () => {
    expect(normalizedMigration).not.toContain(
      'DROP POLICY IF EXISTS "Create inquiries" ON public.inquiries;'
    );
    expect(normalizedMigration).not.toContain(
      'DROP POLICY IF EXISTS "Users can update own inquiries" ON public.inquiries;'
    );
    expect(normalizedMigration).not.toContain(
      'DROP POLICY IF EXISTS "Users can update messages in their inquiries" ON public.inquiry_messages;'
    );

    expect(normalizedMigration).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(normalizedMigration).not.toMatch(/\bALTER\s+FUNCTION\b/i);
    expect(normalizedMigration).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(normalizedMigration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(normalizedMigration).not.toMatch(/\bUPDATE\s+public\./i);
    expect(normalizedMigration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(normalizedMigration).not.toMatch(/public\.(?:profiles|users)\b/i);
    expect(normalizedMigration).toContain("to_regprocedure('public.is_admin_reader()')");
    expect(normalizedMigration).not.toContain("to_regprocedure('public.check_rate_limit(");
  });
});

test.describe('Inquiry application boundary contract', () => {
  test('keeps all message writes behind the participant-checking server service', () => {
    expect(findDirectMessageInsertFiles('app')).toEqual([
      join('app', 'api', 'inquiries', 'thread', 'shared.ts'),
    ]);
    expect(guestHostChatSource).toContain("fetch('/api/inquiries/message'");
    expect(adminChatSource).toContain("fetch('/api/inquiries/message'");
    expect(guestHostChatSource).not.toMatch(
      /\.from\(['"]inquiry_messages['"]\)[\s\S]{0,240}?\.insert\(/
    );
    expect(adminChatSource).not.toMatch(
      /\.from\(['"]inquiry_messages['"]\)[\s\S]{0,240}?\.insert\(/
    );

    expect(inquirySharedSource).toContain('async function resolveInquiryMessageAccess');
    expect(inquirySharedSource).toContain('const supabaseAdmin = createAdminClient();');
    expect(inquirySharedSource).toContain('const isParticipant =');
    expect(inquirySharedSource).toContain('await assertAdminActor(actor);');
    expect(inquirySharedSource.match(/\.from\('inquiry_messages'\)\s*\.insert\(/g)).toHaveLength(2);
    expect(inquirySharedSource).toMatch(
      /resolveInquiryMessageAccess\([\s\S]+?\.from\('inquiry_messages'\)[\s\S]+?\.insert\(/
    );
  });

  test('retains participant and admin Realtime subscriptions for RLS filtering', () => {
    for (const source of [guestHostChatSource, adminChatSource]) {
      expect(source).toContain("{ event: 'INSERT', schema: 'public', table: 'inquiry_messages' }");
      expect(source).toContain("{ event: 'UPDATE', schema: 'public', table: 'inquiry_messages' }");
    }

    expect(guestHostChatSource).toContain("fetch('/api/inquiries/read'");
    expect(adminChatSource).toContain("fetch('/api/admin/inquiries'");
    expect(adminChatSource).toContain('/api/admin/inquiries/${inquiryId}/messages');
  });
});
