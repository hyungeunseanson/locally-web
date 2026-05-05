import { isCancelledOnlyBookingStatus, isCompletedBookingStatus } from '@/app/constants/bookingStatus';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';

import type {
  HostExperienceEarningsSummary,
  HostServiceEarningsSummary,
  HostSettlementStage,
  HostUnifiedEarningsSummary,
} from '@/app/types/hostEarnings';

type ExperienceSummaryBookingRow = {
  amount?: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  created_at: string;
  date?: string | null;
  status: string;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  price_at_booking?: number | null;
  solo_guarantee_price?: number | null;
  solo_guarantee_refund_status?: string | null;
  solo_guarantee_refund_amount?: number | null;
  refund_amount?: number | null;
  payout_status?: string | null;
  payout_paid_at?: string | null;
};

type ServiceSummaryBookingRow = {
  host_payout_amount: number | null;
  payout_paid_at: string | null;
  payout_status: string | null;
  status: string;
};

function getLatestPaidAt(current: string | null, next: string | null) {
  if (!next) return current;
  if (!current || next > current) return next;
  return current;
}

export function getExperienceSettlementStage(
  booking: ExperienceSummaryBookingRow
): HostSettlementStage | null {
  const payout = getBookingHostPayout(booking);
  const status = String(booking.status || '').toLowerCase();

  if (booking.payout_status === 'paid') {
    return 'paid';
  }

  if (isCompletedBookingStatus(status)) {
    return 'pending';
  }

  if (isCancelledOnlyBookingStatus(status)) {
    return payout > 0 ? 'pending' : null;
  }

  if (status === 'paid' || status === 'confirmed') {
    return 'in_progress';
  }

  return null;
}

export function buildExperienceEarningsSummary(
  bookings: ExperienceSummaryBookingRow[]
): HostExperienceEarningsSummary {
  return bookings.reduce<HostExperienceEarningsSummary>(
    (acc, booking) => {
      const settlementStage = getExperienceSettlementStage(booking);
      if (!settlementStage) {
        return acc;
      }

      const payoutAmount = getBookingHostPayout(booking);
      acc.total_payout_amount += payoutAmount;
      acc.payout_item_count += 1;

      if (isCompletedBookingStatus(booking.status)) {
        acc.completed_booking_count += 1;
      }

      if (settlementStage === 'pending') {
        acc.pending_payout_amount += payoutAmount;
      } else if (settlementStage === 'in_progress') {
        acc.in_progress_amount += payoutAmount;
      } else {
        acc.paid_payout_amount += payoutAmount;
        acc.latest_paid_at = getLatestPaidAt(acc.latest_paid_at, booking.payout_paid_at || null);
      }

      return acc;
    },
    {
      pending_payout_amount: 0,
      in_progress_amount: 0,
      paid_payout_amount: 0,
      payout_item_count: 0,
      completed_booking_count: 0,
      latest_paid_at: null,
      total_payout_amount: 0,
    }
  );
}

export function getServiceSettlementStage(
  booking: Pick<ServiceSummaryBookingRow, 'status' | 'payout_status'>
): HostSettlementStage {
  if (booking.payout_status === 'paid') {
    return 'paid';
  }

  if (String(booking.status || '').toLowerCase() === 'completed') {
    return 'pending';
  }

  return 'in_progress';
}

export function buildServiceEarningsSummary(
  bookings: ServiceSummaryBookingRow[]
): HostServiceEarningsSummary {
  return bookings.reduce<HostServiceEarningsSummary>(
    (acc, booking) => {
      const payoutAmount = Number(booking.host_payout_amount || 0);
      if (payoutAmount <= 0) {
        return acc;
      }

      const settlementStage = getServiceSettlementStage(booking);
      acc.total_payout_amount += payoutAmount;
      acc.payout_item_count += 1;

      if (String(booking.status || '').toLowerCase() === 'completed') {
        acc.completed_service_count += 1;
      }

      if (settlementStage === 'pending') {
        acc.pending_payout_amount += payoutAmount;
      } else if (settlementStage === 'in_progress') {
        acc.in_progress_amount += payoutAmount;
      } else {
        acc.paid_payout_amount += payoutAmount;
        acc.latest_paid_at = getLatestPaidAt(acc.latest_paid_at, booking.payout_paid_at || null);
      }

      return acc;
    },
    {
      pending_payout_amount: 0,
      in_progress_amount: 0,
      paid_payout_amount: 0,
      completed_service_count: 0,
      payout_item_count: 0,
      latest_paid_at: null,
      total_payout_amount: 0,
    }
  );
}

export function buildUnifiedEarningsSummary(
  experience: HostExperienceEarningsSummary,
  service: HostServiceEarningsSummary
): HostUnifiedEarningsSummary {
  return {
    total_pending_payout_amount:
      experience.pending_payout_amount + service.pending_payout_amount,
    total_in_progress_amount:
      experience.in_progress_amount + service.in_progress_amount,
    total_paid_amount: experience.paid_payout_amount + service.paid_payout_amount,
    latest_paid_at: getLatestPaidAt(experience.latest_paid_at, service.latest_paid_at),
    experience,
    service,
  };
}
