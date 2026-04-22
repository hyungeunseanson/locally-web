import { NextRequest, NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { isOverdueActiveBooking } from '@/app/utils/bookingStartTime';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type HostReservationSyncBody = {
  bookingIds?: unknown;
};

type HostReservationSyncRow = {
  id: string | number;
  date: string;
  time?: string | null;
  status: string;
};

function normalizeBookingIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((entry) => (typeof entry === 'string' || typeof entry === 'number' ? String(entry).trim() : ''))
      .filter(Boolean)
  )].slice(0, 50);
}

function normalizeReservationRows(value: unknown): HostReservationSyncRow[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<HostReservationSyncRow[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return acc;
    }

    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === 'string' || typeof candidate.id === 'number' ? candidate.id : null;
    const date = typeof candidate.date === 'string' ? candidate.date.trim() : '';
    const status = typeof candidate.status === 'string' ? candidate.status.trim() : '';
    const time = typeof candidate.time === 'string' ? candidate.time.trim() : null;

    if (!id || !date || !status) {
      return acc;
    }

    acc.push({ id, date, time, status });
    return acc;
  }, []);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = ((await request.json().catch(() => ({}))) || {}) as HostReservationSyncBody;
    const bookingIds = normalizeBookingIds(body.bookingIds);

    const supabaseAdmin = createAdminClient();
    let query = supabaseAdmin
      .from('bookings')
      .select('id, date, time, status, experiences!inner(host_id)')
      .eq('experiences.host_id', user.id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    if (bookingIds.length > 0) {
      query = query.in('id', bookingIds);
    }

    const { data: bookingRows, error: bookingRowsError } = await query;
    if (bookingRowsError) throw bookingRowsError;

    const now = new Date();
    const bookingIdsToComplete = normalizeReservationRows(bookingRows)
      .filter((booking) => isOverdueActiveBooking(booking.status, booking.date, booking.time, now))
      .map((booking) => String(booking.id));

    if (bookingIdsToComplete.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, updatedIds: [] as string[] });
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'completed' })
      .in('id', bookingIdsToComplete)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      updatedCount: bookingIdsToComplete.length,
      updatedIds: bookingIdsToComplete,
    });
  } catch (error) {
    console.error('[host/reservations/sync-completed] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync completed reservations.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
