export const EXPERIENCE_PAYOUT_THRESHOLD_KRW = 100000;
export const EXPERIENCE_PAYOUT_LONG_HOLD_DAYS = 90;

export type ExperiencePayoutQueueState = 'eligible' | 'hold' | 'long_hold' | 'refund_hold' | 'completed';

export function getExperiencePayoutQueueState(params: {
  pendingAmount: number;
  oldestPendingCreatedAt: string | null;
}): ExperiencePayoutQueueState {
  if (params.pendingAmount >= EXPERIENCE_PAYOUT_THRESHOLD_KRW) {
    return 'eligible';
  }

  if (params.oldestPendingCreatedAt) {
    const pendingDays = Math.floor(
      (Date.now() - new Date(params.oldestPendingCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (pendingDays >= EXPERIENCE_PAYOUT_LONG_HOLD_DAYS) {
      return 'long_hold';
    }
  }

  return 'hold';
}
