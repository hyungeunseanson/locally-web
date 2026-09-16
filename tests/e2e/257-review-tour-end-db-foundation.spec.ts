import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const migrationPath = 'supabase/migrations/20260916111416_review_tour_end_db_foundation.sql';
const migrationSource = readFileSync(migrationPath, 'utf8');

function functionBody(name: string, nextName?: string) {
  const start = migrationSource.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  const end = nextName
    ? migrationSource.indexOf(`CREATE OR REPLACE FUNCTION public.${nextName}`, start)
    : migrationSource.indexOf('DO $postcondition$', start);
  return migrationSource.slice(start, end);
}

const completionFunction = functionBody(
  'complete_experience_booking_if_due_atomic',
  'create_guest_review_with_notification_atomic'
);
const hostReviewFunction = functionBody(
  'create_guest_review_with_notification_atomic',
  'create_experience_review_atomic'
);
const customerReviewFunction = functionBody(
  'create_experience_review_atomic',
  'list_due_experience_review_request_candidates'
);
const candidateFunction = functionBody('list_due_experience_review_request_candidates');

test.describe('Review tour-end DB foundation contract', () => {
  test('keeps start-time completion semantics while gating review requests on strict tour end', () => {
    expect(completionFunction).toContain("COALESCE(NULLIF(v_booking.time, ''), '00:00')");
    expect(completionFunction).toContain('v_due_at >= now()');
    expect(completionFunction).toContain('v_review_requests_due := v_tour_end_at <= now()');
    expect(completionFunction).toContain("trim(COALESCE(v_booking.time, '')) ~");
    expect(completionFunction).toContain(
      'CASE WHEN v_experience_duration > 0 THEN v_experience_duration ELSE 2 END'
    );
    expect(completionFunction).toMatch(
      /v_review_requests_due[\s\S]*'review_request'[\s\S]*v_review_requests_due[\s\S]*'guest_review_request'/
    );
  });

  test('suppresses each request independently when its review already exists', () => {
    expect(completionFunction).toMatch(
      /NOT EXISTS \([\s\S]*FROM public\.reviews AS r[\s\S]*r\.booking_id = v_booking\.id[\s\S]*'review_request'/
    );
    expect(completionFunction).toMatch(
      /NOT EXISTS \([\s\S]*FROM public\.guest_reviews AS gr[\s\S]*gr\.booking_id = v_booking\.id[\s\S]*'guest_review_request'/
    );
  });

  test('keeps the deployed host-review API outcome vocabulary backward compatible', () => {
    expect(hostReviewFunction).toContain('v_tour_end_at > now()');
    expect(hostReviewFunction).toMatch(
      /v_tour_end_at > now\(\)[\s\S]*RETURN QUERY SELECT 'invalid_status'/
    );
    expect(hostReviewFunction).not.toContain("SELECT 'not_eligible'");
    expect(hostReviewFunction).toContain('FOR UPDATE');
    expect(hostReviewFunction).toContain("'guest_review_received'");
  });

  test('adds the locked atomic customer-review RPC with both aggregate updates', () => {
    expect(customerReviewFunction).toContain('SECURITY DEFINER');
    expect(customerReviewFunction).toContain("SET search_path TO 'public'");
    expect(customerReviewFunction).toMatch(/FROM public\.bookings AS b[\s\S]*FOR UPDATE/);
    expect(customerReviewFunction).toMatch(/FROM public\.experiences AS e[\s\S]*FOR UPDATE/);
    expect(customerReviewFunction).toMatch(/FROM public\.profiles AS p[\s\S]*FOR UPDATE/);
    expect(customerReviewFunction).toContain('ON CONFLICT (booking_id) DO NOTHING');
    expect(customerReviewFunction).toContain('ROUND(AVG(r.rating)::NUMERIC, 2)');
    expect(customerReviewFunction).toContain('SET rating = COALESCE(v_experience_average, 0)');
    expect(customerReviewFunction).toContain('SET average_rating = CASE');
  });

  test('selects only due post-cutoff independent request candidates in stable batches', () => {
    expect(candidateFunction).toContain("TIMESTAMPTZ '2026-09-16 00:00:00+09'");
    expect(candidateFunction).toContain('customer_request_needed');
    expect(candidateFunction).toContain('host_request_needed');
    expect(candidateFunction).toContain('NOT EXISTS (SELECT 1 FROM public.reviews');
    expect(candidateFunction).toContain('NOT EXISTS (SELECT 1 FROM public.guest_reviews');
    expect(candidateFunction).toContain('WHERE needs.customer_request_needed OR needs.host_request_needed');
    expect(candidateFunction).toContain('ORDER BY needs.tour_end_at ASC, needs.booking_id ASC');
    expect(candidateFunction).toContain('LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50)');
  });

  test('exposes every privileged RPC only to service_role', () => {
    for (const signature of [
      'complete_experience_booking_if_due_atomic(text)',
      'create_guest_review_with_notification_atomic(text, uuid, integer, text, text, text)',
      'create_experience_review_atomic(text, uuid, bigint, integer, text)',
      'list_due_experience_review_request_candidates(integer)',
    ]) {
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      );
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`
      );
    }
  });

  test('preserves all existing direct-write RLS policies and grants for the app cutover', () => {
    expect(migrationSource).not.toMatch(/DROP POLICY/i);
    expect(migrationSource).not.toMatch(/REVOKE INSERT, UPDATE ON TABLE public\.reviews/i);
    expect(migrationSource).not.toMatch(/REVOKE INSERT ON TABLE public\.guest_reviews/i);
    expect(migrationSource).toContain("policyname = 'Users can insert their own reviews'");
    expect(migrationSource).toContain("policyname = 'Hosts can update reviews for their experiences'");
    expect(migrationSource).toContain("policyname = 'Host can insert reviews'");
    expect(migrationSource).toContain(
      "NOT has_table_privilege('authenticated', 'public.reviews', 'INSERT')"
    );
    expect(migrationSource).toContain(
      "NOT has_table_privilege('authenticated', 'public.reviews', 'UPDATE')"
    );
    expect(migrationSource).toContain(
      "NOT has_table_privilege('authenticated', 'public.guest_reviews', 'INSERT')"
    );
  });

  test('contains only the approved four RPC definitions and no schema expansion', () => {
    expect([...migrationSource.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)/g)]
      .map((match) => match[1])).toEqual([
      'complete_experience_booking_if_due_atomic',
      'create_guest_review_with_notification_atomic',
      'create_experience_review_atomic',
      'list_due_experience_review_request_candidates',
    ]);
    expect(migrationSource).not.toMatch(/CREATE TABLE|ALTER TABLE[\s\S]*ADD COLUMN/i);
  });
});
