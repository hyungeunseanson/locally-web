import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  buildBookingConfirmedTemplateProps,
  buildNoticeCopyTemplateProps,
} from '@/app/emails/registry/emailContentBuilders';

const bookingCreateSource = readFileSync('app/api/bookings/route.ts', 'utf8');
const paymentConfirmedSource = readFileSync(
  'app/utils/experienceNotificationFlows.ts',
  'utf8'
);
const bankConfirmedSource = readFileSync(
  'app/utils/bookings/confirmExperienceBankPayment.ts',
  'utf8'
);

test.describe('Guest booking email policy', () => {
  test('keeps transport changes scoped to guest booking emails', () => {
    expect(bookingCreateSource).toContain("type: 'booking_pending'");
    expect(bookingCreateSource).toContain("key: 'booking.bank_pending.guest'");
    expect(bookingCreateSource).toContain('after(async () => {');
    expect(bookingCreateSource).toContain("transportPolicy: 'opsAdmin'");

    const guestConfirmedCall = paymentConfirmedSource.slice(
      paymentConfirmedSource.indexOf('if (guestId) {')
    );
    expect(guestConfirmedCall).toContain("audience: 'guest'");
    expect(guestConfirmedCall).toContain("transportPolicy: 'opsAdmin'");

    const guestBankConfirmedCall = bankConfirmedSource.slice(
      bankConfirmedSource.indexOf('if (booking.user_id) {')
    );
    expect(guestBankConfirmedCall).toContain("audience: 'guest'");
    expect(guestBankConfirmedCall).toContain("transportPolicy: 'opsAdmin'");
  });

  test('builds all three guest booking emails with the existing templates and trips CTA', () => {
    const cardProps = buildBookingConfirmedTemplateProps({
      audience: 'guest',
      locale: 'ko',
      payload: {
        experienceTitle: '서울 야경 산책',
        bookingDate: '2026-08-10',
        bookingTime: '19:00',
        partySize: 2,
        amount: 66000,
        ctaUrl: '/guest/trips',
      },
    });
    const bankPendingProps = buildNoticeCopyTemplateProps({
      audience: 'guest',
      locale: 'en',
      payload: {
        copyKey: 'booking.bank_pending.guest',
        copyParams: {
          experienceTitle: 'Seoul Night Walk',
        },
        ctaUrl: '/guest/trips',
      },
    });
    const bankConfirmedProps = buildNoticeCopyTemplateProps({
      audience: 'guest',
      locale: 'ja',
      payload: {
        copyKey: 'booking.bank_confirmed.guest',
        copyParams: {
          experienceTitle: '東京ナイトツアー',
        },
        ctaUrl: '/guest/trips',
      },
    });

    expect(cardProps.subject).toBe('[Locally] 예약이 확정되었습니다');
    expect(cardProps.ctaUrl).toContain('/guest/trips');
    expect(bankPendingProps.subject).toBe('[Locally] Your bank transfer booking was received');
    expect(bankPendingProps.ctaUrl).toContain('/guest/trips');
    expect(bankConfirmedProps.subject).toBe('[Locally] ✅ 予約が確定しました');
    expect(bankConfirmedProps.ctaUrl).toContain('/guest/trips');
  });
});
