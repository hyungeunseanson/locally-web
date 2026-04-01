import { expect, test } from '@playwright/test';

import {
  buildNotificationEmailHtml,
  resolveLocalizedSingleRecipientCopy,
} from '@/app/api/notifications/email/route';

test.describe('Shared notification email CTA localization', () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://locally.test';
  });

  test('localizes review reply CTA label and preserves localized email html', () => {
    const localizedCopy = resolveLocalizedSingleRecipientCopy({
      locale: 'en',
      type: 'review_reply',
      copyKey: 'review_reply',
      copyParams: {
        replyPreview: 'Thanks for joining.',
      },
    });

    expect(localizedCopy?.title).toBe('The host replied to your review');
    expect(localizedCopy?.ctaLabel).toBe('Check review');

    const html = buildNotificationEmailHtml(
      localizedCopy?.message || '',
      '/guest/trips',
      localizedCopy?.ctaLabel
    );

    expect(html).toContain('Check review');
    expect(html).not.toContain('확인하기');
  });

  test('localizes cancellation approved CTA label and keeps default fallback Korean', () => {
    const localizedCopy = resolveLocalizedSingleRecipientCopy({
      locale: 'ja',
      type: 'cancellation_approved',
      copyKey: 'cancellation_approved',
      copyParams: {
        experienceTitle: '東京ナイトツアー',
      },
    });

    expect(localizedCopy?.title).toBe('キャンセルと返金が承認されました');
    expect(localizedCopy?.ctaLabel).toBe('旅行を確認');

    const localizedHtml = buildNotificationEmailHtml(
      localizedCopy?.message || '',
      '/guest/trips',
      localizedCopy?.ctaLabel
    );

    expect(localizedHtml).toContain('旅行を確認');
    expect(localizedHtml).not.toContain('확인하기');

    const fallbackHtml = buildNotificationEmailHtml('기본 메시지', '/guest/trips');
    expect(fallbackHtml).toContain('확인하기');
  });
});
