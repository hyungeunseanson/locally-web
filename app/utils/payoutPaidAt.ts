type PayoutPaidAtRow = Record<string, unknown>;

export function isMissingPayoutPaidAtColumnError(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: string }).message || '')
      : '';

  if (!message) return false;

  return message.includes('payout_paid_at') && (
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('Could not find')
  );
}

export function attachNullPayoutPaidAt<T extends PayoutPaidAtRow>(
  rows: readonly T[] | null | undefined
): Array<T & { payout_paid_at: null }> {
  return (rows ?? []).map((row) => ({
    ...row,
    payout_paid_at: null,
  }));
}
