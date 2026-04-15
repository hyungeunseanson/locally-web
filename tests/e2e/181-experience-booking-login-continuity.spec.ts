import { expect, test, type Page } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  createAuthUser,
  createTestUser,
  prepareBookableExperience,
  type AvailabilityKey,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

test.afterAll(async () => {
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

async function submitLoginForm(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

test.describe.serial('Experience booking login continuity', () => {
  test('returns to the same payment URL and keeps checkout ready after login', async ({ page }) => {
    const guest = createTestUser('exp.login.payment.resume');
    await createAuthUser(guest, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });

    const paymentPath =
      `/experiences/${experience.experienceId}/payment` +
      `?date=${experience.date}&time=${experience.time}&guests=1`;

    await page.goto(paymentPath, { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
      .toBe('/login');
    await expect
      .poll(() => {
        const returnUrl = new URL(page.url()).searchParams.get('returnUrl');
        if (!returnUrl) {
          return null;
        }

        const parsed = new URL(returnUrl, 'https://locally.test');
        return {
          pathname: parsed.pathname,
          date: parsed.searchParams.get('date'),
          time: parsed.searchParams.get('time'),
          guests: parsed.searchParams.get('guests'),
        };
      })
      .toEqual({
        pathname: `/experiences/${experience.experienceId}/payment`,
        date: experience.date,
        time: experience.time,
        guests: '1',
      });

    await dismissAnnouncementIfVisible(page);
    await submitLoginForm(page, guest.email, guest.password);

    await expect
      .poll(() => {
        const currentUrl = new URL(page.url());
        return {
          pathname: currentUrl.pathname,
          date: currentUrl.searchParams.get('date'),
          time: currentUrl.searchParams.get('time'),
          guests: currentUrl.searchParams.get('guests'),
        };
      }, { timeout: 30000 })
      .toEqual({
        pathname: `/experiences/${experience.experienceId}/payment`,
        date: experience.date,
        time: experience.time,
        guests: '1',
      });

    await expect(page.getByTestId('exp-payment-booker-name')).toHaveValue(guest.fullName, { timeout: 30000 });
    await expect(page.getByTestId('exp-payment-booker-phone')).toHaveValue(guest.phone, { timeout: 30000 });
    await expect(page.getByTestId('exp-payment-submit')).toBeVisible({ timeout: 30000 });
  });

  test('returns to the experience page after login and can continue to payment without refreshing', async ({ page }) => {
    const guest = createTestUser('exp.login.detail.resume');
    await createAuthUser(guest, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });

    const detailPath = `/experiences/${experience.experienceId}`;

    await page.goto(detailPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(`reservation-day-${experience.date}`)).toBeVisible({ timeout: 30000 });

    await page.getByTestId(`reservation-day-${experience.date}`).click();
    await page.getByTestId(`reservation-time-${experience.time}`).click();
    await page.getByTestId('reservation-submit').click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
      .toBe('/login');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('returnUrl'))
      .toBe(detailPath);

    await dismissAnnouncementIfVisible(page);
    await submitLoginForm(page, guest.email, guest.password);

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30000 })
      .toBe(detailPath);

    await expect(page.getByTestId(`reservation-day-${experience.date}`)).toBeVisible({ timeout: 30000 });
    await page.getByTestId(`reservation-day-${experience.date}`).click();
    await page.getByTestId(`reservation-time-${experience.time}`).click();
    await page.getByTestId('reservation-submit').click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30000 })
      .toBe(`/experiences/${experience.experienceId}/payment`);
    await expect(page.getByTestId('exp-payment-booker-name')).toHaveValue(guest.fullName, { timeout: 30000 });
  });
});
