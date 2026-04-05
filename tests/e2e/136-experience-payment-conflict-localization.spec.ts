import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  createAuthUser,
  createTestUser,
  login,
  prepareBookableExperience,
  reviewExperiencePaymentAgreement,
  type AvailabilityKey,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

test.afterAll(async () => {
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience payment conflict localization', () => {
  test('shows translated conflict copy instead of raw Korean API text', async ({ page }) => {
    const guest = createTestUser('exp.payment.conflict.locale');
    await createAuthUser(guest, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });

    await login(page, guest);
    await page.evaluate(() => {
      window.localStorage.setItem('app_lang', 'en');
      document.cookie = 'app_lang=en; path=/; samesite=lax';
    });

    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page.getByTestId('exp-payment-booker-name')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('exp-payment-booker-name').fill(guest.fullName);
    await page.getByTestId('exp-payment-booker-phone').fill(guest.phone);
    await page.getByTestId('exp-payment-method-bank').click({ force: true });

    await reviewExperiencePaymentAgreement(page, 'exp-payment-agree-off-platform');
    await reviewExperiencePaymentAgreement(page, 'exp-payment-agree-safety');
    await reviewExperiencePaymentAgreement(page, 'exp-payment-agree-terms');

    await page.route('**/api/bookings', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errorCode: 'booking_conflict',
          error: '해당 시간대에 남은 좌석이 부족합니다.',
        }),
      });
    });

    await page.getByTestId('exp-payment-submit').click();

    await expect(page.getByTestId('exp-payment-global-error')).toContainText(
      'There are not enough remaining spots for the selected time.'
    );
    await expect(page.getByText('해당 시간대에 남은 좌석이 부족합니다.')).toHaveCount(0);
  });
});
