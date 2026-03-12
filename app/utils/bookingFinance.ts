type BookingFinanceInput = {
  amount?: number | string | null;
  total_price?: number | string | null;
  total_experience_price?: number | string | null;
  host_payout_amount?: number | string | null;
  platform_revenue?: number | string | null;
  price_at_booking?: number | string | null;
  solo_guarantee_price?: number | string | null;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getBookingPaidAmount(booking: BookingFinanceInput) {
  return toNumber(booking.amount);
}

export function getBookingExperienceAmount(booking: BookingFinanceInput) {
  return toNumber(booking.total_experience_price) || toNumber(booking.total_price) || toNumber(booking.amount);
}

export function getBookingBasePrice(booking: BookingFinanceInput) {
  if (booking.price_at_booking != null) {
    return toNumber(booking.price_at_booking);
  }

  const experienceAmount = getBookingExperienceAmount(booking);
  if (experienceAmount <= 0) {
    return 0;
  }

  return Math.max(0, experienceAmount - toNumber(booking.solo_guarantee_price));
}

export function getBookingHostPayout(booking: BookingFinanceInput) {
  if (booking.host_payout_amount != null) {
    return toNumber(booking.host_payout_amount);
  }

  return Math.floor(getBookingExperienceAmount(booking) * 0.8);
}

export function getBookingPlatformRevenue(booking: BookingFinanceInput) {
  if (booking.platform_revenue != null) {
    return toNumber(booking.platform_revenue);
  }

  return Math.max(0, getBookingPaidAmount(booking) - getBookingHostPayout(booking));
}

export function getBookingSettlementSnapshot(booking: BookingFinanceInput) {
  const paidAmount = getBookingPaidAmount(booking);
  const totalExperiencePrice = getBookingExperienceAmount(booking) || paidAmount;
  const basePrice = getBookingBasePrice({
    ...booking,
    total_experience_price: totalExperiencePrice,
  }) || totalExperiencePrice;
  const hostPayout = booking.host_payout_amount != null
    ? toNumber(booking.host_payout_amount)
    : Math.floor(totalExperiencePrice * 0.8);
  const platformRevenue = booking.platform_revenue != null
    ? toNumber(booking.platform_revenue)
    : Math.max(0, paidAmount - hostPayout);

  return {
    basePrice,
    paidAmount,
    totalExperiencePrice,
    hostPayout,
    platformRevenue,
  };
}

export function calculateBookingCancellationSettlement(
  booking: BookingFinanceInput,
  refundRate: number
) {
  const clampedRefundRate = Math.max(0, Math.min(100, refundRate));
  const totalPaidAmount = getBookingPaidAmount(booking);
  const totalExperienceAmount = getBookingExperienceAmount(booking);
  const guestFeeAmount = Math.max(0, totalPaidAmount - totalExperienceAmount);

  const refundedExperienceAmount = Math.floor(totalExperienceAmount * (clampedRefundRate / 100));
  const refundedGuestFeeAmount = Math.floor(guestFeeAmount * (clampedRefundRate / 100));
  const refundAmount = Math.min(totalPaidAmount, refundedExperienceAmount + refundedGuestFeeAmount);

  const retainedExperienceAmount = Math.max(0, totalExperienceAmount - refundedExperienceAmount);
  const hostPayout = Math.floor(retainedExperienceAmount * 0.8);
  const platformRevenue = Math.max(0, totalPaidAmount - refundAmount - hostPayout);

  return {
    refundAmount,
    hostPayout,
    platformRevenue,
    retainedExperienceAmount,
    totalPaidAmount,
    totalExperienceAmount,
  };
}
