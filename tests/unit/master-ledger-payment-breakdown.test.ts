import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { getMasterLedgerPaymentBreakdown } from '../../app/admin/dashboard/components/masterLedgerPaymentBreakdown.ts';

function booking(overrides: Record<string, unknown> = {}) {
  return {
    _type: 'experience' as const, type: 'group', status: 'PAID', guests: 1,
    amount: 41800, price_at_booking: 38000, total_price: 38000,
    solo_guarantee_price: 0, solo_guarantee_refund_status: 'not_applicable',
    solo_guarantee_refund_amount: 0, refund_amount: 0,
    ...overrides,
  };
}

test('shows saved base subtotal and customer fee for one and two guests', () => {
  const one = getMasterLedgerPaymentBreakdown(booking());
  assert.deepEqual([one.guestCount, one.subtotal, one.customerFee, one.originalAmount],
    [1, 38000, 3800, 41800]);
  assert.equal('unitPrice' in one, false);

  const two = getMasterLedgerPaymentBreakdown(booking({ guests: 2, price_at_booking: 180000, total_price: 180000, amount: 198000 }));
  assert.deepEqual([two.guestCount, two.subtotal, two.customerFee],
    [2, 180000, 18000]);
  assert.equal('unitPrice' in two, false);
});

test('keeps the solo guarantee outside the customer fee base', () => {
  const result = getMasterLedgerPaymentBreakdown(booking({
    amount: 79800, total_price: 76000, solo_guarantee_price: 38000,
  }));
  assert.deepEqual([result.subtotal, result.soloGuaranteePrice, result.customerFee],
    [38000, 38000, 3800]);
});

test('subtracts a completed solo refund only once from the original amount', () => {
  const result = getMasterLedgerPaymentBreakdown(booking({
    status: 'completed', amount: 88200, price_at_booking: 42000, total_price: 42000,
    solo_guarantee_price: 42000, solo_guarantee_refund_status: 'refunded',
    solo_guarantee_refund_amount: 42000, refund_amount: 42000,
  }));
  assert.deepEqual([result.customerFee, result.soloRefundAmount, result.otherRefundAmount, result.netAmount],
    [4200, 42000, 0, 46200]);

  const legacy = getMasterLedgerPaymentBreakdown(booking({
    status: 'completed', amount: 88200, price_at_booking: 42000, total_price: 42000,
    solo_guarantee_price: 42000, solo_guarantee_refund_status: 'refunded',
    solo_guarantee_refund_amount: 42000, refund_amount: 0,
  }));
  assert.deepEqual([legacy.refundAmount, legacy.soloRefundAmount, legacy.netAmount],
    [42000, 42000, 46200]);
});

test('shows full and partial booking refunds from cumulative refund_amount', () => {
  const full = getMasterLedgerPaymentBreakdown(booking({ status: 'cancelled', refund_amount: 41800 }));
  assert.deepEqual([full.otherRefundAmount, full.netAmount], [41800, 0]);

  const partial = getMasterLedgerPaymentBreakdown(booking({
    status: 'cancelled', amount: 46200, price_at_booking: 42000,
    total_price: 42000, refund_amount: 32339,
  }));
  assert.deepEqual([partial.otherRefundAmount, partial.netAmount], [32339, 13861]);
});

test('keeps historical subtotal and guest count without fabricating a unit price or fee', () => {
  const legacy = getMasterLedgerPaymentBreakdown(booking({
    status: 'cancelled', guests: 2, price_at_booking: 0,
    total_price: 76000, amount: 83600,
  }));
  assert.deepEqual([legacy.subtotal, legacy.guestCount, legacy.customerFee], [76000, 2, null]);

  const privateBooking = getMasterLedgerPaymentBreakdown(booking({ type: 'private', guests: 2 }));
  assert.deepEqual([privateBooking.subtotal, privateBooking.guestCount], [38000, 2]);

  const unexplainedAmount = getMasterLedgerPaymentBreakdown(booking({ amount: 39000 }));
  assert.equal(unexplainedAmount.customerFee, null);

  const missingSnapshot = getMasterLedgerPaymentBreakdown(booking({
    status: 'cancelled', price_at_booking: 0, total_price: 0,
  }));
  assert.deepEqual([missingSnapshot.subtotal, missingSnapshot.guestCount, missingSnapshot.customerFee],
    [null, 1, null]);
});

test('pending manual solo refund is not treated as money already returned', () => {
  const result = getMasterLedgerPaymentBreakdown(booking({
    status: 'completed', amount: 88200, price_at_booking: 42000,
    total_price: 42000, solo_guarantee_price: 42000,
    solo_guarantee_refund_status: 'pending_manual',
    solo_guarantee_refund_amount: 42000, refund_amount: 0,
  }));
  assert.deepEqual([result.soloRefundAmount, result.refundAmount, result.netAmount], [0, 0, 88200]);
});
