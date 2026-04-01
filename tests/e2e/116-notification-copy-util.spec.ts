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

    const serviceHostEn = buildNotificationCopy('service.request_new.host', 'en', {
      requestTitle: 'Airport pickup',
      requestCity: 'Seoul',
      durationHours: 3,
      guestCount: 2,
    });
    expect(serviceHostEn.title).toBe('📋 New custom service request — Seoul');
    expect(serviceHostEn.message).toBe('Airport pickup (3h, 2 guests)');

    const serviceApplicationZh = buildNotificationCopy('service.application_new.customer', 'zh', {
      requestTitle: '东京口译支持',
    });
    expect(serviceApplicationZh.title).toBe('📩 有新的房东申请');
    expect(serviceApplicationZh.message).toContain('东京口译支持');

    const serviceSelectedJa = buildNotificationCopy('service.host_selected', 'ja', {
      requestTitle: '東京通訳サポート',
    });
    expect(serviceSelectedJa.title).toBe('🎉 ゲストに選ばれました！');
    expect(serviceSelectedJa.message).toContain('東京通訳サポート');

    const serviceCancelRequestedJa = buildNotificationCopy('service.cancel_requested', 'ja', {
      requestTitle: '東京空港送迎',
    });
    expect(serviceCancelRequestedJa.title).toBe('キャンセル依頼を受け付けました。');
    expect(serviceCancelRequestedJa.message).toContain('運営チームが確認のうえ対応します。');

    const serviceCancelledEn = buildNotificationCopy('service.cancelled', 'en', {
      requestTitle: 'Airport pickup',
      refundAmount: 25000,
    });
    expect(serviceCancelledEn.title).toBe('The service was cancelled.');
    expect(serviceCancelledEn.message).toBe("The service 'Airport pickup' was cancelled. Refund amount: ₩25,000");

    const proxyConfirmedEn = buildNotificationCopy('proxy.payment_confirmed', 'en', {
      requestTitle: 'Sushi Omakase',
    });
    expect(proxyConfirmedEn.title).toBe('Phone booking payment was confirmed.');
    expect(proxyConfirmedEn.message).toContain('Sushi Omakase');

    const proxyRefundedJa = buildNotificationCopy('proxy.payment_refunded', 'ja', {
      requestTitle: '東京駅送迎',
    });
    expect(proxyRefundedJa.title).toBe('電話予約の決済が返金処理されました。');
    expect(proxyRefundedJa.message).toContain('東京駅送迎');

    const proxyReplyZh = buildNotificationCopy('proxy.comment_reply', 'zh', {
      content: '我们已经联系到店家了。',
    });
    expect(proxyReplyZh.title).toBe('你的电话预约请求有新回复。');
    expect(proxyReplyZh.message).toBe('我们已经联系到店家了。');
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
