type BookingFinanceInput = {
  amount?: number | string | null;
  total_price?: number | string | null;
  total_experience_price?: number | string | null;
  host_payout_amount?: number | string | null;
  platform_revenue?: number | string | null;
  price_at_booking?: number | string | null;
  solo_guarantee_price?: number | string | null;
  solo_guarantee_refund_status?: string | null;
  solo_guarantee_refund_amount?: number | string | null;
  refund_amount?: number | string | null;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getStoredExperienceAmount = (booking: BookingFinanceInput) => {
  if (booking.total_experience_price != null) {
    return toNumber(booking.total_experience_price);
  }

  if (booking.total_price != null) {
    return toNumber(booking.total_price);
  }

  return null;
};

const getStoredPriceAtBookingWithSoloGuarantee = (booking: BookingFinanceInput) => {
  const priceAtBooking = toNullableNumber(booking.price_at_booking);
  if (priceAtBooking == null) {
    return null;
  }

  return Math.max(0, priceAtBooking + getBookingNetSoloGuaranteePrice(booking));
};

export function getBookingRefundLiabilityAmount(booking: BookingFinanceInput) {
  return Math.max(
    toNumber(booking.refund_amount),
    toNumber(booking.solo_guarantee_refund_amount)
  );
}

export function getBookingNetPaidAmount(booking: BookingFinanceInput) {
  return Math.max(0, getBookingPaidAmount(booking) - getBookingRefundLiabilityAmount(booking));
}

export function getBookingNetSoloGuaranteePrice(booking: BookingFinanceInput) {
  return Math.max(
    0,
    toNumber(booking.solo_guarantee_price) - toNumber(booking.solo_guarantee_refund_amount)
  );
}

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

  const storedExperienceAmount = getStoredExperienceAmount(booking);
  if (storedExperienceAmount == null || storedExperienceAmount <= 0) {
    return null;
  }

  return Math.max(0, storedExperienceAmount - getBookingNetSoloGuaranteePrice(booking));
}

export function getBookingHostPayout(booking: BookingFinanceInput) {
  if (booking.host_payout_amount != null) {
    return toNumber(booking.host_payout_amount);
  }

  const paidAmount = toNullableNumber(booking.amount);
  const platformRevenue = toNullableNumber(booking.platform_revenue);
  if (paidAmount != null && platformRevenue != null) {
    return Math.max(
      0,
      Math.floor(paidAmount - getBookingRefundLiabilityAmount(booking) - platformRevenue)
    );
  }

  const storedExperienceAmount = getStoredExperienceAmount(booking);
  if (storedExperienceAmount != null && storedExperienceAmount > 0) {
    return Math.floor(storedExperienceAmount * 0.8);
  }

  const storedBasePlusSolo = getStoredPriceAtBookingWithSoloGuarantee(booking);
  if (storedBasePlusSolo != null && storedBasePlusSolo > 0) {
    return Math.floor(storedBasePlusSolo * 0.8);
  }

  return Math.floor(getBookingPaidAmount(booking) * 0.8);
}

export function getBookingPlatformRevenue(booking: BookingFinanceInput) {
  if (booking.platform_revenue != null) {
    return toNumber(booking.platform_revenue);
  }

  return Math.max(
    0,
    getBookingPaidAmount(booking) - getBookingRefundLiabilityAmount(booking) - getBookingHostPayout(booking)
  );
}

export function getBookingSettlementSnapshot(booking: BookingFinanceInput) {
  const paidAmount = getBookingPaidAmount(booking);
  const totalExperiencePrice = getBookingExperienceAmount(booking) || paidAmount;
  const basePrice = getBookingBasePrice({
    ...booking,
    total_experience_price: totalExperiencePrice,
  }) ?? Math.max(0, totalExperiencePrice - getBookingNetSoloGuaranteePrice(booking));
  const hostPayout = booking.host_payout_amount != null
    ? toNumber(booking.host_payout_amount)
    : Math.floor(totalExperiencePrice * 0.8);
  const platformRevenue = booking.platform_revenue != null
    ? toNumber(booking.platform_revenue)
    : Math.max(0, paidAmount - getBookingRefundLiabilityAmount(booking) - hostPayout);

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
  const grossPaidAmount = getBookingPaidAmount(booking);
  const priorRefundAmount = Math.max(0, toNumber(booking.refund_amount));
  const netPaidAmount = Math.max(0, grossPaidAmount - priorRefundAmount);
  const reservedSoloRefundAmount = Math.max(0, toNumber(booking.solo_guarantee_refund_amount));
  const unpaidReservedSoloRefundAmount = Math.max(0, reservedSoloRefundAmount - priorRefundAmount);
  // [Guard] 레거시 데이터 방어: totalExperienceAmount가 실결제액을 초과하면 hostPayout 오버플로 발생
  const totalExperienceAmount = Math.min(
    getBookingExperienceAmount(booking) + unpaidReservedSoloRefundAmount,
    netPaidAmount
  );
  const guestFeeAmount = Math.max(0, netPaidAmount - totalExperienceAmount);

  const refundedExperienceAmount = Math.floor(totalExperienceAmount * (clampedRefundRate / 100));
  const refundedGuestFeeAmount = Math.floor(guestFeeAmount * (clampedRefundRate / 100));
  const refundAmount = Math.min(netPaidAmount, refundedExperienceAmount + refundedGuestFeeAmount);
  const cumulativeRefundAmount = Math.min(grossPaidAmount, priorRefundAmount + refundAmount);

  const retainedExperienceAmount = Math.max(0, totalExperienceAmount - refundedExperienceAmount);
  const hostPayout = Math.floor(retainedExperienceAmount * 0.8);
  const platformRevenue = Math.max(0, grossPaidAmount - cumulativeRefundAmount - hostPayout);

  return {
    refundAmount,
    cumulativeRefundAmount,
    hostPayout,
    platformRevenue,
    retainedExperienceAmount,
    totalPaidAmount: grossPaidAmount,
    netPaidAmount,
    priorRefundAmount,
    totalExperienceAmount,
  };
}
