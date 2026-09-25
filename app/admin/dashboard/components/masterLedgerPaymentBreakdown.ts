import type { AdminMasterLedgerEntry } from '@/app/types/admin';

type PaymentFields = Pick<
  AdminMasterLedgerEntry,
  | '_type'
  | 'guests'
  | 'amount'
  | 'price_at_booking'
  | 'total_price'
  | 'solo_guarantee_price'
  | 'solo_guarantee_refund_status'
  | 'solo_guarantee_refund_amount'
  | 'refund_amount'
>;

function nonNegativeAmount(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function getMasterLedgerPaymentBreakdown(booking: PaymentFields) {
  const originalAmount = nonNegativeAmount(booking.amount);
  const recordedRefundAmount = nonNegativeAmount(booking.refund_amount) ?? 0;
  const guestCount = Number(booking.guests);
  const validGuestCount = Number.isInteger(guestCount) && guestCount > 0 ? guestCount : null;
  const soloGuaranteePrice = booking._type === 'experience'
    ? nonNegativeAmount(booking.solo_guarantee_price) ?? 0
    : 0;
  const savedSubtotal = booking._type === 'experience'
    ? nonNegativeAmount(booking.price_at_booking)
    : null;
  const savedTourTotal = booking._type === 'experience'
    ? nonNegativeAmount(booking.total_price)
    : null;

  // The confirmed base subtotal is the best snapshot. Before confirmation it can be
  // zero, so use the stored tour total only when no solo refund has changed it.
  const subtotal = savedSubtotal != null && savedSubtotal > 0
    ? savedSubtotal
    : savedTourTotal != null && savedTourTotal > 0 && savedTourTotal >= soloGuaranteePrice &&
        booking.solo_guarantee_refund_status !== 'refunded'
      ? savedTourTotal - soloGuaranteePrice
      : null;

  const feeRemainder = originalAmount != null && subtotal != null
    ? originalAmount - subtotal - soloGuaranteePrice
    : null;
  const customerFee = savedSubtotal != null && savedSubtotal > 0 && subtotal != null &&
    feeRemainder != null && feeRemainder === Math.floor(subtotal * 0.1)
    ? feeRemainder
    : null;

  const recordedSoloRefund = booking.solo_guarantee_refund_status === 'refunded'
    ? nonNegativeAmount(booking.solo_guarantee_refund_amount) ?? 0
    : 0;
  // refund_amount is cumulative when populated. Some older rows only retain the
  // solo refund amount, so take the larger recorded liability, never their sum.
  const refundAmount = Math.max(recordedRefundAmount, recordedSoloRefund);
  const soloRefundAmount = recordedSoloRefund;
  const otherRefundAmount = refundAmount > 0 ? refundAmount - soloRefundAmount : 0;
  const netAmount = originalAmount != null && refundAmount <= originalAmount
    ? originalAmount - refundAmount
    : null;

  return {
    subtotal,
    guestCount: validGuestCount,
    soloGuaranteePrice,
    customerFee,
    originalAmount,
    refundAmount,
    soloRefundAmount,
    otherRefundAmount,
    netAmount,
  };
}
