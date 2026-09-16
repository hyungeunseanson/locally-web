import { getBookingStartTimestamp } from '../bookingStartTime';
import { getExperienceDurationHours } from '../experienceCardDisplay';

export const REVIEW_DURATION_FALLBACK_HOURS = 2;

export type BookingReviewEligibilityInput = {
  date?: string | null;
  time?: string | null;
  duration?: number | string | null;
};

const STRICT_BOOKING_TIME_PATTERN = /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function isValidBookingDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function getBookingReviewEligibleAt(input: BookingReviewEligibilityInput) {
  const date = typeof input.date === 'string' ? input.date.trim() : '';
  const time = typeof input.time === 'string' ? input.time.trim() : '';

  if (!isValidBookingDate(date) || !STRICT_BOOKING_TIME_PATTERN.test(time)) {
    return null;
  }

  const startTimestamp = getBookingStartTimestamp(date, time);
  if (startTimestamp == null) return null;

  const normalizedDuration = getExperienceDurationHours(input.duration);
  const durationHours = normalizedDuration == null
    ? REVIEW_DURATION_FALLBACK_HOURS
    : Number(normalizedDuration);

  return startTimestamp + durationHours * 60 * 60 * 1000;
}

export function isBookingReviewEligible(
  input: BookingReviewEligibilityInput,
  now = new Date()
) {
  const eligibleAt = getBookingReviewEligibleAt(input);
  return eligibleAt != null && eligibleAt <= now.getTime();
}
