import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  buildAdminPaymentConfirmedEmail,
  normalizeAdminAlertEmails,
} from '@/app/utils/adminOperationalEmail';

const readSource = (path: string) => readFileSync(path, 'utf8');

const hostSubmitSource = readSource('app/api/host/register/submit/route.ts');
const legacyHostAlertSource = readSource('app/api/host/register/admin-alert/route.ts');
const experienceWriteSource = readSource('app/api/host/experiences/shared.ts');
const bookingCreateSource = readSource('app/api/bookings/route.ts');
const experienceCardSource = readSource('app/api/payment/experienceCardConfirmation.ts');
const experiencePaypalSource = readSource('app/api/payment/paypal/capture-order/route.ts');
const experienceBankSource = readSource('app/utils/bookings/confirmExperienceBankPayment.ts');
const serviceCardSource = readSource('app/api/services/payment/serviceCardConfirmation.ts');
const servicePaypalSource = readSource('app/api/services/payment/paypal/capture-order/route.ts');
const serviceBankSource = readSource('app/utils/services/confirmServiceBankPayment.ts');
const experienceBankRouteSource = readSource('app/api/admin/bookings/confirm-payment/route.ts');
const serviceBankRouteSource = readSource('app/api/admin/service-confirm-payment/route.ts');

test.describe('Admin operational email contract', () => {
  test('normalizes three whitelist recipients and removes duplicates', () => {
    expect(normalizeAdminAlertEmails([
      'first-admin@example.com',
      ' SECOND-ADMIN@example.com ',
      'third-admin@example.com',
      'first-admin@example.com ',
      '',
      null,
    ])).toEqual([
      'first-admin@example.com',
      'second-admin@example.com',
      'third-admin@example.com',
    ]);
  });

  test('builds payment emails with the operational fields for every payment method', () => {
    const experienceCard = buildAdminPaymentConfirmedEmail({
      domain: 'experience',
      title: '서울 야시장 투어',
      orderId: 'ORD-EXPERIENCE-1',
      amount: 85000,
      paymentMethod: 'card',
      link: '/admin/dashboard?tab=LEDGER',
      customerName: '테스트 게스트',
    });
    const servicePaypal = buildAdminPaymentConfirmedEmail({
      domain: 'service',
      title: '서울 통역 의뢰',
      orderId: 'SVC-SERVICE-1',
      amount: 123456,
      paymentMethod: 'paypal',
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    });
    const bank = buildAdminPaymentConfirmedEmail({
      domain: 'experience',
      title: '부산 산책',
      orderId: 'ORD-BANK-1',
      amount: 55000,
      paymentMethod: 'bank',
      link: '/admin/dashboard?tab=LEDGER',
    });

    expect(experienceCard).toMatchObject({
      subject: '[Locally Admin][결제] 체험 예약 결제 완료',
      title: '체험 예약 결제가 완료되었습니다',
      link: '/admin/dashboard?tab=LEDGER',
      ctaLabel: '결제 내역 확인하기',
    });
    expect(experienceCard.message).toContain('상품/의뢰명: 서울 야시장 투어');
    expect(experienceCard.message).toContain('주문번호: ORD-EXPERIENCE-1');
    expect(experienceCard.message).toContain('결제수단: 카드');
    expect(experienceCard.message).toContain('결제금액: ₩85,000');
    expect(experienceCard.message).toContain('고객명: 테스트 게스트');

    expect(servicePaypal.subject).toBe('[Locally Admin][결제] 맞춤 의뢰 결제 완료');
    expect(servicePaypal.message).toContain('결제수단: PayPal');
    expect(servicePaypal.message).toContain('결제금액: ₩123,456');
    expect(bank.message).toContain('결제수단: 무통장 입금');
  });

  test('emails admins only for initial host submissions and review resubmissions', () => {
    expect(hostSubmitSource).toContain("existingApplicationStatus === 'revision'");
    expect(hostSubmitSource).toContain("existingApplicationStatus === 'rejected'");
    expect(hostSubmitSource).toContain("if (notifyAdmin && nextStatus === 'pending')");
    expect(hostSubmitSource).toContain('sendAdminAlertEmails({');

    expect(legacyHostAlertSource).toContain('COMPATIBILITY_DEDUPE_WINDOW_MS = 10 * 60 * 1000');
    expect(legacyHostAlertSource.indexOf('if (recentNotifications && recentNotifications.length > 0)'))
      .toBeLessThan(legacyHostAlertSource.indexOf('await sendAdminAlertEmails({'));
  });

  test('emails admins for host-created experiences and review resubmissions only', () => {
    expect(experienceWriteSource).toContain('if (!actor.isAdmin) {');
    expect(experienceWriteSource).toContain("existingStatus === 'revision' || existingStatus === 'rejected'");
    expect(experienceWriteSource).toContain('if (shouldResubmitForReview) {');
    expect(experienceWriteSource.match(/sendAdminAlertEmails\(\{/g)).toHaveLength(2);
  });

  test('keeps bank reservation creation as an in-app alert without an email', () => {
    expect(bookingCreateSource).toContain('void insertAdminAlerts({');
    expect(bookingCreateSource).not.toContain('sendAdminAlertEmails');
    expect(bookingCreateSource).not.toContain('sendAdminPaymentConfirmedEmail');
  });

  test('wires each confirmed payment path to the common admin email helper', () => {
    for (const source of [
      experienceCardSource,
      experiencePaypalSource,
      experienceBankSource,
      serviceCardSource,
      servicePaypalSource,
      serviceBankSource,
    ]) {
      expect(source).toContain('sendAdminPaymentConfirmedEmail({');
    }

    expect(experienceCardSource).toContain("paymentMethod: 'card'");
    expect(experiencePaypalSource).toContain("paymentMethod: 'paypal'");
    expect(experienceBankSource).toContain("paymentMethod: 'bank'");
    expect(serviceCardSource).toContain("paymentMethod: 'card'");
    expect(servicePaypalSource).toContain("paymentMethod: 'paypal'");
    expect(serviceBankSource).toContain("paymentMethod: 'bank'");
  });

  test('keeps duplicate payment requests ahead of all email side effects', () => {
    expect(experienceCardSource.indexOf('if (!bookingData)'))
      .toBeLessThan(experienceCardSource.indexOf('sendAdminPaymentConfirmedEmail({'));
    expect(experiencePaypalSource.indexOf('if (!bookingData)'))
      .toBeLessThan(experiencePaypalSource.indexOf('sendAdminPaymentConfirmedEmail({'));
    expect(serviceCardSource.indexOf('if (!updatedBooking)'))
      .toBeLessThan(serviceCardSource.indexOf('sendAdminPaymentConfirmedEmail({'));
    expect(servicePaypalSource.indexOf('if (!updatedBooking)'))
      .toBeLessThan(servicePaypalSource.indexOf('sendAdminPaymentConfirmedEmail({'));

    expect(experienceBankRouteSource.indexOf('if (result.alreadyProcessed)'))
      .toBeLessThan(experienceBankRouteSource.indexOf('await runExperienceBankConfirmSideEffects'));
    expect(serviceBankRouteSource.indexOf('if (result.alreadyProcessed)'))
      .toBeLessThan(serviceBankRouteSource.indexOf('await runServiceBankConfirmSideEffects'));
  });
});
