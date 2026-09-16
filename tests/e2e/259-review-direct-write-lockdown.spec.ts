import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const migrationPath =
  'supabase/migrations/20260916134243_review_direct_write_lockdown.sql';
const migrationSource = readFileSync(migrationPath, 'utf8');

test.describe('Review direct-write lockdown migration contract', () => {
  test('removes exactly the three obsolete direct-write policies', () => {
    const droppedPolicies = [
      ...migrationSource.matchAll(
        /DROP POLICY "([^"]+)" ON public\.(reviews|guest_reviews);/g
      ),
    ].map((match) => `${match[2]}/${match[1]}`);

    expect(droppedPolicies).toEqual([
      'reviews/Users can insert their own reviews',
      'reviews/Hosts can update reviews for their experiences',
      'guest_reviews/Host can insert reviews',
    ]);
  });

  test('revokes only the approved direct Data API write privileges', () => {
    expect(migrationSource).toContain(
      'REVOKE INSERT, UPDATE ON TABLE public.reviews FROM anon, authenticated;'
    );
    expect(migrationSource).toContain(
      'REVOKE INSERT ON TABLE public.guest_reviews FROM anon, authenticated;'
    );
    expect(migrationSource.match(/^REVOKE\s+/gm)).toHaveLength(2);
    expect(migrationSource).not.toMatch(/^REVOKE[^;]*(SELECT|DELETE)/im);
  });

  test('fail-closes on unexpected preflight and postcondition state', () => {
    expect(migrationSource).toContain('DO $preflight$');
    expect(migrationSource).toContain('DO $postcondition$');

    for (const role of ['anon', 'authenticated']) {
      expect(migrationSource).toContain(
        `NOT has_table_privilege('${role}', 'public.reviews', 'INSERT')`
      );
      expect(migrationSource).toContain(
        `NOT has_table_privilege('${role}', 'public.reviews', 'UPDATE')`
      );
      expect(migrationSource).toContain(
        `NOT has_table_privilege('${role}', 'public.guest_reviews', 'INSERT')`
      );
      expect(migrationSource).toContain(
        `has_table_privilege('${role}', 'public.reviews', 'INSERT')`
      );
      expect(migrationSource).toContain(
        `has_table_privilege('${role}', 'public.reviews', 'UPDATE')`
      );
      expect(migrationSource).toContain(
        `has_table_privilege('${role}', 'public.guest_reviews', 'INSERT')`
      );
    }
  });

  test('preserves review reads, customer delete, and guest-review reads', () => {
    expect(migrationSource).toContain(
      "policyname = 'Reviews are viewable by everyone' AND cmd = 'SELECT'"
    );
    expect(migrationSource).toContain(
      "policyname = 'Users can delete their own reviews' AND cmd = 'DELETE'"
    );
    expect(migrationSource).toContain(
      "policyname = 'Users can view reviews' AND cmd = 'SELECT'"
    );
    expect(migrationSource).toContain(
      "NOT has_table_privilege('authenticated', 'public.reviews', 'SELECT')"
    );
    expect(migrationSource).toContain(
      "NOT has_table_privilege('authenticated', 'public.reviews', 'DELETE')"
    );
    expect(migrationSource).toContain(
      "NOT has_table_privilege('authenticated', 'public.guest_reviews', 'SELECT')"
    );
  });

  test('keeps every Foundation RPC service-role-only without redefining it', () => {
    for (const signature of [
      'create_experience_review_atomic(text,uuid,bigint,integer,text)',
      'create_guest_review_with_notification_atomic(text,uuid,integer,text,text,text)',
      'list_due_experience_review_request_candidates(integer)',
    ]) {
      expect(migrationSource).toContain(
        `has_function_privilege('anon', 'public.${signature}', 'EXECUTE')`
      );
      expect(migrationSource).toContain(
        `has_function_privilege('authenticated', 'public.${signature}', 'EXECUTE')`
      );
      expect(migrationSource).toContain(
        `NOT has_function_privilege('service_role', 'public.${signature}', 'EXECUTE')`
      );
    }

    expect(migrationSource).not.toMatch(/(?:GRANT|REVOKE)[^;]*\bFUNCTION\b/i);
    expect(migrationSource).not.toMatch(/(?:CREATE OR REPLACE|ALTER|DROP) FUNCTION/i);
  });

  test('contains no schema expansion or unrelated business-domain mutation', () => {
    expect(migrationSource.trimStart()).toMatch(/^--[\s\S]*\nBEGIN;/);
    expect(migrationSource.trimEnd()).toMatch(/COMMIT;$/);
    expect(migrationSource).not.toMatch(/CREATE\s+(?:TABLE|FUNCTION)/i);
    expect(migrationSource).not.toMatch(/ALTER\s+TABLE/i);
    expect(migrationSource).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\.(?:bookings|payments|payouts|settlements|refunds)\b/i
    );
  });
});
