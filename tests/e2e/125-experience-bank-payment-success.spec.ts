import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  createAuthUser,
  createTestUser,
  login,
  prepareBookableExperience,
  type AvailabilityKey,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

test.afterAll(async () => {
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience bank payment success', () => {
  test('completes the bank transfer checkout flow from the payment page', async ({ page }) => {
    const guest = createTestUser('exp.payment.bank.success');
    await createAuthUser(guest, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });

    await login(page, guest);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page.getByTestId('exp-payment-booker-name')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('exp-payment-booker-name').fill(guest.fullName);
    await page.getByTestId('exp-payment-booker-phone').fill(guest.phone);
    await page.getByTestId('exp-payment-method-bank').click({ force: true });
    await expect(page.getByTestId('exp-payment-method-bank')).toHaveClass(/border-black/);

    const reviewAgreement = async (testId: string) => {
      const row = page.getByTestId(testId);
      await row.click();
      await expect(page.getByTestId('exp-payment-agreement-modal')).toBeVisible();
      await page.getByTestId('exp-payment-agreement-modal-close').click();
      await expect(page.getByTestId('exp-payment-agreement-modal')).toHaveCount(0);
      await expect(row).toHaveAttribute('aria-checked', 'true');
    };

    await reviewAgreement('exp-payment-agree-off-platform');
    await reviewAgreement('exp-payment-agree-safety');
    await reviewAgreement('exp-payment-agree-terms');

    await expect(page.getByTestId('exp-payment-submit')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('exp-payment-agreements-error')).toHaveCount(0);
    await expect(page.getByTestId('exp-payment-submit-helper')).toHaveCount(0);
    await page.getByTestId('exp-payment-submit').click();

    await page.waitForURL(
      new RegExp(`/experiences/${experience.experienceId}/payment/complete\\?orderId=`),
      { timeout: 30000 }
    );

    const orderId = new URL(page.url()).searchParams.get('orderId');
    expect(orderId).toBeTruthy();
    await expect(page.getByRole('heading', { name: /입금 대기 중입니다!|Payment Complete!|Your booking is confirmed!|Your payment is pending!/ })).toBeVisible();
    await expect(page.getByText(orderId as string).first()).toBeVisible({ timeout: 15000 });
  });
});
