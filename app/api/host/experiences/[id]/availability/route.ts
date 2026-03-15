import { NextRequest, NextResponse } from 'next/server';
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import { getRouteActor, toApiErrorResponse } from '../../shared';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RawAvailabilityBody = {
  availability?: unknown;
};

type AvailabilityMap = Record<string, string[]>;

type TimeSlotRef = {
  date: string;
  time: string;
};

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTimeValue(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function normalizeAvailabilityMap(value: unknown): AvailabilityMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid availability payload');
  }

  const next: AvailabilityMap = {};

  for (const [date, rawTimes] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidDateKey(date)) {
      throw new Error('Invalid availability date');
    }

    if (!Array.isArray(rawTimes)) {
      throw new Error('Invalid availability time list');
    }

    const normalizedTimes = Array.from(
      new Set(
        rawTimes
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      )
    ).sort();

    if (normalizedTimes.some((time) => !isValidTimeValue(time))) {
      throw new Error('Invalid availability time value');
    }

    if (normalizedTimes.length > 0) {
      next[date] = normalizedTimes;
    }
  }

  return next;
}

function buildAvailabilityMap(rows: Array<{ date: string; start_time: string }> | null): AvailabilityMap {
  const next: AvailabilityMap = {};

  for (const row of rows ?? []) {
    if (!next[row.date]) {
      next[row.date] = [];
    }
    next[row.date].push(row.start_time);
  }

  for (const date of Object.keys(next)) {
    next[date] = Array.from(new Set(next[date])).sort();
  }

  return next;
}

function buildDesiredSlotRefs(availability: AvailabilityMap) {
  return Object.entries(availability).flatMap(([date, times]) =>
    times.map((time) => ({ date, time }))
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { actor, supabaseAdmin } = await getRouteActor();
    const { id } = await context.params;
    const experienceId = Number(id);

    if (!Number.isInteger(experienceId) || experienceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid experience id' }, { status: 400 });
    }

    const body = (await request.json()) as RawAvailabilityBody;
    const desiredAvailability = normalizeAvailabilityMap(body.availability);

    const { data: experience, error: experienceError } = await supabaseAdmin
      .from('experiences')
      .select('id, host_id')
      .eq('id', experienceId)
      .maybeSingle();

    if (experienceError || !experience) {
      return NextResponse.json({ success: false, error: 'Experience not found' }, { status: 404 });
    }

    if (!actor.isAdmin && experience.host_id !== actor.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const [{ data: currentSlots, error: slotError }, { data: bookings, error: bookingError }] = await Promise.all([
      supabaseAdmin
        .from('experience_availability')
        .select('date, start_time')
        .eq('experience_id', experienceId),
      supabaseAdmin
        .from('bookings')
        .select('date, time')
        .eq('experience_id', experienceId)
        .in('status', [...BOOKING_CONFIRMED_STATUSES]),
    ]);

    if (slotError) throw slotError;
    if (bookingError) throw bookingError;

    const currentAvailability = buildAvailabilityMap(currentSlots);
    const bookedSlotKeys = new Set(
      (bookings ?? []).map((booking) => `${booking.date}_${booking.time}`)
    );
    const desiredRefs = buildDesiredSlotRefs(desiredAvailability);
    const currentRefs = buildDesiredSlotRefs(currentAvailability);
    const currentKeySet = new Set(currentRefs.map((ref) => `${ref.date}_${ref.time}`));
    const desiredKeySet = new Set(desiredRefs.map((ref) => `${ref.date}_${ref.time}`));

    const toInsert = desiredRefs
      .filter((ref) => !currentKeySet.has(`${ref.date}_${ref.time}`))
      .map((ref) => ({
        experience_id: experienceId,
        date: ref.date,
        start_time: ref.time,
        is_booked: false,
      }));

    const candidateDeletes = currentRefs.filter((ref) => !desiredKeySet.has(`${ref.date}_${ref.time}`));
    const skippedBookedDeletions: TimeSlotRef[] = [];
    const allowedDeletes: TimeSlotRef[] = [];

    for (const ref of candidateDeletes) {
      if (bookedSlotKeys.has(`${ref.date}_${ref.time}`)) {
        skippedBookedDeletions.push(ref);
      } else {
        allowedDeletes.push(ref);
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from('experience_availability').insert(toInsert);
      if (error) throw error;
    }

    let deletedCount = 0;

    for (const ref of allowedDeletes) {
      const { count, error: countError } = await supabaseAdmin
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('experience_id', experienceId)
        .eq('date', ref.date)
        .eq('time', ref.time)
        .in('status', [...BOOKING_CONFIRMED_STATUSES]);

      if (countError) throw countError;

      if ((count ?? 0) > 0) {
        skippedBookedDeletions.push(ref);
        continue;
      }

      const { error: deleteError } = await supabaseAdmin
        .from('experience_availability')
        .delete()
        .eq('experience_id', experienceId)
        .eq('date', ref.date)
        .eq('start_time', ref.time);

      if (deleteError) throw deleteError;
      deletedCount += 1;
    }

    return NextResponse.json({
      success: true,
      insertedCount: toInsert.length,
      deletedCount,
      skippedBookedDeletions,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid availability')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return toApiErrorResponse(error);
  }
}
