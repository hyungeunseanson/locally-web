import { getBookingReviewEligibleAt } from '@/app/utils/reviews/reviewEligibility';

export const GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_CUTOFF = '2026-09-16T23:40:00+09:00';
export const GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_SOURCE = 'review_request_email_backfill_20260916';
export const GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_ACTION = 'review_request_email_backfill_sent';
export const GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_MAX_BOOKINGS = 5;
export const GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_MAX_CUSTOMERS = 3;

export type HistoricalReviewRequestBooking = {
  id: string;
  userId: string;
  experienceId: string;
  experienceTitle: string;
  date: string | null;
  time: string | null;
  duration: number | string | null;
  status: string;
};

export type HistoricalReviewRequestRepresentative = HistoricalReviewRequestBooking & {
  eligibleAt: number;
};

export type HistoricalReviewRequestBackfillPlan = {
  eligibleBookingCount: number;
  uniqueCustomerCount: number;
  alreadyMarkedCustomerCount: number;
  skippedReviewedCount: number;
  representatives: HistoricalReviewRequestRepresentative[];
};

export function buildHistoricalReviewRequestBackfillPlan(params: {
  bookings: HistoricalReviewRequestBooking[];
  reviewedBookingIds: Set<string>;
  markedUserIds: Set<string>;
  cutoff?: string;
}): HistoricalReviewRequestBackfillPlan {
  const cutoffTimestamp = Date.parse(
    params.cutoff ?? GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_CUTOFF
  );
  if (!Number.isFinite(cutoffTimestamp)) {
    throw new Error('Historical review request email cutoff is invalid.');
  }

  let skippedReviewedCount = 0;
  const eligible = params.bookings.flatMap<HistoricalReviewRequestRepresentative>((booking) => {
    if (
      booking.status !== 'completed' ||
      !booking.userId ||
      !booking.experienceId ||
      params.reviewedBookingIds.has(booking.id)
    ) {
      if (params.reviewedBookingIds.has(booking.id)) skippedReviewedCount += 1;
      return [];
    }

    const eligibleAt = getBookingReviewEligibleAt({
      date: booking.date,
      time: booking.time,
      duration: booking.duration,
    });
    if (eligibleAt == null || eligibleAt > cutoffTimestamp) return [];

    return [{ ...booking, eligibleAt }];
  });

  const representativeByUser = new Map<string, HistoricalReviewRequestRepresentative>();
  for (const booking of eligible) {
    const current = representativeByUser.get(booking.userId);
    if (
      !current ||
      booking.eligibleAt > current.eligibleAt ||
      (booking.eligibleAt === current.eligibleAt && booking.id > current.id)
    ) {
      representativeByUser.set(booking.userId, booking);
    }
  }

  const representatives = [...representativeByUser.values()]
    .filter((booking) => !params.markedUserIds.has(booking.userId))
    .sort((left, right) => left.userId.localeCompare(right.userId));

  return {
    eligibleBookingCount: eligible.length,
    uniqueCustomerCount: representativeByUser.size,
    alreadyMarkedCustomerCount: [...representativeByUser.keys()]
      .filter((userId) => params.markedUserIds.has(userId)).length,
    skippedReviewedCount,
    representatives,
  };
}

export function assertHistoricalReviewRequestBackfillSafety(
  plan: HistoricalReviewRequestBackfillPlan
) {
  if (
    plan.eligibleBookingCount > GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_MAX_BOOKINGS ||
    plan.uniqueCustomerCount > GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_MAX_CUSTOMERS
  ) {
    throw new Error('Historical review request email backfill exceeds the approved safety bound.');
  }
}

export async function executeHistoricalReviewRequestBackfill(params: {
  plan: HistoricalReviewRequestBackfillPlan;
  apply: boolean;
  isMarked: (userId: string) => Promise<boolean>;
  hasReview: (bookingId: string) => Promise<boolean>;
  sendEmail: (booking: HistoricalReviewRequestRepresentative) => Promise<{ sent: boolean }>;
  recordMarker: (booking: HistoricalReviewRequestRepresentative) => Promise<void>;
}) {
  assertHistoricalReviewRequestBackfillSafety(params.plan);

  const summary = {
    attemptedCustomers: 0,
    sentCustomers: 0,
    failedCustomers: 0,
    skippedReviewed: 0,
    skippedAlreadyMarked: params.plan.alreadyMarkedCustomerCount,
  };

  if (!params.apply) return summary;

  for (const booking of params.plan.representatives) {
    try {
      if (await params.isMarked(booking.userId)) {
        summary.skippedAlreadyMarked += 1;
        continue;
      }
      if (await params.hasReview(booking.id)) {
        summary.skippedReviewed += 1;
        continue;
      }

      summary.attemptedCustomers += 1;
      const result = await params.sendEmail(booking);
      if (!result.sent) {
        summary.failedCustomers += 1;
        continue;
      }

      await params.recordMarker(booking);
      summary.sentCustomers += 1;
    } catch {
      summary.failedCustomers += 1;
    }
  }

  return summary;
}
