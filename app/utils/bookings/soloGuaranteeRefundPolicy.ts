import {
  normalizeSoloGuaranteeRefundStatus,
  type SoloGuaranteeRefundStatus,
} from '@/app/utils/soloGuaranteeRefundStatus';
import { getBookingExperienceAmount } from '@/app/utils/bookingFinance';
import { DEFAULT_SOLO_GUARANTEE_PRICE } from '@/app/constants/soloGuarantee';

export const SOLO_GUARANTEE_REFUND_AMOUNT = DEFAULT_SOLO_GUARANTEE_PRICE;

export type SoloGuaranteeRefundSlotBooking = {
  id: string;
  order_id?: string | null;
  user_id?: string | null;
  experience_id?: number | string | null;
  date?: string | null;
  time?: string | null;
  status?: string | null;
  guests?: number | string | null;
  amount?: number | string | null;
  total_price?: number | string | null;
  total_experience_price?: number | string | null;
  price_at_booking?: number | string | null;
  solo_guarantee_price?: number | string | null;
  solo_guarantee_refund_status?: string | null;
  solo_guarantee_refund_amount?: number | string | null;
  refund_amount?: number | string | null;
  host_payout_amount?: number | string | null;
  platform_revenue?: number | string | null;
  payout_status?: string | null;
  payment_method?: string | null;
  tid?: string | null;
  experiences?: { title?: string | null; host_id?: string | null } | Array<{ title?: string | null; host_id?: string | null }> | null;
};

export type SoloGuaranteeRefundCandidate = {
  bookingId: string;
  triggerBookingId: string;
  refundAmount: number;
};

export type SoloManualRefundCompletionGuard =
  | { ok: true }
  | { ok: false; reason: 'not_waiting' | 'already_paid' | 'not_payout_pending' };

const CONFIRMED_PARTICIPANT_STATUS_SET = new Set(['paid', 'confirmed', 'completed']);
const SOLO_REFUND_AUTO_PROCESSABLE_STATUS_SET = new Set<SoloGuaranteeRefundStatus>(['not_applicable']);

export function toSoloGuaranteeRefundNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getSoloGuaranteeRefundTargetAmount(
  booking: Pick<SoloGuaranteeRefundSlotBooking, 'solo_guarantee_price'>
) {
  return Math.max(0, Math.floor(toSoloGuaranteeRefundNumber(booking.solo_guarantee_price)));
}

export function buildSoloRefundSettlementSnapshot(
  booking: SoloGuaranteeRefundSlotBooking,
  targetSoloRefundAmount: number,
  options: { existingSoloRefundAlreadyApplied?: boolean } = {}
) {
  const currentSoloRefundAmount = options.existingSoloRefundAlreadyApplied === false
    ? 0
    : toSoloGuaranteeRefundNumber(booking.solo_guarantee_refund_amount);
  const deltaSoloRefundAmount = Math.max(0, targetSoloRefundAmount - currentSoloRefundAmount);
  const currentExperienceAmount = getBookingExperienceAmount(booking);
  const nextExperienceAmount = Math.max(0, currentExperienceAmount - deltaSoloRefundAmount);
  const nextHostPayout = Math.floor(nextExperienceAmount * 0.8);
  const nextPlatformRevenue = Math.max(
    0,
    toSoloGuaranteeRefundNumber(booking.amount) - targetSoloRefundAmount - nextHostPayout
  );

  return {
    total_price: nextExperienceAmount,
    total_experience_price: nextExperienceAmount,
    host_payout_amount: nextHostPayout,
    platform_revenue: nextPlatformRevenue,
  };
}

export function getSoloManualRefundCompletionGuard(
  booking: Pick<SoloGuaranteeRefundSlotBooking, 'solo_guarantee_refund_status' | 'payout_status'>
): SoloManualRefundCompletionGuard {
  const status = normalizeSoloGuaranteeRefundStatus(booking.solo_guarantee_refund_status);

  if (status !== 'pending_manual' && status !== 'failed') {
    return { ok: false, reason: 'not_waiting' };
  }

  if (booking.payout_status === 'paid') {
    return { ok: false, reason: 'already_paid' };
  }

  if (booking.payout_status !== 'pending') {
    return { ok: false, reason: 'not_payout_pending' };
  }

  return { ok: true };
}

function normalizeStatus(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function isConfirmedParticipant(row: Pick<SoloGuaranteeRefundSlotBooking, 'status' | 'guests'>) {
  return (
    CONFIRMED_PARTICIPANT_STATUS_SET.has(normalizeStatus(row.status)) &&
    toSoloGuaranteeRefundNumber(row.guests) > 0
  );
}

function isRefundableSoloCandidate(row: SoloGuaranteeRefundSlotBooking) {
  const targetRefundAmount = getSoloGuaranteeRefundTargetAmount(row);
  const currentRefundAmount = toSoloGuaranteeRefundNumber(row.solo_guarantee_refund_amount);
  const refundStatus = normalizeSoloGuaranteeRefundStatus(row.solo_guarantee_refund_status);

  return (
    normalizeStatus(row.status) === 'completed' &&
    targetRefundAmount > 0 &&
    currentRefundAmount < targetRefundAmount &&
    SOLO_REFUND_AUTO_PROCESSABLE_STATUS_SET.has(refundStatus)
  );
}

export function findSoloGuaranteeRefundCandidatesInSlot(
  rows: SoloGuaranteeRefundSlotBooking[]
): SoloGuaranteeRefundCandidate[] {
  return rows.reduce<SoloGuaranteeRefundCandidate[]>((acc, row) => {
    if (!isRefundableSoloCandidate(row)) {
      return acc;
    }

    const trigger = rows.find((other) => other.id !== row.id && isConfirmedParticipant(other));
    if (!trigger) {
      return acc;
    }

    acc.push({
      bookingId: row.id,
      triggerBookingId: trigger.id,
      refundAmount: getSoloGuaranteeRefundTargetAmount(row),
    });
    return acc;
  }, []);
}
