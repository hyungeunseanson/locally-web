import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';

const DAY_MS = 1000 * 60 * 60 * 24;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ACTIVE_BOOKING_STATUS_SET = new Set(
  BOOKING_ACTIVE_STATUS_FOR_CAPACITY.map((status) => status.toLowerCase())
);

type BookingDateParts = {
  year: number;
  monthIndex: number;
  day: number;
};

type BookingTimeParts = {
  hours: number;
  minutes: number;
  seconds: number;
};

function parseBookingDateParts(dateValue: string): BookingDateParts | null {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return {
    year,
    monthIndex: month - 1,
    day,
  };
}

function parseBookingTimeParts(timeValue?: string | null): BookingTimeParts {
  const normalized = typeof timeValue === 'string' ? timeValue.trim() : '';
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || '0');

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }

  return { hours, minutes, seconds };
}

export function getBookingCalendarDate(dateValue: string): Date | null {
  const parts = parseBookingDateParts(dateValue);
  if (!parts) return null;

  // Use local noon so month/day display stays stable without affecting KST comparisons.
  return new Date(parts.year, parts.monthIndex, parts.day, 12, 0, 0, 0);
}

function getKstCalendarDayStamp(dateValue: Date) {
  const shifted = new Date(dateValue.getTime() + KST_OFFSET_MS);
  return Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
}

export function getBookingStartTimestamp(dateValue: string, timeValue?: string | null): number | null {
  const dateParts = parseBookingDateParts(dateValue);
  if (!dateParts) return null;

  const timeParts = parseBookingTimeParts(timeValue);

  return Date.UTC(
    dateParts.year,
    dateParts.monthIndex,
    dateParts.day,
    timeParts.hours - 9,
    timeParts.minutes,
    timeParts.seconds,
    0
  );
}

export function getBookingStartDateTime(dateValue: string, timeValue?: string | null): Date | null {
  const startTimestamp = getBookingStartTimestamp(dateValue, timeValue);
  if (startTimestamp == null) return null;

  return new Date(startTimestamp);
}

export function hasBookingStarted(dateValue: string, timeValue?: string | null, now = new Date()) {
  const startTimestamp = getBookingStartTimestamp(dateValue, timeValue);
  if (startTimestamp == null) return false;

  return startTimestamp <= now.getTime();
}

export function getBookingCalendarDayDiff(dateValue: string, now = new Date()) {
  const dateParts = parseBookingDateParts(dateValue);
  if (!dateParts) return null;

  const targetDayStamp = Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day);
  const todayStamp = getKstCalendarDayStamp(now);
  return Math.round((targetDayStamp - todayStamp) / DAY_MS);
}

export function isActiveBookingStatusForCompletionSync(status: string) {
  return ACTIVE_BOOKING_STATUS_SET.has((status || '').toLowerCase());
}

export function isOverdueActiveBooking(status: string, dateValue: string, timeValue?: string | null, now = new Date()) {
  return isActiveBookingStatusForCompletionSync(status) && hasBookingStarted(dateValue, timeValue, now);
}

export function getEffectiveCompletedStatus(status: string, dateValue: string, timeValue?: string | null, now = new Date()) {
  return isOverdueActiveBooking(status, dateValue, timeValue, now) ? 'completed' : status;
}
