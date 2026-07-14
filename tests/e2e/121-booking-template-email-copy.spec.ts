import { expect, test } from '@playwright/test';
import {
  buildBookingCancellationTemplateEmailCopy,
  buildBookingConfirmationTemplateEmailCopy,
} from '@/app/utils/bookingTemplateEmailCopy';

test.describe('Booking template email localization helpers', () => {
  test('builds localized booking template copy with locale-specific fallbacks', () => {
    const confirmationJa = buildBookingConfirmationTemplateEmailCopy('ja', {
      experienceTitle: '東京ナイトツアー',
    });
    expect(confirmationJa.subject).toBe('[Locally] 🎉 予約確定。ゲストにメッセージを送ってください');
    expect(confirmationJa.previewText).toContain('東京ナイトツアー');
    expect(confirmationJa.guestCountLabel).toBe('参加人数');
    expect(confirmationJa.guestCountSuffix).toBe('名');
    expect(confirmationJa.totalAmountLabel).toBe('体験予約金額');
    expect(confirmationJa.layout.helpPrompt).toBe('ご不明な点はありますか？');

    const cancellationEn = buildBookingCancellationTemplateEmailCopy('en', {});
    expect(cancellationEn.subject).toBe('[Locally] Booking cancellation notice');
    expect(cancellationEn.previewText).toBe('Booking cancelled - Locally experience');
    expect(cancellationEn.fallbackCancelReason).toBe('No reason provided');
    expect(cancellationEn.layout.helpLinkLabel).toBe('Visit the help center ->');
  });

  test('keeps localized booking template labels free of Korean leakage', () => {
    const confirmationJaCopy = buildBookingConfirmationTemplateEmailCopy('ja', {
      experienceTitle: '東京ナイトツアー',
    });
    expect(confirmationJaCopy.greetingPrefix).toBe('こんにちは、');
    expect(confirmationJaCopy.guestNameLabel).toBe('ゲスト名');
    expect(confirmationJaCopy.guestCountLabel).toBe('参加人数');
    expect(confirmationJaCopy.totalAmountLabel).toBe('体験予約金額');
    expect(confirmationJaCopy.layout.helpPrompt).toBe('ご不明な点はありますか？');
    expect(confirmationJaCopy.guestNameLabel).not.toContain('게스트');

    const cancellationEnCopy = buildBookingCancellationTemplateEmailCopy('en', {
      experienceTitle: 'Seoul Night Walk',
    });
    expect(cancellationEnCopy.greetingPrefix).toBe('Hi, ');
    expect(cancellationEnCopy.cancelReasonLabel).toBe('Cancellation reason');
    expect(cancellationEnCopy.refundAmountLabel).toBe('Guest refund');
    expect(cancellationEnCopy.layout.helpPrompt).toBe('Need anything else?');
    expect(cancellationEnCopy.cancelReasonLabel).not.toContain('취소');
  });

  test('uses host-facing booking amount labels in every supported locale', () => {
    expect(buildBookingConfirmationTemplateEmailCopy('ko', {}).totalAmountLabel)
      .toBe('체험 예약 금액');
    expect(buildBookingConfirmationTemplateEmailCopy('en', {}).totalAmountLabel)
      .toBe('Experience booking amount');
    expect(buildBookingConfirmationTemplateEmailCopy('ja', {}).totalAmountLabel)
      .toBe('体験予約金額');
    expect(buildBookingConfirmationTemplateEmailCopy('zh', {}).totalAmountLabel)
      .toBe('体验预订金额');
  });
});
