import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { buildBookingConfirmedTemplateProps } from '@/app/emails/registry/emailContentBuilders';
import { getBookingSettlementSnapshotForConfirmation } from '@/app/utils/bookingFinance';

const notificationFlowSource = readFileSync(
  'app/utils/experienceNotificationFlows.ts',
  'utf8'
);
const cardConfirmationSource = readFileSync(
  'app/api/payment/experienceCardConfirmation.ts',
  'utf8'
);
const paypalCaptureSource = readFileSync(
  'app/api/payment/paypal/capture-order/route.ts',
  'utf8'
);

test.describe('Experience confirmed email amount contract', () => {
  test('renders 80,000 won for the host and 85,000 won for the guest with solo guarantee', () => {
    const snapshot = getBookingSettlementSnapshotForConfirmation({
      status: 'PENDING',
      amount: 85000,
      total_price: 80000,
      total_experience_price: 80000,
      price_at_booking: 50000,
      solo_guarantee_price: 30000,
      host_payout_amount: 0,
      platform_revenue: 0,
    });

    expect(snapshot.totalExperiencePrice).toBe(80000);
    expect(snapshot.paidAmount).toBe(85000);
    expect(snapshot.hostPayout).toBe(64000);
    expect(snapshot.platformRevenue).toBe(21000);

    const hostEmail = buildBookingConfirmedTemplateProps({
      audience: 'host',
      locale: 'ko',
      payload: {
        experienceTitle: '텐노지 감성 이자카야 투어',
        bookingDate: '2026-07-18',
        bookingTime: '18:00',
        partySize: 1,
        amount: snapshot.totalExperiencePrice,
        ctaUrl: '/host/dashboard',
      },
    });
    const guestEmail = buildBookingConfirmedTemplateProps({
      audience: 'guest',
      locale: 'ko',
      payload: {
        experienceTitle: '텐노지 감성 이자카야 투어',
        bookingDate: '2026-07-18',
        bookingTime: '18:00',
        partySize: 1,
        amount: snapshot.paidAmount,
        ctaUrl: '/guest/trips',
      },
    });

    expect(hostEmail.summaryItems).toContainEqual({
      label: '체험 예약 금액',
      value: '₩80,000',
      emphasis: true,
    });
    expect(guestEmail.summaryItems?.map((item) => item.value)).toContain('₩85,000');
  });

  test('keeps the same separation without solo guarantee', () => {
    const snapshot = getBookingSettlementSnapshotForConfirmation({
      status: 'PENDING',
      amount: 55000,
      total_price: 50000,
      total_experience_price: 50000,
      price_at_booking: 50000,
      solo_guarantee_price: 0,
      host_payout_amount: 0,
      platform_revenue: 0,
    });

    expect(snapshot.totalExperiencePrice).toBe(50000);
    expect(snapshot.paidAmount).toBe(55000);
  });

  test('keeps the host booking amount separate from the guest paid amount', () => {
    expect(notificationFlowSource).toContain('guestPaidAmount: number');
    expect(notificationFlowSource).toContain('hostBookingAmount: number');
    expect(notificationFlowSource).toContain('amount: hostBookingAmount');
    expect(notificationFlowSource).toContain('amount: guestPaidAmount');
    expect(notificationFlowSource).not.toContain('totalAmount: number');
  });

  test('uses the fee-exclusive experience snapshot for card and PayPal host emails', () => {
    for (const source of [cardConfirmationSource, paypalCaptureSource]) {
      expect(source).toContain('hostBookingAmount: snapshot.totalExperiencePrice');
      expect(source).toContain('guestPaidAmount: Number(');
    }
  });
});
