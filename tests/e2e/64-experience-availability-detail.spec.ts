import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  ensureAvailabilitySlot,
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

test.describe.serial('Experience detail availability summary', () => {
  test('reduces selectable guest count and hides solo option when confirmed shared bookings exist', async ({ page }) => {
    const viewer = createTestUser('exp.detail.availability.viewer');
    const existingGuest = createTestUser('exp.detail.availability.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys);

    const expectedRemainingSeats = Math.min(2, Math.max(1, experience.maxGuests - 1));
    const occupiedGuests = Math.max(1, experience.maxGuests - expectedRemainingSeats);
    const bookingId = `TEST-DETAIL-SHARED-${Date.now()}`;

    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'PAID',
      guests: occupiedGuests,
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

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);

    await expect(page.getByTestId('reservation-solo-option')).toHaveCount(0);

    const guestOptions = page
      .getByTestId('reservation-guest-select')
      .locator('option:not([value="private"])');

    await expect(guestOptions).toHaveCount(Math.min(expectedRemainingSeats, 6));
  });

  test('removes confirmed private slots from the detail time picker', async ({ page }) => {
    const viewer = createTestUser('exp.detail.private.viewer');
    const privateGuest = createTestUser('exp.detail.private.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const privateGuestId = await createAuthUser(privateGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, { time: '10:00' });
    const alternateTime = '14:00';

    await ensureAvailabilitySlot(
      {
        experienceId: experience.experienceId,
        date: experience.date,
        time: alternateTime,
      },
      createdAvailabilityKeys
    );

    const bookingId = `TEST-DETAIL-PRIVATE-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: privateGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'confirmed',
      guests: 1,
      date: experience.date,
      time: experience.time,
      type: 'private',
      contact_name: privateGuest.fullName,
      contact_phone: privateGuest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payment_method: 'bank',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

    if (bookingError) throw bookingError;
    createdBookingIds.push(bookingId);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);

    await expect(page.getByTestId(`reservation-time-${experience.time}`)).toHaveCount(0);
    await expect(page.getByTestId(`reservation-time-${alternateTime}`)).toBeVisible();
  });
});
