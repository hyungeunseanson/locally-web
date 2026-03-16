import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  getAdminClient,
  login,
  prepareBookableExperience,
  selectReservationDate,
  selectReservationTime,
  type AvailabilityKey,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

test.afterAll(async () => {
  await cleanupBookings(createdBookingIds);
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience detail refresh after booking confirmation', () => {
  test('refreshes slot summary when returning with browser history', async ({ page }) => {
    const viewer = createTestUser('exp.detail.refresh.viewer');
    const existingGuest = createTestUser('exp.detail.refresh.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);
    await expect(page.getByTestId('reservation-solo-option')).toBeVisible();

    await page.getByTestId('reservation-submit').click();
    await page.waitForURL(new RegExp(`/experiences/${experience.experienceId}/payment`));

    const bookingId = `TEST-DETAIL-REFRESH-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'PAID',
      guests: Math.max(1, experience.maxGuests - 1),
      date: experience.date,
      time: experience.time,
      type: 'group',
      contact_name: existingGuest.fullName,
      contact_phone: existingGuest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payment_method: 'card',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

    if (bookingError) throw bookingError;
    createdBookingIds.push(bookingId);

    await page.goBack();
    await page.waitForURL(new RegExp(`/experiences/${experience.experienceId}$`), { timeout: 15000 });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);
    await expect(page.getByTestId('reservation-solo-option')).toHaveCount(0);
    await expect(
      page.getByTestId('reservation-guest-select').locator('option:not([value=\"private\"])')
    ).toHaveCount(1);
  });
});
