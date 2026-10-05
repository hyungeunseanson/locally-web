// Compare every value used by cancellation arithmetic while taking the common
// DB lock. A stale pre-read returns a conflict before any provider call.
export function bookingCancellationSnapshot(booking: Record<string, unknown>) {
  const numericFields = new Set(['amount', 'total_price', 'total_experience_price', 'refund_amount',
    'solo_guarantee_price', 'solo_guarantee_refund_amount']);
  return Object.fromEntries(['status', 'amount', 'total_price', 'total_experience_price',
    'refund_amount', 'solo_guarantee_price', 'solo_guarantee_refund_amount',
    'solo_guarantee_refund_status', 'payout_status', 'payment_method', 'tid', 'date', 'time']
    .filter(key => Object.hasOwn(booking, key)).map(key => [key,
      numericFields.has(key) && booking[key] != null ? Number(booking[key]) : booking[key]]));
}
