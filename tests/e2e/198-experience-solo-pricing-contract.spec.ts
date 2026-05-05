import { expect, test } from '@playwright/test';

import { SOLO_GUARANTEE_PRICE } from '@/app/constants/soloGuarantee';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';

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
  type BookableExperience,
  type TestUser,
} from './helpers/experienceBooking';

type AtomicBookingResult = {
  new_order_id: string;
  final_amount: number;
};

type BookingPricingSnapshot = {
  amount: number | string | null;
  total_price: number | string | null;
  status: string | null;
  guests: number | null;
  type: string | null;
  payment_method: string | null;
  is_solo_guarantee: boolean | null;
  solo_guarantee_price: number | string | null;
};

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

function getPlatformFee(baseHostPrice: number) {
  return Math.floor(baseHostPrice * 0.1);
}

function parseWonAmount(text: string | null) {
  return Number(String(text || '').replace(/[^\d]/g, ''));
}

async function createAtomicExperienceBooking({
  user,
  userId,
  experience,
  guests,
  isPrivate = false,
  isSoloGuarantee = false,
}: {
  user: TestUser;
  userId: string;
  experience: BookableExperience;
  guests: number;
  isPrivate?: boolean;
  isSoloGuarantee?: boolean;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .rpc('create_booking_atomic', {
      p_user_id: userId,
      p_experience_id: String(experience.experienceId),
      p_date: experience.date,
      p_time: experience.time,
      p_guests: guests,
      p_is_private: isPrivate,
      p_customer_name: user.fullName,
      p_customer_phone: user.phone,
      p_payment_method: 'bank',
      p_is_solo_guarantee: isSoloGuarantee,
    })
    .maybeSingle<AtomicBookingResult>();

  if (error || !data?.new_order_id) {
    throw error || new Error('Failed to create atomic experience booking.');
  }

  createdBookingIds.push(data.new_order_id);

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('amount, total_price, status, guests, type, payment_method, is_solo_guarantee, solo_guarantee_price')
    .eq('id', data.new_order_id)
    .maybeSingle<BookingPricingSnapshot>();

  if (bookingError || !booking) {
    throw bookingError || new Error(`Missing booking snapshot for ${data.new_order_id}.`);
  }

  return { result: data, booking };
}

test.afterAll(async () => {
  await cleanupBookings(createdBookingIds);
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe('Experience solo pricing contract', () => {
  test('keeps shared one-person pricing unchanged without the solo guarantee option', async () => {
    const user = createTestUser('exp.solo.pricing.shared');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });
    const baseHostPrice = experience.price;
    const expectedFinalAmount = baseHostPrice + getPlatformFee(baseHostPrice);

    expect(baseHostPrice).toBeGreaterThan(0);

    const { result, booking } = await createAtomicExperienceBooking({
      user,
      userId,
      experience,
      guests: 1,
    });

    expect(Number(result.final_amount)).toBe(expectedFinalAmount);
    expect(Number(booking.amount)).toBe(expectedFinalAmount);
    expect(Number(booking.total_price)).toBe(baseHostPrice);
    expect(Number(booking.solo_guarantee_price || 0)).toBe(0);
    expect(booking.is_solo_guarantee).toBe(false);
    expect(getBookingHostPayout(booking)).toBe(Math.floor(baseHostPrice * 0.8));
  });

  test('charges the solo guarantee add-on without adding guest platform fee to the add-on', async () => {
    const user = createTestUser('exp.solo.pricing.addon');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
    });
    const baseHostPrice = experience.price;
    const hostPrice = baseHostPrice + SOLO_GUARANTEE_PRICE;
    const expectedFinalAmount = hostPrice + getPlatformFee(baseHostPrice);

    expect(baseHostPrice).toBeGreaterThan(0);

    const { result, booking } = await createAtomicExperienceBooking({
      user,
      userId,
      experience,
      guests: 1,
      isSoloGuarantee: true,
    });

    expect(Number(result.final_amount)).toBe(expectedFinalAmount);
    expect(Number(booking.amount)).toBe(expectedFinalAmount);
    expect(Number(booking.total_price)).toBe(hostPrice);
    expect(Number(booking.solo_guarantee_price)).toBe(SOLO_GUARANTEE_PRICE);
    expect(booking.is_solo_guarantee).toBe(true);
    expect(getBookingHostPayout(booking)).toBe(Math.floor(hostPrice * 0.8));
  });

  test('keeps shared multi-guest pricing based on the full guest-count base price', async () => {
    const user = createTestUser('exp.solo.pricing.multiguest');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      minimumMaxGuests: 2,
      searchAnyHost: true,
    });
    const baseHostPrice = experience.price * 2;
    const expectedFinalAmount = baseHostPrice + getPlatformFee(baseHostPrice);

    expect(experience.price).toBeGreaterThan(0);

    const { result, booking } = await createAtomicExperienceBooking({
      user,
      userId,
      experience,
      guests: 2,
    });

    expect(Number(result.final_amount)).toBe(expectedFinalAmount);
    expect(Number(booking.amount)).toBe(expectedFinalAmount);
    expect(Number(booking.total_price)).toBe(baseHostPrice);
    expect(Number(booking.solo_guarantee_price || 0)).toBe(0);
    expect(booking.guests).toBe(2);
    expect(booking.type).toBe('group');
  });

  test('keeps private booking pricing based on the private base price only', async () => {
    const user = createTestUser('exp.solo.pricing.private');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      requirePrivateEnabled: true,
      searchAnyHost: true,
    });
    const baseHostPrice = experience.privatePrice;
    const expectedFinalAmount = baseHostPrice + getPlatformFee(baseHostPrice);

    expect(baseHostPrice).toBeGreaterThan(0);

    const { result, booking } = await createAtomicExperienceBooking({
      user,
      userId,
      experience,
      guests: 1,
      isPrivate: true,
    });

    expect(Number(result.final_amount)).toBe(expectedFinalAmount);
    expect(Number(booking.amount)).toBe(expectedFinalAmount);
    expect(Number(booking.total_price)).toBe(baseHostPrice);
    expect(Number(booking.solo_guarantee_price || 0)).toBe(0);
    expect(booking.type).toBe('private');
  });

  test('shows exactly a 30,000 KRW total increase when solo guarantee is selected on the payment page', async ({ page }) => {
    test.setTimeout(120000);

    const user = createTestUser('exp.solo.pricing.ui');
    await createAuthUser(user, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, {
      searchAnyHost: true,
      time: '10:30',
    });
    const baseHostPrice = experience.price;
    const platformFee = getPlatformFee(baseHostPrice);
    const noSoloTotal = baseHostPrice + platformFee;
    const soloTotal = noSoloTotal + SOLO_GUARANTEE_PRICE;
    const legacySoloFeeOnFullHostPrice = getPlatformFee(baseHostPrice + SOLO_GUARANTEE_PRICE);

    expect(baseHostPrice).toBeGreaterThan(0);

    await login(page, user);
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'domcontentloaded' }
    );

    const totalAmount = page.getByTestId('exp-payment-total-amount');
    await expect(totalAmount).toHaveText(`₩${noSoloTotal.toLocaleString()}`, { timeout: 30000 });
    const totalWithoutSolo = parseWonAmount(await totalAmount.textContent());
    await expect(page.getByText(`+ ₩${platformFee.toLocaleString()}`).first()).toBeVisible();

    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1&solo=1`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(totalAmount).toHaveText(`₩${soloTotal.toLocaleString()}`, { timeout: 30000 });
    const totalWithSolo = parseWonAmount(await totalAmount.textContent());
    expect(totalWithSolo - totalWithoutSolo).toBe(SOLO_GUARANTEE_PRICE);
    await expect(page.getByText(`+ ₩${platformFee.toLocaleString()}`).first()).toBeVisible();
    await expect(page.getByText(`+ ₩${SOLO_GUARANTEE_PRICE.toLocaleString()}`).first()).toBeVisible();

    if (legacySoloFeeOnFullHostPrice !== platformFee) {
      await expect(page.getByText(`+ ₩${legacySoloFeeOnFullHostPrice.toLocaleString()}`)).toHaveCount(0);
    }
  });
});
