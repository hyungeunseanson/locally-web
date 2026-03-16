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

test.describe.serial('Solo guarantee guards', () => {
  test('rejects solo guarantee booking creation when confirmed bookings already exist', async ({ page }) => {
    const requester = createTestUser('exp.solo.guard.requester');
    const existingGuest = createTestUser('exp.solo.guard.existing');
    await createAuthUser(requester, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys);

    const bookingId = `TEST-SOLO-GUARD-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'confirmed',
      guests: 1,
      date: experience.date,
      time: experience.time,
      type: 'group',
      contact_name: existingGuest.fullName,
      contact_phone: existingGuest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payment_method: 'bank',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

    if (bookingError) throw bookingError;
    createdBookingIds.push(bookingId);

    await login(page, requester);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const response = await page.evaluate(
      async (payload) => {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        return {
          status: res.status,
          body: await res.json(),
        };
      },
      {
        experienceId: experience.experienceId,
        date: experience.date,
        time: experience.time,
        guests: 1,
        isPrivate: false,
        isSoloGuarantee: true,
        customerName: requester.fullName,
        customerPhone: requester.phone,
        paymentMethod: 'bank',
      }
    );

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('이미 확정된 예약이 있는 일정에는 1인 출발 확정 옵션을 사용할 수 없습니다.');
  });

  test('removes stale solo deep links from the payment page when slot is no longer eligible', async ({ page }) => {
    const requester = createTestUser('exp.solo.guard.deep-link');
    const existingGuest = createTestUser('exp.solo.guard.deep-link.existing');
    await createAuthUser(requester, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys);

    const bookingId = `TEST-SOLO-DEEP-LINK-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'PAID',
      guests: 1,
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

    await login(page, requester);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1&solo=1`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect.poll(() => page.url().includes('solo=1')).toBe(false);
    await expect(page.getByText('1인 출발 확정 옵션이 적용되었습니다.')).toHaveCount(0);
    await expect(page.getByText('1인 출발 확정비')).toHaveCount(0);
  });
});
