import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  createAuthUser,
  createTestUser,
  ensureAvailabilitySlot,
  getVisibleReservationCard,
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
    test.setTimeout(120000);

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

    await expect(page.getByText(/프라이빗 투어|Private tour|Private|貸切ツアー|私人团/).first()).toBeVisible();
    await expect(page.getByTestId('exp-payment-total-amount')).toHaveText(`₩${expectedFinalAmount.toLocaleString()}`);
  });

  test('keeps the desktop sticky reservation card internally scrollable after date selection', async ({ page }) => {
    test.setTimeout(120000);

    const viewer = createTestUser('exp.private.sidebar.scroll');
    await createAuthUser(viewer, createdAuthUserIds);

    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      requirePrivateEnabled: true,
      minimumMaxGuests: 2,
      searchAnyHost: true,
      time: '10:00',
    });

    for (const time of ['10:30', '11:00', '11:30', '12:00']) {
      await ensureAvailabilitySlot(
        {
          experienceId: experience.experienceId,
          date: experience.date,
          time,
        },
        createdAvailabilityKeys
      );
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);

    const reservationCard = getVisibleReservationCard(page).locator(':scope > div');
    await expect(reservationCard).toHaveCount(1);
    await expect(page.getByTestId('reservation-submit')).toBeVisible();

    const stickyScrollContract = await reservationCard.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        overscrollBehaviorY: style.overscrollBehaviorY,
      };
    });

    expect(stickyScrollContract.overflowY).toBe('auto');
    expect(stickyScrollContract.overscrollBehaviorY).toBe('contain');
    expect(Number.parseFloat(stickyScrollContract.maxHeight)).toBeGreaterThan(0);
  });
});
