import type { SupabaseClient } from '@supabase/supabase-js';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import type {
  ExperienceCalendarDayStatus,
  ExperienceAvailabilitySummary,
  ExperienceSlotSummary,
} from '@/app/experiences/[id]/types';

type AvailabilityRow = {
  date: string;
  start_time: string;
};

type BookingRow = {
  date: string;
  time: string;
  guests: number | null;
  type: string | null;
};

type BuildExperienceAvailabilitySummaryInput = {
  availabilityRows: AvailabilityRow[];
  bookingRows: BookingRow[];
  maxGuests: number;
};

type BookingAggregate = {
  confirmedGuestCount: number;
  hasConfirmedPrivateBooking: boolean;
};

function normalizeTime(value: string | null | undefined) {
  return String(value || '').slice(0, 5);
}

function getSlotKey(date: string, time: string) {
  return `${date}_${normalizeTime(time)}`;
}

export function buildExperienceAvailabilitySummary({
  availabilityRows,
  bookingRows,
  maxGuests,
}: BuildExperienceAvailabilitySummaryInput): ExperienceAvailabilitySummary {
  const normalizedMaxGuests = Math.max(1, Number(maxGuests || 10));
  const dateToTimeMap: Record<string, string[]> = {};
  const calendarDayStatusMap: Record<string, ExperienceCalendarDayStatus> = {};
  const slotSummaryMap: Record<string, ExperienceSlotSummary> = {};
  const bookingAggregateMap = new Map<string, BookingAggregate>();

  for (const booking of bookingRows) {
    const date = String(booking.date || '');
    const time = normalizeTime(booking.time);
    if (!date || !time) continue;

    const slotKey = getSlotKey(date, time);
    const currentAggregate = bookingAggregateMap.get(slotKey) || {
      confirmedGuestCount: 0,
      hasConfirmedPrivateBooking: false,
    };

    currentAggregate.confirmedGuestCount += Number(booking.guests || 0);
    if (booking.type === 'private') {
      currentAggregate.hasConfirmedPrivateBooking = true;
    }

    bookingAggregateMap.set(slotKey, currentAggregate);
  }

  for (const availability of availabilityRows) {
    const date = String(availability.date || '');
    const time = normalizeTime(availability.start_time);
    if (!date || !time) continue;

    const slotKey = getSlotKey(date, time);
    const aggregate = bookingAggregateMap.get(slotKey) || {
      confirmedGuestCount: 0,
      hasConfirmedPrivateBooking: false,
    };
    const rawRemainingSeats = normalizedMaxGuests - aggregate.confirmedGuestCount;
    const soldOutReason = aggregate.hasConfirmedPrivateBooking
      ? 'private_booked'
      : rawRemainingSeats <= 0
        ? 'capacity_full'
        : undefined;
    const isBookable = !soldOutReason;
    const remainingSeats = isBookable ? Math.max(0, rawRemainingSeats) : 0;

    if (!dateToTimeMap[date]) {
      dateToTimeMap[date] = [];
    }

    if (!dateToTimeMap[date].includes(time)) {
      dateToTimeMap[date].push(time);
    }

    if (!calendarDayStatusMap[date]) {
      calendarDayStatusMap[date] = 'sold_out';
    }
    if (isBookable) {
      calendarDayStatusMap[date] = 'available';
    }

    slotSummaryMap[slotKey] = {
      remainingSeats,
      confirmedGuestCount: aggregate.confirmedGuestCount,
      hasConfirmedPrivateBooking: aggregate.hasConfirmedPrivateBooking,
      isBookable,
      soldOutReason,
      soloGuaranteeEligible: isBookable && aggregate.confirmedGuestCount === 0,
    };
  }

  const sortedDateToTimeMap = Object.fromEntries(
    Object.entries(dateToTimeMap)
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([date, times]) => [date, [...times].sort((left, right) => left.localeCompare(right))])
  );

  return {
    availableDates: Object.keys(sortedDateToTimeMap),
    dateToTimeMap: sortedDateToTimeMap,
    calendarDayStatusMap,
    slotSummaryMap,
  };
}

export async function fetchExperienceAvailabilitySummary(
  supabase: SupabaseClient,
  experienceId: string | number,
  maxGuests: number
) {
  const today = new Date().toISOString().slice(0, 10);
  const [availabilityResult, bookingsResult] = await Promise.all([
    supabase
      .from('experience_availability')
      .select('date, start_time')
      .eq('experience_id', experienceId)
      .eq('is_booked', false)
      .gte('date', today),
    supabase
      .from('bookings')
      .select('date, time, guests, type')
      .eq('experience_id', experienceId)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]),
  ]);

  if (availabilityResult.error) {
    throw availabilityResult.error;
  }

  if (bookingsResult.error) {
    throw bookingsResult.error;
  }

  return buildExperienceAvailabilitySummary({
    availabilityRows: (availabilityResult.data || []) as AvailabilityRow[],
    bookingRows: (bookingsResult.data || []) as BookingRow[],
    maxGuests,
  });
}
