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
const MOCK_PAYPAL_SDK = `
  window.paypal = {
    Buttons: function Buttons(options) {
      return {
        render: async function render(container) {
          container.innerHTML = '';
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Mock PayPal Approve';
          button.setAttribute('data-testid', 'mock-paypal-approve');
          button.addEventListener('click', async () => {
            try {
              const orderId = await options.createOrder({});
              await options.onApprove({ orderID: orderId });
            } catch (error) {
              if (options.onError) options.onError(error);
            }
          });
          container.appendChild(button);
        }
      };
    }
  };
`;

test.afterAll(async () => {
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience payment inline feedback', () => {
  test('shows inline feedback for missing customer fields and agreements without changing checkout params', async ({ page }) => {
    const guest = createTestUser('exp.payment.feedback.guest');
    await createAuthUser(guest, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });

    await page.route('https://www.paypal.com/sdk/js**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: MOCK_PAYPAL_SDK,
      });
    });

    await login(page, guest);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page.getByTestId('exp-payment-booker-name')).toBeVisible({ timeout: 30000 });
    const triggerValidation = async () => {
      await page.getByTestId('exp-payment-submit').click();
    };
    await page.getByTestId('exp-payment-method-bank').click({ force: true });
    await expect(page.getByTestId('exp-payment-submit')).toBeEnabled({ timeout: 30000 });

    const originalUrl = new URL(page.url());

    await page.getByTestId('exp-payment-booker-name').fill('');
    await page.getByTestId('exp-payment-booker-phone').fill('');
    await triggerValidation();

    await expect(page.getByTestId('exp-payment-global-error')).toBeVisible();
    await expect(page.getByTestId('exp-payment-booker-name-error')).toBeVisible();
    await expect(page.getByTestId('exp-payment-booker-phone-error')).toBeVisible();

    const afterCustomerErrorUrl = new URL(page.url());
    expect(afterCustomerErrorUrl.searchParams.get('date')).toBe(originalUrl.searchParams.get('date'));
    expect(afterCustomerErrorUrl.searchParams.get('time')).toBe(originalUrl.searchParams.get('time'));
    expect(afterCustomerErrorUrl.searchParams.get('guests')).toBe(originalUrl.searchParams.get('guests'));
    expect(afterCustomerErrorUrl.searchParams.get('type')).toBe(originalUrl.searchParams.get('type'));
    expect(afterCustomerErrorUrl.searchParams.get('solo')).toBe(originalUrl.searchParams.get('solo'));

    await page.getByTestId('exp-payment-booker-name').fill(guest.fullName);
    await page.getByTestId('exp-payment-booker-phone').fill(guest.phone);
    await triggerValidation();

    await expect(page.getByTestId('exp-payment-global-error')).toBeVisible();
    await expect(page.getByTestId('exp-payment-agreements-error')).toBeVisible();

    const afterAgreementErrorUrl = new URL(page.url());
    expect(afterAgreementErrorUrl.searchParams.get('date')).toBe(originalUrl.searchParams.get('date'));
    expect(afterAgreementErrorUrl.searchParams.get('time')).toBe(originalUrl.searchParams.get('time'));
    expect(afterAgreementErrorUrl.searchParams.get('guests')).toBe(originalUrl.searchParams.get('guests'));
    expect(afterAgreementErrorUrl.searchParams.get('type')).toBe(originalUrl.searchParams.get('type'));
    expect(afterAgreementErrorUrl.searchParams.get('solo')).toBe(originalUrl.searchParams.get('solo'));
  });
});
