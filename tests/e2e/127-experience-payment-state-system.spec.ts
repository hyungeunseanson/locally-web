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

test.describe.serial('Experience payment state system', () => {
  test('shows shared PayPal error notice when the sdk button render fails', async ({ page }) => {
    const guest = createTestUser('exp.payment.state.paypal');
    await createAuthUser(guest, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });

    await page.route('https://www.paypal.com/sdk/js**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          window.paypal = {
            Buttons: function Buttons() {
              return {
                render: async function render() {
                  throw new Error('Mock PayPal render error');
                }
              };
            }
          };
        `,
      });
    });

    await login(page, guest);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page.getByTestId('exp-payment-booker-name')).toBeVisible({ timeout: 30000 });

    const paypalOption = page.getByRole('button', { name: /PayPal/ }).first();
    if (!(await paypalOption.isVisible().catch(() => false))) {
      test.skip(true, 'PayPal is not enabled in the current runtime.');
    }

    await paypalOption.click();

    const errorNotice = page.getByTestId('exp-payment-paypal-error-notice');
    await expect(errorNotice).toBeVisible({ timeout: 15000 });
    await expect(errorNotice).toHaveAttribute('role', 'alert');
    await expect(errorNotice).toHaveAttribute('data-tone', 'error');
  });
});
