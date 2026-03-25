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

  test('keeps a private-booked sold-out date visible and explains why it is closed', async ({ page }) => {
    const viewer = createTestUser('exp.detail.private.viewer');
    const privateGuest = createTestUser('exp.detail.private.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const privateGuestId = await createAuthUser(privateGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, { time: '10:00' });

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

    const privateTimeSlot = page.getByTestId(`reservation-time-${experience.time}`);
    await expect(privateTimeSlot).toBeVisible();
    await expect(privateTimeSlot).toBeDisabled();
    await expect(privateTimeSlot).toContainText(/프라이빗 예약 마감|Private booking sold out|貸切予約締切|私人团已售罄/);
    await expect(
      page.getByText(
        /선택한 날짜는 현재 예약이 마감되었습니다\. 다른 날짜를 선택해 주세요\.|This date is fully booked\. Please select another date\.|選択した日は満席です。別の日付を選択してください。|该日期已满，请选择其他日期。/
      )
    ).toBeVisible();
  });

  test('keeps a capacity-full date visible and marks the time as sold out', async ({ page }) => {
    const viewer = createTestUser('exp.detail.full.viewer');
    const existingGuest = createTestUser('exp.detail.full.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, { time: '12:00' });

    const bookingId = `TEST-DETAIL-FULL-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'PAID',
      guests: experience.maxGuests,
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

    const soldOutTimeSlot = page.getByTestId(`reservation-time-${experience.time}`);
    await expect(soldOutTimeSlot).toBeVisible();
    await expect(soldOutTimeSlot).toBeDisabled();
    await expect(soldOutTimeSlot).toContainText(/매진|Sold out|満席|售罄/);
  });
});
