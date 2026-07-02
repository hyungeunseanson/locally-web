import { expect, test } from '@playwright/test';

import {
  calculateBookingCancellationSettlement,
  getBookingHostPayout,
  getBookingPlatformRevenue,
  getBookingSettlementSnapshotForConfirmation,
} from '@/app/utils/bookingFinance';

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
        amount: 85000,
        price_at_booking: 50000,
        solo_guarantee_price: 30000,
      })
    ).toBe(64000);
  });

  test('uses net solo guarantee pricing after the add-on refund is reserved', () => {
    const booking = {
      amount: 85000,
      total_experience_price: 50000,
      solo_guarantee_price: 30000,
      solo_guarantee_refund_amount: 30000,
    };

    expect(getBookingHostPayout(booking)).toBe(40000);
    expect(getBookingPlatformRevenue(booking)).toBe(15000);
  });

  test('does not double refund the solo guarantee add-on on a later full cancellation', () => {
    const settlement = calculateBookingCancellationSettlement({
      amount: 85000,
      total_experience_price: 50000,
      solo_guarantee_price: 30000,
      solo_guarantee_refund_status: 'refunded',
      solo_guarantee_refund_amount: 30000,
      refund_amount: 30000,
    }, 100);

    expect(settlement.refundAmount).toBe(55000);
    expect(settlement.cumulativeRefundAmount).toBe(85000);
    expect(settlement.hostPayout).toBe(0);
    expect(settlement.platformRevenue).toBe(0);
  });

  test('normalizes zero settlement placeholders only while confirming a paid pending booking', () => {
    const snapshot = getBookingSettlementSnapshotForConfirmation({
      status: 'PENDING',
      amount: 110,
      total_price: 100,
      total_experience_price: 0,
      price_at_booking: 0,
      host_payout_amount: 0,
      platform_revenue: 0,
    });

    expect(snapshot.basePrice).toBe(100);
    expect(snapshot.paidAmount).toBe(110);
    expect(snapshot.totalExperiencePrice).toBe(100);
    expect(snapshot.hostPayout).toBe(80);
    expect(snapshot.platformRevenue).toBe(30);
  });

  test('does not overwrite non-zero settlement values during confirmation', () => {
    const snapshot = getBookingSettlementSnapshotForConfirmation({
      status: 'PENDING',
      amount: 110,
      total_price: 100,
      total_experience_price: 100,
      price_at_booking: 100,
      host_payout_amount: 70,
      platform_revenue: 40,
    });

    expect(snapshot.basePrice).toBe(100);
    expect(snapshot.hostPayout).toBe(70);
    expect(snapshot.platformRevenue).toBe(40);
  });

  test('keeps zero settlement values outside pending confirmation', () => {
    const snapshot = getBookingSettlementSnapshotForConfirmation({
      status: 'PAID',
      amount: 110,
      total_price: 100,
      total_experience_price: 100,
      price_at_booking: 100,
      host_payout_amount: 0,
      platform_revenue: 0,
    });

    expect(snapshot.basePrice).toBe(100);
    expect(snapshot.hostPayout).toBe(0);
    expect(snapshot.platformRevenue).toBe(0);
  });
});
