import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { buildEmailCopy } from '@/app/utils/emailCopy';
import { buildNotificationCopy } from '@/app/utils/notificationCopy';
import type { NotificationLocale } from '@/app/utils/notificationLocale';

const migrationSource = readFileSync(
  'docs/migrations/v3_40_30_create_guest_review_with_notification_atomic.sql',
  'utf8'
);
const routeSource = readFileSync(
  'app/api/host/guest-reviews/route.ts',
  'utf8'
);

test.describe('Guest review received notification atomic contract', () => {
  test('keeps the guest review and keyed notification in one locked service-role RPC', () => {
    const reviewInsertIndex = migrationSource.indexOf(
      'INSERT INTO public.guest_reviews'
    );
    const notificationInsertIndex = migrationSource.indexOf(
      'INSERT INTO public.notifications'
    );

    expect(migrationSource).toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*ON\s+public\.notifications\s*\(\s*booking_id\s*\)[\s\S]*WHERE\s+type\s*=\s*'guest_review_received'[\s\S]*booking_id\s+IS\s+NOT\s+NULL/i
    );
    expect(migrationSource).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_guest_review_with_notification_atomic/i
    );
    expect(migrationSource).toMatch(
      /FROM\s+public\.bookings[\s\S]*FOR\s+UPDATE/i
    );
    expect(reviewInsertIndex).toBeGreaterThanOrEqual(0);
    expect(notificationInsertIndex).toBeGreaterThan(reviewInsertIndex);
    expect(migrationSource).toContain("'created'");
    expect(migrationSource).toContain("'duplicate'");
    expect(migrationSource).toContain("'not_found'");
    expect(migrationSource).toContain("'forbidden'");
    expect(migrationSource).toContain("'invalid_status'");
    expect(migrationSource).toContain("'invalid_payload'");
    expect(migrationSource).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_guest_review_with_notification_atomic[\s\S]*TO\s+service_role/i
    );
    expect(migrationSource).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_guest_review_with_notification_atomic[\s\S]*FROM\s+anon,\s*authenticated/i
    );
  });

  test('keeps route prechecks while moving the final write to the atomic RPC', () => {
    expect(routeSource).toContain("'create_guest_review_with_notification_atomic'");
    expect(routeSource).toContain(".eq('host_id', user.id)");
    expect(routeSource).toContain("booking.status !== 'completed'");
    expect(routeSource).toContain('Number.isInteger(rating)');
    expect(routeSource).not.toMatch(
      /\.from\('guest_reviews'\)[\s\S]{0,160}\.insert\(/i
    );
  });

  test('provides localized in-app and email copy for both review events', () => {
    const locales: NotificationLocale[] = ['ko', 'en', 'ja', 'zh'];

    for (const locale of locales) {
      const hostNotification = buildNotificationCopy(
        'review.guest_request.host',
        locale,
        { experienceTitle: 'Local Food Walk' }
      );
      const guestNotification = buildNotificationCopy(
        'review.guest_received.guest',
        locale,
        { experienceTitle: 'Local Food Walk' }
      );
      const hostEmail = buildEmailCopy(
        'review.guest_request.host',
        locale,
        { experienceTitle: 'Local Food Walk' }
      );
      const guestEmail = buildEmailCopy(
        'review.guest_received.guest',
        locale,
        { experienceTitle: 'Local Food Walk' }
      );

      expect(hostNotification.title).toBeTruthy();
      expect(hostNotification.message).toContain('Local Food Walk');
      expect(guestNotification.title).toBeTruthy();
      expect(guestNotification.message).toContain('Local Food Walk');
      expect(hostEmail.subject).toBeTruthy();
      expect(hostEmail.message).toContain('Local Food Walk');
      expect(hostEmail.ctaLabel).toBeTruthy();
      expect(guestEmail.subject).toBeTruthy();
      expect(guestEmail.message).toContain('Local Food Walk');
      expect(guestEmail.ctaLabel).toBeTruthy();
    }
  });
});
