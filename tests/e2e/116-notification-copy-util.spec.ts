import { expect, test } from '@playwright/test';

import {
  buildNotificationCopy,
} from '@/app/utils/notificationCopy';
import {
  normalizeNotificationLocale,
} from '@/app/utils/notificationLocale';

test.describe('Notification localization helpers', () => {
  test('normalizes preferred locale conservatively', () => {
    expect(normalizeNotificationLocale('ja-JP')).toBe('ja');
    expect(normalizeNotificationLocale('EN')).toBe('en');
    expect(normalizeNotificationLocale('zh-CN')).toBe('zh');
    expect(normalizeNotificationLocale('fr')).toBeNull();
    expect(normalizeNotificationLocale(null)).toBeNull();
  });

  test('keeps Korean booking cancellation copy identical to the current baseline', () => {
    const copy = buildNotificationCopy('booking.cancelled', 'ko', {
      experienceTitle: '도쿄 야경 투어',
      refundAmount: 15000,
      recipient: 'guest',
    });

    expect(copy).toEqual({
      title: '예약이 취소되었습니다.',
      message: `'도쿄 야경 투어' 예약이 취소되었습니다. 환불 금액: ₩15,000`,
    });
  });

  test('builds localized inquiry and membership copy', () => {
    const inquiryJa = buildNotificationCopy('inquiry.new_message', 'ja', {
      actorDisplayName: 'Sora',
      displayContent: '集合場所を教えてください。',
    });
    expect(inquiryJa.title).toBe('💬 Soraさんから新しいメッセージ');
    expect(inquiryJa.message).toBe('集合場所を教えてください。');

    const membershipEn = buildNotificationCopy('membership.member_welcome', 'en', {
      status: 'member',
    });
    expect(membershipEn.title).toBe('✨ Tier 1 is now open');
    expect(membershipEn.message).toContain('first purchase');

    const reviewJa = buildNotificationCopy('review.new.host', 'ja', {
      experienceTitle: '東京ナイトツアー',
    });
    expect(reviewJa.title).toBe('新しいレビューが登録されました');
    expect(reviewJa.message).toBe('「東京ナイトツアー」に新しいレビューが投稿されました。');
  });

  test('builds host application revision copy with localized reason text', () => {
    const revisionEn = buildNotificationCopy('host_application.revision', 'en', {
      comment: 'Please upload a clearer ID card photo.',
    });
    expect(revisionEn.title).toBe('🛠️ Your host application needs revision');
    expect(revisionEn.message).toContain('Reason: Please upload a clearer ID card photo.');

    const rejectedJa = buildNotificationCopy('host_application.rejected', 'ja', {
      comment: '本人確認書類が一致しませんでした。',
    });
    expect(rejectedJa.title).toBe('📌 ホスト申請結果をご確認ください');
    expect(rejectedJa.message).toContain('理由: 本人確認書類が一致しませんでした。');
  });
});
