import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  createAuthUser,
  createTestUser,
  login,
  prepareBookableExperience,
  selectReservationDate,
  selectReservationTime,
  type AvailabilityKey,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

test.afterAll(async () => {
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Private tour guest count selection', () => {
  test('allows selecting multiple guests for private tours while keeping the private rate fixed', async ({ page }) => {
    const viewer = createTestUser('exp.private.multiguest.viewer');
    await createAuthUser(viewer, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      requirePrivateEnabled: true,
      minimumMaxGuests: 2,
      searchAnyHost: true,
    });
    const selectedGuests = Math.min(3, experience.maxGuests);
    const expectedFinalAmount = experience.privatePrice + Math.floor(experience.privatePrice * 0.1);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);

    await page.getByTestId('reservation-booking-type-private').click();
    await page.getByTestId('reservation-guest-select').selectOption(String(selectedGuests));

    await page.getByTestId('reservation-submit').click();
    await expect
      .poll(() => {
        const currentUrl = new URL(page.url());
        return {
          pathname: currentUrl.pathname,
          date: currentUrl.searchParams.get('date'),
          time: currentUrl.searchParams.get('time'),
          guests: currentUrl.searchParams.get('guests'),
          type: currentUrl.searchParams.get('type'),
        };
      })
      .toEqual({
        pathname: `/experiences/${experience.experienceId}/payment`,
        date: experience.date,
        time: experience.time,
        guests: String(selectedGuests),
        type: 'private',
      });

    await expect(page.getByText(/프라이빗 투어|Private tour|貸切ツアー|私人团/)).toBeVisible();
    await expect(page.getByText(`${selectedGuests}명`)).toBeVisible();
    await expect(page.getByText(`₩${expectedFinalAmount.toLocaleString()}`)).toBeVisible();
  });
});
