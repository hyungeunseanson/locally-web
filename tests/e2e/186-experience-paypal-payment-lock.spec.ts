import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  formatDate,
  getAdminClient,
  getLatestHostExperience,
  insertTestBooking,
  login,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];

async function createExperienceBookingFixture(params: {
  guestId: string;
  guestName: string;
  guestPhone: string;
  status: string;
  paymentMethod: 'card' | 'bank' | 'paypal';
}) {
  const { experienceId } = await getLatestHostExperience();
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 9);

  const bookingId = await insertTestBooking({
    userId: params.guestId,
    experienceId,
    date: formatDate(bookingDate),
    time: '11:00',
    guests: 1,
    status: params.status,
    paymentMethod: params.paymentMethod,
    amount: 47000,
    totalPrice: 47000,
    contactName: params.guestName,
    contactPhone: params.guestPhone,
  });

  createdBookingIds.push(bookingId);
  return bookingId;
}

test.afterAll(async () => {
  await cleanupBookings(createdBookingIds);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience PayPal payment method lock', () => {
  test('rejects PayPal capture on cancelled experience bookings before provider verification', async ({ page }) => {
    const guest = createTestUser('exp.paypal.capture.status');
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const bookingId = await createExperienceBookingFixture({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      status: 'cancelled',
      paymentMethod: 'paypal',
    });

    await login(page, guest);

    const response = await page.request.post('/api/payment/paypal/capture-order', {
      data: {
        bookingId,
        paypalOrderId: 'PAYPAL-EXP-NON-PENDING',
      },
    });

    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('현재 상태'),
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, payment_method, tid')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;

    expect(booking).toMatchObject({
      status: 'cancelled',
      payment_method: 'paypal',
      tid: null,
    });
  });

  test('keeps bank-marked pending experience bookings locked away from PayPal routes', async ({ page }) => {
    const guest = createTestUser('exp.paypal.capture.bank');
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const bookingId = await createExperienceBookingFixture({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      status: 'PENDING',
      paymentMethod: 'bank',
    });

    await login(page, guest);

    const createOrderResponse = await page.request.post('/api/payment/paypal/create-order', {
      data: { bookingId },
    });
    expect(createOrderResponse.status()).toBe(400);
    await expect(createOrderResponse.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('무통장'),
    });

    const captureResponse = await page.request.post('/api/payment/paypal/capture-order', {
      data: {
        bookingId,
        paypalOrderId: 'PAYPAL-EXP-BANK-LOCK',
      },
    });
    expect(captureResponse.status()).toBe(409);
    await expect(captureResponse.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('무통장'),
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, payment_method, tid')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;

    expect(booking).toMatchObject({
      status: 'PENDING',
      payment_method: 'bank',
      tid: null,
    });
  });

  test('rejects non-paypal pending experience placeholders from starting PayPal flow', async ({ page }) => {
    const guest = createTestUser('exp.paypal.capture.card');
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const bookingId = await createExperienceBookingFixture({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      status: 'PENDING',
      paymentMethod: 'card',
    });

    await login(page, guest);

    const createOrderResponse = await page.request.post('/api/payment/paypal/create-order', {
      data: { bookingId },
    });
    expect(createOrderResponse.status()).toBe(409);
    await expect(createOrderResponse.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('PayPal 결제 대기 예약만'),
    });

    const captureResponse = await page.request.post('/api/payment/paypal/capture-order', {
      data: {
        bookingId,
        paypalOrderId: 'PAYPAL-EXP-CARD-LOCK',
      },
    });
    expect(captureResponse.status()).toBe(409);
    await expect(captureResponse.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('PayPal 결제 대기 예약만'),
    });

    const { data: booking, error } = await getAdminClient()
      .from('bookings')
      .select('status, payment_method, tid')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw error;

    expect(booking).toMatchObject({
      status: 'PENDING',
      payment_method: 'card',
      tid: null,
    });
  });
});
