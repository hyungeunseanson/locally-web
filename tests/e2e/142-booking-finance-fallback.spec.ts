import { expect, test } from '@playwright/test';

import { getBookingHostPayout } from '@/app/utils/bookingFinance';

test.describe('Booking finance payout fallback', () => {
  test('returns the standard 80 percent payout for a 50,000 KRW experience booking', () => {
    expect(
      getBookingHostPayout({
        amount: 55000,
        total_price: 50000,
        total_experience_price: 50000,
      })
    ).toBe(40000);
  });

  test('reconstructs legacy payout from paid amount minus platform revenue', () => {
    expect(
      getBookingHostPayout({
        amount: 55000,
        platform_revenue: 15000,
      })
    ).toBe(40000);
  });

  test('includes solo guarantee pricing when only booking snapshot fields remain', () => {
    expect(
      getBookingHostPayout({
        amount: 88000,
        price_at_booking: 50000,
        solo_guarantee_price: 30000,
      })
    ).toBe(64000);
  });
});
