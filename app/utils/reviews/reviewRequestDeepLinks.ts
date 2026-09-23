type BookingId = string | number | null | undefined;
export type ReviewRequestSource = 'email' | 'notification';

export function parseReviewRequestSource(value: string | null): ReviewRequestSource | null {
  return value === 'email' || value === 'notification' ? value : null;
}

function normalizeBookingId(bookingId: BookingId) {
  if (bookingId === null || bookingId === undefined) return null;
  const value = String(bookingId).trim();
  return value && value.length <= 128 ? value : null;
}

export function getGuestReviewRequestHref(bookingId: string | number, source?: string) {
  const href = `/guest/trips?reviewBookingId=${encodeURIComponent(String(bookingId))}`;
  const reviewSource = parseReviewRequestSource(source ?? null);
  return reviewSource ? `${href}&reviewSource=${reviewSource}` : href;
}

export function getHostGuestReviewRequestHref(bookingId: string | number, source?: string) {
  const href = `/host/dashboard?tab=reservations&reservationTab=completed&reviewBookingId=${encodeURIComponent(String(bookingId))}`;
  const reviewSource = parseReviewRequestSource(source ?? null);
  return reviewSource ? `${href}&reviewSource=${reviewSource}` : href;
}

export function getReviewRequestNotificationHref(notification: {
  type: string;
  booking_id?: BookingId;
  link: string;
}) {
  const bookingId = normalizeBookingId(notification.booking_id);
  if (!bookingId) return notification.link;
  if (notification.type === 'review_request') return getGuestReviewRequestHref(bookingId, 'notification');
  if (notification.type === 'guest_review_request') return getHostGuestReviewRequestHref(bookingId, 'notification');
  return notification.link;
}

export function findGuestReviewDeepLinkTrip<T extends {
  id: string | number;
  expId?: string | number | null;
  status?: string | null;
  reviewEligible?: boolean;
  hasReview?: boolean;
  review?: { id?: string | number | null } | null;
}>(trips: T[], bookingId: string | null) {
  const normalizedId = normalizeBookingId(bookingId);
  if (!normalizedId) return null;
  return trips.find((trip) =>
    String(trip.id) === normalizedId &&
    Boolean(trip.expId) &&
    trip.status?.toLowerCase() === 'completed' &&
    trip.reviewEligible === true &&
    trip.hasReview !== true &&
    !trip.review?.id
  ) ?? null;
}

export function findHostGuestReviewDeepLinkBooking<T extends {
  id: string | number;
  experience_id?: string | number | null;
  status: string;
  reviewEligible?: boolean;
}>(
  reservations: T[],
  bookingId: string | null,
  hostExperienceIds: Set<string>,
  reviewedBookingIds: Set<string>
) {
  const normalizedId = normalizeBookingId(bookingId);
  if (!normalizedId || reviewedBookingIds.has(normalizedId)) return null;
  return reservations.find((reservation) =>
    String(reservation.id) === normalizedId &&
    reservation.experience_id != null &&
    hostExperienceIds.has(String(reservation.experience_id)) &&
    reservation.status.toLowerCase() === 'completed' &&
    reservation.reviewEligible === true
  ) ?? null;
}
