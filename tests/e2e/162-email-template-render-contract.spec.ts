import { expect, test } from '@playwright/test';

import { sendImmediateAdminEmail } from '@/app/utils/adminEmailProvider';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import {
  buildBookingCancelledTemplateProps,
  buildBookingConfirmedTemplateProps,
  buildHostApplicationStatusTemplateProps,
  buildInquiryNewMessageTemplateProps,
  buildNoticeCopyTemplateProps,
  buildNoticeCustomTemplateProps,
  buildServicePaymentConfirmedTemplateProps,
} from '@/app/emails/registry/emailContentBuilders';
import { emailTemplateRegistry } from '@/app/emails/registry/emailTemplates';
import {
  resolveGmailSenderProfile,
  sendTemplatedEmail,
} from '@/app/emails/delivery/sendTemplatedEmail';
import {
  resolveRequestedEmailLocale,
} from '@/app/emails/render/renderEmailTemplate';

test.describe('Templated email system phase 2 contracts', () => {
  test('resolves locale with explicit value first and falls back to Korean by default', async () => {
    await expect(resolveRequestedEmailLocale({ locale: 'ja' })).resolves.toBe('ja');
    await expect(resolveRequestedEmailLocale({})).resolves.toBe('ko');
  });

  test('builds booking confirmed template props with the required subject/preheader contract', () => {
    const rendered = buildBookingConfirmedTemplateProps({
      audience: 'host',
      locale: 'ko',
      payload: {
        experienceTitle: '도쿄 야경 투어',
        bookingDate: '2026-04-20',
        bookingTime: '19:00',
        partySize: 2,
        amount: 58000,
        ctaUrl: '/host/dashboard',
        recipientName: '민지',
        guestName: 'Sora',
      },
    });

    expect(rendered.subject).toBe('[Locally] 🎉 새로운 예약이 도착했습니다!');
    expect(rendered.preheader).toContain('도쿄 야경 투어');
    expect(rendered.title).toBe('새 예약이 접수되었습니다');
    expect(rendered.summaryTitle).toBe('예약 정보');
    expect(rendered.statusLabel).toBe('예약 접수');
    expect(rendered.summaryItems?.map((item) => item.value)).toContain('Sora');
    expect(rendered.ctaLabel).toBe('예약 상세 확인하기');
    expect(rendered.ctaUrl).toContain('/host/dashboard');
  });

  test('builds inquiry new message template props and keeps registry ownership explicit', () => {
    const rendered = buildInquiryNewMessageTemplateProps({
      audience: 'guest',
      locale: 'en',
      payload: {
        actorName: 'Locally Support',
        threadTitle: 'Airport pickup request',
        messagePreview: 'We checked your request and shared the pickup details.',
        ctaUrl: '/inbox',
      },
    });

    expect(rendered.subject).toBe('[Locally] New message from Locally Support');
    expect(rendered.preheader).toBe('We checked your request and shared the pickup details.');
    expect(rendered.summaryItems?.[1]?.value).toBe('Airport pickup request');
    expect(rendered.summaryTitle).toBe('Conversation details');
    expect(rendered.messagePreviewTitle).toBe('Latest message');
    expect(rendered.messagePreview).toContain('pickup details');
    expect(rendered.ctaLabel).toBe('Check message');
    expect(Object.keys(emailTemplateRegistry).sort()).toEqual([
      'booking.cancelled',
      'booking.confirmed',
      'host_application.status',
      'inquiry.new_message',
      'notice.copy',
      'notice.custom',
      'service.payment_confirmed',
    ]);
  });

  test('builds host application and service payment template props with preserved localized CTA', () => {
    const hostStatus = buildHostApplicationStatusTemplateProps({
      audience: 'host',
      locale: 'en',
      payload: {
        status: 'revision',
        note: 'Please upload a clearer ID image.',
        ctaUrl: '/host/dashboard',
      },
    });

    expect(hostStatus.subject).toBe('[Locally] 🛠️ Your host application needs revision');
    expect(hostStatus.preheader).toContain('Please review the admin comment');
    expect(hostStatus.statusLabel).toBe('Revision needed');
    expect(hostStatus.ctaLabel).toBe('Open host dashboard');
    expect(hostStatus.note).toContain('Please upload a clearer ID image.');

    const servicePayment = buildServicePaymentConfirmedTemplateProps({
      audience: 'guest',
      locale: 'ja',
      payload: {
        requestTitle: '東京通訳サポート',
        amount: 98000,
        ctaUrl: '/services/req-1',
      },
    });

    expect(servicePayment.subject).toBe('[Locally] サービスの決済が完了しました');
    expect(servicePayment.preheader).toContain('現地ホストの募集が始まります');
    expect(servicePayment.summaryTitle).toBe('依頼情報');
    expect(servicePayment.statusLabel).toBe('決済完了');
    expect(servicePayment.ctaLabel).toBe('依頼を見る');
    expect(servicePayment.summaryItems?.[0]?.value).toBe('東京通訳サポート');
  });

  test('builds generic notice templates for legacy copy-backed and custom notice paths', () => {
    const copyNotice = buildNoticeCopyTemplateProps({
      audience: 'host',
      locale: 'ko',
      payload: {
        copyKey: 'review.new.host',
        copyParams: {
          experienceTitle: '도쿄 야경 투어',
        },
        ctaUrl: '/host/dashboard?tab=reviews',
      },
    });

    expect(copyNotice.subject).toBe('[Locally] 새 후기가 등록되었습니다');
    expect(copyNotice.bodyText).toContain('도쿄 야경 투어');
    expect(copyNotice.bodyCardTitle).toBe('안내 내용');
    expect(copyNotice.ctaLabel).toBe('후기 확인하기');

    const jaCopyNotice = buildNoticeCopyTemplateProps({
      audience: 'host',
      locale: 'ja',
      payload: {
        copyKey: 'review.new.host',
        copyParams: {
          experienceTitle: '東京夜景ツアー',
        },
        ctaUrl: '/trips',
      },
    });

    expect(jaCopyNotice.bodyCardTitle).toBe('ご案内内容');

    const customNotice = buildNoticeCustomTemplateProps({
      audience: 'admin',
      locale: 'ko',
      payload: {
        subject: '[Locally Admin] 운영팀 확인이 필요한 알림입니다',
        title: '운영팀 확인이 필요한 알림입니다',
        message: '새로운 운영 이벤트가 발생했습니다.',
        ctaLabel: '운영 대시보드 보기',
        ctaUrl: '/admin/dashboard?tab=ALERTS',
        footerVariant: 'opsAdmin',
      },
    });

    expect(customNotice.subject).toBe('[Locally Admin] 운영팀 확인이 필요한 알림입니다');
    expect(customNotice.bodyText).toBe('새로운 운영 이벤트가 발생했습니다.');
    expect(customNotice.bodyCardTitle).toBe('확인 내용');
    expect(customNotice.footerVariant).toBe('opsAdmin');
    expect(customNotice.ctaUrl).toContain('/admin/dashboard?tab=ALERTS');
  });

  test('keeps sendTemplatedEmail available as a safe adapter skeleton for missing recipients', async () => {
    const bookingCancelled = buildBookingCancelledTemplateProps({
      audience: 'host',
      locale: 'ko',
      payload: {
        experienceTitle: '제주 야시장 워크',
        reason: '게스트 개인 사정',
        refundAmount: 25000,
        ctaUrl: '/host/dashboard',
        recipientName: '현우',
        variant: 'standard',
      },
    });

    expect(bookingCancelled.subject).toBe('[Locally] 예약 취소 알림');
    expect(bookingCancelled.preheader).toContain('예약 취소 안내');
    expect(bookingCancelled.ctaLabel).toBe('대시보드 확인하기');

    const result = await sendTemplatedEmail({
      templateId: 'booking.cancelled',
      audience: 'host',
      locale: 'ko',
      recipient: {},
      payload: {
        experienceTitle: '제주 야시장 워크',
        reason: '게스트 개인 사정',
        refundAmount: 25000,
        ctaUrl: '/host/dashboard',
        recipientName: '현우',
        variant: 'standard',
      },
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe('recipient_missing');
  });

  test('routes generic and admin adapters into the templated email pipeline without falling back to legacy shells', async () => {
    const genericResult = await sendImmediateGenericEmail({
      subject: 'legacy subject',
      title: 'legacy title',
      message: 'legacy message',
      templatedEmail: {
        templateId: 'service.payment_confirmed',
        audience: 'guest',
        payload: {
          requestTitle: '도쿄 공항 픽업',
          ctaUrl: '/services/request-1',
        },
      },
    });

    expect(genericResult.success).toBe(true);
    expect(genericResult.sent).toBe(false);
    expect(genericResult.skipped).toBe('recipient_missing');

    const adminResult = await sendImmediateAdminEmail({
      to: '',
      subject: 'legacy admin subject',
      title: 'legacy admin title',
      message: 'legacy admin message',
      templatedEmail: {
        templateId: 'host_application.status',
        audience: 'admin',
        payload: {
          status: 'approved',
          ctaUrl: '/admin/dashboard',
        },
      },
    });

    expect(adminResult.success).toBe(true);
    expect(adminResult.sent).toBe(false);
    expect(adminResult.skipped).toBe('recipient_missing');
  });

  test('prefers dedicated admin Gmail credentials for ops admin transport when configured', () => {
    const sender = resolveGmailSenderProfile('opsAdmin', {
      ADMIN_GMAIL_USER: 'ops-admin@example.com',
      ADMIN_GMAIL_APP_PASSWORD: 'admin-pass',
      GMAIL_USER: 'general@example.com',
      GMAIL_APP_PASSWORD: 'general-pass',
    });

    expect(sender).toEqual({
      user: 'ops-admin@example.com',
      pass: 'admin-pass',
      from: '"Locally Admin" <ops-admin@example.com>',
    });
  });

  test('falls back to the shared Gmail sender for ops admin transport when dedicated admin credentials are missing', () => {
    const sender = resolveGmailSenderProfile('opsAdmin', {
      GMAIL_USER: 'general@example.com',
      GMAIL_APP_PASSWORD: 'general-pass',
    });

    expect(sender).toEqual({
      user: 'general@example.com',
      pass: 'general-pass',
      from: '"Locally Team" <general@example.com>',
    });
  });

  test('keeps transactional mail on the shared Gmail sender even when dedicated admin credentials exist', () => {
    const sender = resolveGmailSenderProfile('transactional', {
      ADMIN_GMAIL_USER: 'ops-admin@example.com',
      ADMIN_GMAIL_APP_PASSWORD: 'admin-pass',
      GMAIL_USER: 'general@example.com',
      GMAIL_APP_PASSWORD: 'general-pass',
    });

    expect(sender).toEqual({
      user: 'general@example.com',
      pass: 'general-pass',
      from: '"Locally Team" <general@example.com>',
    });
  });
});
