import { expect, test } from '@playwright/test';

import { getHostBookingMessageHref } from '@/app/utils/hostBookingMessageLink';
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

    const inquiryOfficialJa = buildNotificationCopy('inquiry.new_message', 'ja', {
      actorDisplayName: 'Locally Support',
      displayContent: '担当チームよりご案内します。',
    });
    expect(inquiryOfficialJa.title).toBe('💬 Locally Supportから新しいメッセージ');
    expect(inquiryOfficialJa.message).toBe('担当チームよりご案内します。');

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

  test('nudges hosts to message guests after booking confirmation', () => {
    const confirmedKo = buildNotificationCopy('booking.confirmed.host', 'ko', {
      experienceTitle: '도쿄 야경 투어',
      guestName: '민지',
    });
    expect(confirmedKo.title).toContain('바로 메시지');
    expect(confirmedKo.message).toContain('민지님이 기다리고 있어요');
    expect(confirmedKo.message).toContain('준비 안내');

    const bankConfirmedEn = buildNotificationCopy('booking.bank_confirmed.host', 'en', {
      experienceTitle: 'Seoul Night Walk',
      guestName: 'Sora',
    });
    expect(bankConfirmedEn.title).toContain('Message the guest now');
    expect(bankConfirmedEn.message).toContain('Send a quick hello');
    expect(bankConfirmedEn.message).not.toContain('게스트');
  });

  test('labels bank transfer bookings as received but not confirmed in every locale', () => {
    const copies = {
      ko: buildNotificationCopy('booking.bank_pending.guest', 'ko', {
        experienceTitle: '서울 야경 산책',
      }),
      en: buildNotificationCopy('booking.bank_pending.guest', 'en', {
        experienceTitle: 'Seoul Night Walk',
      }),
      ja: buildNotificationCopy('booking.bank_pending.guest', 'ja', {
        experienceTitle: '東京ナイトツアー',
      }),
      zh: buildNotificationCopy('booking.bank_pending.guest', 'zh', {
        experienceTitle: '首尔夜景散步',
      }),
    };

    expect(copies.ko.title).toContain('입금 확인 대기');
    expect(copies.ko.message).toContain('입금 확인 후 예약이 확정');
    expect(copies.en.title).toContain('confirmation pending');
    expect(copies.en.message).toContain('confirmed after payment is verified');
    expect(copies.ja.title).toContain('入金確認待ち');
    expect(copies.ja.message).toContain('入金確認後に予約が確定');
    expect(copies.zh.title).toContain('等待确认转账');
    expect(copies.zh.message).toContain('确认到账后');
  });

  test('builds host booking message deep links with a reservations fallback', () => {
    expect(getHostBookingMessageHref({ guestId: 'guest-1', experienceId: 42 })).toBe(
      '/host/dashboard?tab=inquiries&guestId=guest-1&expId=42'
    );
    expect(getHostBookingMessageHref({ guestId: '', experienceId: 42 })).toBe('/host/dashboard?tab=reservations');
    expect(getHostBookingMessageHref({ guestId: 'guest-1', experienceId: null })).toBe('/host/dashboard?tab=reservations');
  });

  test('builds host application and experience status copy with localized reason text', () => {
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

    const experienceApprovedKo = buildNotificationCopy('experience.approved', 'ko', {
      experienceTitle: '서울 야경 산책',
    });
    expect(experienceApprovedKo).toEqual({
      title: '🎉 체험 등록이 승인되었습니다',
      message: "'서울 야경 산책' 체험이 승인되었습니다. 이제 상세 내용과 운영 상태를 확인할 수 있습니다.",
    });

    const experienceRevisionEn = buildNotificationCopy('experience.revision', 'en', {
      experienceTitle: 'Seoul Night Walk',
      comment: 'Please add a clearer meeting point photo.',
    });
    expect(experienceRevisionEn.title).toBe('🛠️ Your experience listing needs revision');
    expect(experienceRevisionEn.message).toContain('Reason: Please add a clearer meeting point photo.');
  });
});
