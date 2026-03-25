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

test.describe.serial('Private tour selector rollback', () => {
  test('keeps the compact private option while navigating with guests=1 and the fixed rate', async ({ page }) => {
    const viewer = createTestUser('exp.private.multiguest.viewer');
    await createAuthUser(viewer, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      requirePrivateEnabled: true,
      minimumMaxGuests: 2,
      searchAnyHost: true,
    });
    const expectedFinalAmount = experience.privatePrice + Math.floor(experience.privatePrice * 0.1);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);

    await page.getByTestId('reservation-guest-select').selectOption('private');
    await expect(
      page.getByText(/실제 참여 인원은 예약 후 호스트에게 알려주세요\.|Please let the host know the final guest count after booking\.|実際の参加人数は予約後にホストへお知らせください。|实际参加人数请在预订后告知主办方。/)
    ).toBeVisible();

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
        guests: '1',
        type: 'private',
      });

    await expect(page.getByText(/프라이빗 투어|Private tour|貸切ツアー|私人团/)).toBeVisible();
    await expect(page.getByText(`₩${expectedFinalAmount.toLocaleString()}`)).toBeVisible();
  });
});
