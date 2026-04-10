import { expect, test } from '@playwright/test';

import {
  resolveLocalizedSingleRecipientCopy,
} from '@/app/api/notifications/email/route';
import { buildNoticeCopyTemplateProps } from '@/app/emails/registry/emailContentBuilders';

test.describe('Shared notification email CTA localization', () => {
  test('localizes review reply CTA label through the typed notice template', () => {
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

    const rendered = buildNoticeCopyTemplateProps({
      audience: 'guest',
      locale: 'en',
      payload: {
        copyKey: 'review.reply.guest',
        copyParams: {
          replyPreview: 'Thanks for joining.',
        },
        ctaUrl: '/guest/trips',
      },
    });

    expect(rendered.ctaLabel).toBe('Check review');
    expect(rendered.bodyText).toContain('Thanks for joining.');
    expect(rendered.ctaUrl).toContain('/guest/trips');
  });

  test('localizes cancellation approved CTA label and keeps the Korean fallback explicit', () => {
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

    const rendered = buildNoticeCopyTemplateProps({
      audience: 'guest',
      locale: 'ja',
      payload: {
        copyKey: 'booking.cancellation_approved.guest',
        copyParams: {
          experienceTitle: '東京ナイトツアー',
        },
        ctaUrl: '/guest/trips',
      },
    });

    expect(rendered.ctaLabel).toBe('旅行を確認');
    expect(rendered.bodyText).toContain('東京ナイトツアー');

    const fallbackLabel =
      resolveLocalizedSingleRecipientCopy({
        locale: 'ko',
        type: 'general',
      })?.ctaLabel || '확인하기';

    expect(fallbackLabel).toBe('확인하기');
  });
});
