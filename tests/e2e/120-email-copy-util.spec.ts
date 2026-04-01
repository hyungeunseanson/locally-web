import { expect, test } from '@playwright/test';

import { buildEmailCopy } from '@/app/utils/emailCopy';

test.describe('Email localization helpers', () => {
  test('keeps Korean review and membership email copy on the current baseline', () => {
    const reviewKo = buildEmailCopy('review.new.host', 'ko', {
      experienceTitle: '도쿄 야경 투어',
    });

    expect(reviewKo).toEqual({
      subject: '[Locally] 새 후기가 등록되었습니다',
      title: '새 후기가 등록되었습니다',
      message: "'도쿄 야경 투어'에 새 후기가 작성되었습니다.",
      ctaLabel: '후기 확인하기',
    });

    const memberKo = buildEmailCopy('membership.member_welcome', 'ko', {
      status: 'member',
    });

    expect(memberKo).toEqual({
      subject: '[Locally] Tier 1이 열렸습니다',
      title: '이제 Tier 1입니다',
      message:
        '첫 구매가 완료되며 로컬리와의 연결이 시작됐어요. 로컬리 안에서 여행 기록이 쌓이고, 필요할 때 Locally Care로 이어갈 수 있습니다.',
      ctaLabel: '내 티어 보기',
    });
  });

  test('builds localized review, membership, and host application email copy', () => {
    const reviewJa = buildEmailCopy('review.new.host', 'ja', {
      experienceTitle: '東京ナイトツアー',
    });
    expect(reviewJa.subject).toBe('[Locally] 新しいレビューが投稿されました');
    expect(reviewJa.message).toBe('「東京ナイトツアー」に新しいレビューが投稿されました。');
    expect(reviewJa.ctaLabel).toBe('レビューを見る');

    const circleEn = buildEmailCopy('membership.circle_welcome', 'en', {
      status: 'circle',
    });
    expect(circleEn.subject).toBe('[Locally] Welcome to Tier 2');
    expect(circleEn.title).toBe('You are now Tier 2');
    expect(circleEn.message).toContain('Tier 2 guest');
    expect(circleEn.ctaLabel).toBe('View my tier');

    const approvedZh = buildEmailCopy('host_application.approved', 'zh', {});
    expect(approvedZh.subject).toBe('[Locally] 🎉 你的房东申请已通过');
    expect(approvedZh.message).toContain('房东后台');
    expect(approvedZh.ctaLabel).toBe('打开房东后台');

    const revisionEn = buildEmailCopy('host_application.revision', 'en', {
      comment: 'Please upload a clearer ID card photo.',
    });
    expect(revisionEn.subject).toBe('[Locally] 🛠️ Your host application needs revision');
    expect(revisionEn.message).toContain('Reason: Please upload a clearer ID card photo.');

    const rejectedJa = buildEmailCopy('host_application.rejected', 'ja', {
      comment: '本人確認書類が一致しませんでした。',
    });
    expect(rejectedJa.subject).toBe('[Locally] 📌 ホスト申請結果をご確認ください');
    expect(rejectedJa.message).toContain('理由: 本人確認書類が一致しませんでした。');

    const serviceHostEn = buildEmailCopy('service.request_new.host', 'en', {
      requestTitle: 'Airport pickup',
      requestCity: 'Seoul',
      durationHours: 3,
      guestCount: 2,
    });
    expect(serviceHostEn.subject).toBe('[Locally] A new custom service request has arrived');
    expect(serviceHostEn.message).toContain('Airport pickup');
    expect(serviceHostEn.ctaLabel).toBe('View request');

    const serviceCustomerJa = buildEmailCopy('service.payment_confirmed.customer', 'ja', {
      requestTitle: '東京通訳サポート',
    });
    expect(serviceCustomerJa.subject).toBe('[Locally] サービスの決済が完了しました');
    expect(serviceCustomerJa.message).toContain('現地ホストの募集');

    const serviceApplicationZh = buildEmailCopy('service.application_new.customer', 'zh', {
      requestTitle: '东京空港接送',
    });
    expect(serviceApplicationZh.subject).toBe('[Locally] 有新的房东申请');
    expect(serviceApplicationZh.ctaLabel).toBe('查看申请人');

    const serviceSelectedJa = buildEmailCopy('service.host_selected', 'ja', {
      requestTitle: '東京通訳サポート',
    });
    expect(serviceSelectedJa.subject).toBe('[Locally] ゲストに選ばれました');
    expect(serviceSelectedJa.message).toContain('進行の準備');

    const serviceCancelRequestedEn = buildEmailCopy('service.cancel_requested', 'en', {
      requestTitle: 'Airport pickup',
    });
    expect(serviceCancelRequestedEn.subject).toBe('[Locally] Your service cancellation request was received');
    expect(serviceCancelRequestedEn.message).toContain('admin team will review it shortly');

    const serviceCancelledKo = buildEmailCopy('service.cancelled', 'ko', {
      requestTitle: '도쿄 공항 픽업',
      refundAmount: 25000,
    });
    expect(serviceCancelledKo.subject).toBe('[Locally] 서비스 취소 안내');
    expect(serviceCancelledKo.message).toContain('환불 금액: ₩25,000');

    const proxyConfirmedEn = buildEmailCopy('proxy.payment_confirmed', 'en', {
      requestTitle: 'Sushi Omakase',
    });
    expect(proxyConfirmedEn.subject).toBe('[Locally] Your phone booking payment was confirmed');
    expect(proxyConfirmedEn.message).toContain('Sushi Omakase');

    const proxyRefundedJa = buildEmailCopy('proxy.payment_refunded', 'ja', {
      requestTitle: '東京駅送迎',
    });
    expect(proxyRefundedJa.subject).toBe('[Locally] 電話予約の決済が返金処理されました');
    expect(proxyRefundedJa.message).toContain('担当者スレッド');

    const proxyReplyZh = buildEmailCopy('proxy.comment_reply', 'zh', {
      content: '我们已经联系到店家了。',
    });
    expect(proxyReplyZh.subject).toBe('[Locally] 你的电话预约请求有新回复');
    expect(proxyReplyZh.message).toContain('我们已经联系到店家了。');
    expect(proxyReplyZh.ctaLabel).toBe('查看回复');
  });
});
