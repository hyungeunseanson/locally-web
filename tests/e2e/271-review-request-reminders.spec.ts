import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { buildEmailCopy } from '@/app/utils/emailCopy';
import { buildNotificationCopy } from '@/app/utils/notificationCopy';
import { reconcileDueReviewRequestReminders } from '@/app/utils/reviews/reviewReminderReconciliation';
import { getReviewRequestNotificationHref } from '@/app/utils/reviews/reviewRequestDeepLinks';

const completionSource = readFileSync('app/utils/settlementSync/experienceCompletion.ts', 'utf8');
const scheduledSource = readFileSync('app/utils/experienceCompletionScheduled.ts', 'utf8');

type Reminder = {
  notification_id: number;
  booking_id: string;
  recipient_user_id: string;
  reminder_type: 'review_request_reminder' | 'guest_review_request_reminder';
  experience_title: string;
};

function fixture(reminders: Reminder[], options: { reviewed?: Set<string>; ownerMismatch?: boolean; sent?: boolean } = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const emails: Array<Record<string, unknown>> = [];
  const reviewed = options.reviewed ?? new Set<string>();
  const query = { eq: () => query, then: (resolve: (value: { error: null }) => void) => resolve({ error: null }) };
  const client = {
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { preferred_locale: 'en' } } }, error: null }) } },
    rpc: async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe('claim_due_review_request_reminders');
      expect(args).toEqual({ p_limit: 50 });
      return { data: reminders, error: null };
    },
    from(table: string) {
      if (table === 'notifications') return {
        update: (row: Record<string, unknown>) => { updates.push(row); return query; },
      };
      if (table === 'bookings') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
          user_id: options.ownerMismatch ? 'other-guest' : 'guest-1',
          status: 'completed', date: '2020-01-01', time: '09:00',
          experiences: { host_id: options.ownerMismatch ? 'other-host' : 'host-1', duration: 2 },
        }, error: null }) }) }),
      };
      if (table === 'reviews' || table === 'guest_reviews') return {
        select: () => ({ eq: (_key: string, bookingId: string) => ({ limit: async () => ({
          data: reviewed.has(`${table}:${bookingId}`) ? [{ id: 1 }] : [], error: null,
        }) }) }),
      };
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  const sendEmail = async (request: Record<string, unknown>) => {
    emails.push(request);
    return { sent: options.sent !== false, skipped: options.sent === false ? 'provider_not_configured' as const : undefined };
  };
  return { client, sendEmail, updates, emails };
}

const guestReminder: Reminder = {
  notification_id: 1, booking_id: 'booking-1', recipient_user_id: 'guest-1',
  reminder_type: 'review_request_reminder', experience_title: 'Experience',
};
const hostReminder: Reminder = {
  notification_id: 2, booking_id: 'booking-1', recipient_user_id: 'host-1',
  reminder_type: 'guest_review_request_reminder', experience_title: 'Experience',
};

test('scheduled completion runs bounded reminder reconciliation on both due and no-candidate paths', () => {
  expect(completionSource).toContain('processReviewReminderSideEffects(params.supabaseAdmin, reconcileReviewReminders)');
  expect((completionSource.match(/processReviewReminderSideEffects\(params\.supabaseAdmin, reconcileReviewReminders\)/g) ?? [])).toHaveLength(2);
  expect(scheduledSource).toContain('reconcileReviewReminders: (params) =>');
  expect(scheduledSource).toContain('sendImmediateGenericEmail(request, {');
});

test('guest and host reminders use distinct localized copy and matching source links', async () => {
  const { client, sendEmail, updates, emails } = fixture([guestReminder, hostReminder]);
  const result = await reconcileDueReviewRequestReminders({ supabaseAdmin: client as never, sendEmail: sendEmail as never });
  expect(result).toEqual({ claimedCount: 2, emailSentCount: 2, emailFailedCount: 0, skippedCount: 0 });
  expect(updates.map((row) => row.link)).toEqual([
    '/guest/trips?reviewBookingId=booking-1&reviewSource=notification',
    '/host/dashboard?tab=reservations&reservationTab=completed&reviewBookingId=booking-1&reviewSource=notification',
  ]);
  expect(emails.map((row) => (row.templatedEmail as { payload: { ctaUrl: string } }).payload.ctaUrl)).toEqual([
    '/guest/trips?reviewBookingId=booking-1&reviewSource=email',
    '/host/dashboard?tab=reservations&reservationTab=completed&reviewBookingId=booking-1&reviewSource=email',
  ]);
  expect(buildNotificationCopy('review.request_reminder.guest', 'en', { experienceTitle: 'Experience' }).title).toContain('reminder');
  expect(buildEmailCopy('review.guest_request_reminder.host', 'en', { experienceTitle: 'Experience' }).subject).toContain('reminder');
  expect(getReviewRequestNotificationHref({ type: 'review_request_reminder', booking_id: 'booking-1', link: '/fallback' }))
    .toBe(updates[0].link);
  expect(getReviewRequestNotificationHref({ type: 'guest_review_request_reminder', booking_id: 'booking-1', link: '/fallback' }))
    .toBe(updates[1].link);
});

test('a submitted review suppresses only its own role email after the claim', async () => {
  const { client, sendEmail, emails } = fixture([guestReminder, hostReminder], {
    reviewed: new Set(['reviews:booking-1']),
  });
  const result = await reconcileDueReviewRequestReminders({ supabaseAdmin: client as never, sendEmail: sendEmail as never });
  expect(result).toEqual({ claimedCount: 2, emailSentCount: 1, emailFailedCount: 0, skippedCount: 1 });
  expect(emails).toHaveLength(1);
  expect(emails[0].recipientUserId).toBe('host-1');
});

test('recipient ownership mismatch and empty claim fail closed', async () => {
  const wrong = fixture([guestReminder, hostReminder], { ownerMismatch: true });
  const result = await reconcileDueReviewRequestReminders({ supabaseAdmin: wrong.client as never, sendEmail: wrong.sendEmail as never });
  expect(result.skippedCount).toBe(2);
  expect(wrong.emails).toHaveLength(0);
  const empty = fixture([]);
  expect((await reconcileDueReviewRequestReminders({ supabaseAdmin: empty.client as never, sendEmail: empty.sendEmail as never })).claimedCount).toBe(0);
});

test('sent:false is a safe failure and does not remove the notification', async () => {
  const { client, sendEmail, updates } = fixture([guestReminder], { sent: false });
  const result = await reconcileDueReviewRequestReminders({ supabaseAdmin: client as never, sendEmail: sendEmail as never });
  expect(result).toEqual({ claimedCount: 1, emailSentCount: 0, emailFailedCount: 1, skippedCount: 0 });
  expect(updates).toHaveLength(1);
});
