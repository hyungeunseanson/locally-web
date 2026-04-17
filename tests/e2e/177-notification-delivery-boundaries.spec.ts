import { expect, test } from '@playwright/test';

import {
  normalizeRecipientIds,
  resolveLocalizedSingleRecipientCopy,
  resolveLocalizedSingleRecipientTemplatePayload,
  summarizeMassEmailResults,
} from '@/app/api/notifications/email/route';
import { normalizeAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { sendNotification } from '@/app/utils/notification';

test.describe('Notification delivery boundary helpers', () => {
  test('normalizes recipient ids for mass sends by trimming, deduping, and dropping blanks', () => {
    expect(normalizeRecipientIds([
      ' user-a ',
      '',
      'user-b',
      'user-a',
      '   ',
      null,
      7,
    ])).toEqual(['user-a', 'user-b']);
  });

  test('summarizes sent, skipped, and failed email attempts distinctly', () => {
    const summary = summarizeMassEmailResults([
      {
        status: 'fulfilled',
        value: {
          success: true,
          sent: true,
          provider: 'gmail',
          subject: 'sent',
          preheader: '',
          html: '',
          text: '',
        },
      },
      {
        status: 'fulfilled',
        value: {
          success: true,
          sent: false,
          provider: 'none',
          skipped: 'recipient_missing',
          subject: 'skipped',
          preheader: '',
          html: '',
          text: '',
        },
      },
      {
        status: 'rejected',
        reason: new Error('provider down'),
      },
    ]);

    expect(summary).toEqual({
      sentCount: 1,
      skippedCount: 1,
      failedCount: 1,
    });
  });

  test('throws parsed API errors instead of silently swallowing failed notification requests', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify({
      error: 'Forbidden: Admin Access Required for mass email',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    try {
      await expect(sendNotification({
        recipient_ids: ['user-a'],
        type: 'admin_alert',
        title: 'Boundary Test',
        message: 'Should surface route error',
        link: '/notifications',
      })).rejects.toThrow('Forbidden: Admin Access Required for mass email');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('returns delivery summary payloads for successful mass notification requests', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify({
      success: true,
      count: 2,
      notifications: 2,
      emailsSent: 1,
      emailsSkipped: 1,
      emailFailures: 0,
      mode: 'partial_email',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    try {
      await expect(sendNotification({
        recipient_ids: ['user-a', 'user-b'],
        type: 'admin_alert',
        title: 'Boundary Test',
        message: 'Should return route summary',
        link: '/notifications',
      })).resolves.toEqual({
        success: true,
        count: 2,
        notifications: 2,
        emailsSent: 1,
        emailsSkipped: 1,
        emailFailures: 0,
        mode: 'partial_email',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('keeps admin alert email normalization aligned with recipient resolution', () => {
    expect(normalizeAdminAlertEmails([
      'ADMIN@example.com ',
      ' admin@example.com',
      '',
      null,
      'ops@example.com',
    ])).toEqual(['admin@example.com', 'ops@example.com']);
  });

  test('keeps localized single-recipient notification copy and template payload in sync for shared notice flows', () => {
    const reviewCopy = resolveLocalizedSingleRecipientCopy({
      locale: 'en',
      type: 'review_reply',
      copyKey: 'review_reply',
      copyParams: {
        replyPreview: 'Thanks for the thoughtful feedback!',
      },
    });
    const reviewTemplate = resolveLocalizedSingleRecipientTemplatePayload({
      type: 'review_reply',
      copyKey: 'review_reply',
      copyParams: {
        replyPreview: 'Thanks for the thoughtful feedback!',
      },
      ctaUrl: '/guest/trips',
    });

    expect(reviewCopy?.title).toBe('The host replied to your review');
    expect(reviewTemplate).toEqual({
      copyKey: 'review.reply.guest',
      copyParams: {
        replyPreview: 'Thanks for the thoughtful feedback!',
      },
      ctaUrl: '/guest/trips',
    });

    const cancellationCopy = resolveLocalizedSingleRecipientCopy({
      locale: 'ko',
      type: 'cancellation_approved',
      copyKey: 'cancellation_approved',
      copyParams: {
        experienceTitle: '제주 야시장 워크',
      },
    });
    const cancellationTemplate = resolveLocalizedSingleRecipientTemplatePayload({
      type: 'cancellation_approved',
      copyKey: 'cancellation_approved',
      copyParams: {
        experienceTitle: '제주 야시장 워크',
      },
      ctaUrl: '/guest/trips',
    });

    expect(cancellationCopy?.title).toBe('취소 및 환불이 승인되었습니다');
    expect(cancellationTemplate).toEqual({
      copyKey: 'booking.cancellation_approved.guest',
      copyParams: {
        experienceTitle: '제주 야시장 워크',
      },
      ctaUrl: '/guest/trips',
    });
  });
});
