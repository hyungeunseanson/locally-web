import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import {
  getBookingReviewEligibleAt,
  isBookingReviewEligible,
} from '@/app/utils/reviews/reviewEligibility';
import { reconcileDueExperienceReviewRequests } from '@/app/utils/reviews/reviewRequestReconciliation';

const completionSource = readFileSync('app/utils/settlementSync/experienceCompletion.ts', 'utf8');
const guestTripsSource = readFileSync('app/api/guest/trips/route.ts', 'utf8');
const customerReviewSource = readFileSync('app/api/reviews/route.ts', 'utf8');
const hostReviewSource = readFileSync('app/api/host/guest-reviews/route.ts', 'utf8');

function findAppFiles(pattern: RegExp, directory = 'app'): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findAppFiles(pattern, path);
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) return [];
    return pattern.test(readFileSync(path, 'utf8')) ? [path] : [];
  });
}

test.describe('Review tour-end app cutover contract', () => {
  test('enforces scheduled end, duration fallback, and strict fail-closed timestamps', () => {
    const threeHourTour = { date: '2026-09-20', time: '14:00', duration: 3 };
    expect(isBookingReviewEligible(threeHourTour, new Date('2026-09-20T13:59:00+09:00'))).toBe(false);
    expect(isBookingReviewEligible(threeHourTour, new Date('2026-09-20T14:00:00+09:00'))).toBe(false);
    expect(isBookingReviewEligible(threeHourTour, new Date('2026-09-20T16:59:59+09:00'))).toBe(false);
    expect(isBookingReviewEligible(threeHourTour, new Date('2026-09-20T17:00:00+09:00'))).toBe(true);

    for (const duration of [null, 0, -1, 'invalid']) {
      const booking = { date: '2026-09-20', time: '14:00', duration };
      expect(isBookingReviewEligible(booking, new Date('2026-09-20T15:59:59+09:00'))).toBe(false);
      expect(isBookingReviewEligible(booking, new Date('2026-09-20T16:00:00+09:00'))).toBe(true);
    }

    for (const time of [null, '', '25:00', '14:99', 'not-a-time']) {
      const booking = { date: '2026-09-20', time, duration: 3 };
      expect(getBookingReviewEligibleAt(booking)).toBeNull();
      expect(isBookingReviewEligible(booking, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    }

    for (const date of [null, '', '2026-02-30', 'not-a-date']) {
      expect(getBookingReviewEligibleAt({ date, time: '14:00', duration: 3 })).toBeNull();
    }

    expect(isBookingReviewEligible(
      { date: '2026-09-20', time: '14:00:30', duration: 3 },
      new Date('2026-09-20T17:00:30+09:00')
    )).toBe(true);
  });

  test('uses the shared eligibility helper in guest and host application paths', () => {
    const helper = readFileSync('app/utils/reviews/reviewEligibility.ts', 'utf8');
    const guestCard = readFileSync('app/guest/trips/components/PastTripCard.tsx', 'utf8');
    const hostManager = readFileSync('app/host/dashboard/components/ReservationManager.tsx', 'utf8');
    const hostCard = readFileSync('app/host/dashboard/components/ReservationCard.tsx', 'utf8');

    expect(helper).toContain('REVIEW_DURATION_FALLBACK_HOURS = 2');
    expect(helper).toContain('STRICT_BOOKING_TIME_PATTERN');
    expect(helper).toContain('isValidBookingDate');
    expect(guestTripsSource).toContain('reviewEligible: isBookingReviewEligible');
    expect(guestCard).toContain('trip.reviewEligible');
    expect(customerReviewSource).toContain('isBookingReviewEligible');
    expect(hostReviewSource).toContain('isBookingReviewEligible');
    expect(hostManager).toContain('if (!res.reviewEligible)');
    expect(hostCard).toContain('const showReviewButton = hasReview || reviewWindowOpen');
  });

  test('routes customer creation through the Foundation atomic RPC and keeps post-effects fail-soft', () => {
    expect(customerReviewSource).toContain("'create_experience_review_atomic'");
    expect(customerReviewSource).not.toMatch(/\.from\(['"]reviews['"]\)[\s\S]{0,160}?\.insert\(/);
    expect(customerReviewSource).toContain("outcome === 'duplicate'");
    expect(customerReviewSource).toContain("outcome === 'not_eligible'");
    expect(customerReviewSource).toContain("outcome === 'invalid_payload'");
    expect(customerReviewSource).toMatch(/try \{[\s\S]*buildLocalizedNotificationInsert[\s\S]*catch \(notificationError\)/);
    expect(customerReviewSource).toMatch(/try \{[\s\S]*sendImmediateGenericEmail[\s\S]*catch \(emailError\)/);
    expect(customerReviewSource).toMatch(/try \{[\s\S]*insertAdminAlerts[\s\S]*catch \(adminAlertError\)/);
  });

  test('uses the existing host atomic RPC and its Foundation invalid_status outcome', () => {
    expect(hostReviewSource).toContain("'create_guest_review_with_notification_atomic'");
    expect(hostReviewSource).toContain("outcome === 'invalid_status'");
    expect(hostReviewSource).not.toContain("outcome === 'not_eligible'");
    expect(hostReviewSource).not.toMatch(/\.from\(['"]guest_reviews['"]\)[\s\S]{0,160}?\.insert\(/);
  });

  test('keeps every legitimate review write behind audited server routes', () => {
    expect(findAppFiles(/\.from\(['"]reviews['"]\)[\s\S]{0,160}?\.insert\(/)).toEqual([]);
    expect(findAppFiles(/\.from\(['"]guest_reviews['"]\)[\s\S]{0,160}?\.insert\(/)).toEqual([]);
    expect(findAppFiles(/\.from\(['"]reviews['"]\)[\s\S]{0,160}?\.update\(/).sort()).toEqual([
      join('app', 'api', 'host', 'reviews', 'reply', 'route.ts'),
      join('app', 'api', 'reviews', '[id]', 'route.ts'),
    ].sort());
  });

  test('runs bounded review reconciliation even with no new completion candidates', () => {
    expect(completionSource).toContain('reconcileDueExperienceReviewRequests');
    const noCandidatesBranch = completionSource.slice(
      completionSource.indexOf('if (dueCandidates.length === 0)'),
      completionSource.indexOf('await delayWithHeartbeat')
    );
    expect(noCandidatesBranch).toContain('processReviewRequestReconciliationSideEffects');
    expect(noCandidatesBranch.indexOf('processReviewRequestReconciliationSideEffects'))
      .toBeLessThan(noCandidatesBranch.indexOf("outcome: 'no_candidates'"));
  });

  test('creates customer and host requests independently and emails only new host targets', async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const fakeClient = {
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: { user_metadata: { preferred_locale: 'ko' } } }, error: null }),
        },
      },
      rpc: async (name: string, params: Record<string, unknown>) => {
        rpcCalls.push({ name, params });
        return {
          data: [
            {
              booking_id: 'both-needed', user_id: 'guest-1', host_id: 'host-1',
              experience_title: 'Both', customer_request_needed: true, host_request_needed: true,
            },
            {
              booking_id: 'host-only', user_id: 'guest-2', host_id: 'host-2',
              experience_title: 'Host only', customer_request_needed: false, host_request_needed: true,
            },
          ],
          error: null,
        };
      },
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          insertedRows.push(row);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: insertedRows.length }, error: null }),
            }),
          };
        },
      }),
    };

    const result = await reconcileDueExperienceReviewRequests({
      supabaseAdmin: fakeClient as never,
    });

    expect(insertedRows.map((row) => [row.booking_id, row.type])).toEqual([
      ['both-needed', 'review_request'],
      ['both-needed', 'guest_review_request'],
      ['host-only', 'guest_review_request'],
    ]);
    expect(insertedRows.map((row) => row.link)).toEqual([
      '/guest/trips?reviewBookingId=both-needed',
      '/host/dashboard?tab=reservations&reservationTab=completed&reviewBookingId=both-needed',
      '/host/dashboard?tab=reservations&reservationTab=completed&reviewBookingId=host-only',
    ]);
    expect(rpcCalls).toEqual([{
      name: 'list_due_experience_review_request_candidates',
      params: { p_limit: 50 },
    }]);
    expect(result).toMatchObject({
      candidateCount: 2,
      customerCreatedCount: 1,
      hostCreatedCount: 2,
      failedCount: 0,
      customerNotificationBookingIds: ['both-needed'],
      hostNotificationBookingIds: ['both-needed', 'host-only'],
    });
  });

  test('treats notification unique conflicts as an idempotent no-op', async () => {
    const fakeClient = {
      auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
      rpc: async () => ({
        data: [{
          booking_id: 'already-requested', user_id: 'guest-1', host_id: null,
          experience_title: 'Already requested', customer_request_needed: true,
          host_request_needed: false,
        }],
        error: null,
      }),
      from: () => ({
        insert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: { code: '23505' } }),
          }),
        }),
      }),
    };

    await expect(reconcileDueExperienceReviewRequests({
      supabaseAdmin: fakeClient as never,
    })).resolves.toMatchObject({
      customerCreatedCount: 0,
      hostCreatedCount: 0,
      failedCount: 0,
      customerNotificationBookingIds: [],
      hostNotificationBookingIds: [],
    });
  });
});
