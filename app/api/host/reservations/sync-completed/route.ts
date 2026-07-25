import { NextRequest, NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { completeExperienceBookingsIfDueAtomic } from '@/app/utils/bookings/completeExperienceBooking';
import { processSoloGuaranteeRefundsForCompletedBookings } from '@/app/utils/bookings/soloGuaranteeRefund';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type HostReservationSyncBody = {
  bookingIds?: unknown;
};

function normalizeBookingIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((entry) => (typeof entry === 'string' || typeof entry === 'number' ? String(entry).trim() : ''))
      .filter(Boolean)
  )].slice(0, 50);
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
      .select('id, experiences!inner(host_id)')
      .eq('experiences.host_id', user.id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    if (bookingIds.length > 0) {
      query = query.in('id', bookingIds);
    }

    const { data: bookingRows, error: bookingRowsError } = await query;
    if (bookingRowsError) throw bookingRowsError;

    if (!bookingRows || bookingRows.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, updatedIds: [] as string[] });
    }

    const completionBatch = await completeExperienceBookingsIfDueAtomic(
      supabaseAdmin,
      bookingRows.map((booking) => String(booking.id))
    );
    const completedBookingIds = completionBatch.results
      .filter((result) => result.completed)
      .map((result) => result.bookingId);

    try {
      await processSoloGuaranteeRefundsForCompletedBookings({
        supabaseAdmin,
        completedBookingIds,
      });
    } catch (refundError) {
      console.error('[host/reservations/sync-completed] solo guarantee refund processing failed:', refundError);
    }

    if (completionBatch.failures.length > 0) {
      throw completionBatch.failures[0].error;
    }

    return NextResponse.json({
      success: true,
      updatedCount: completedBookingIds.length,
      updatedIds: completedBookingIds,
    });
  } catch (error) {
    console.error('[host/reservations/sync-completed] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync completed reservations.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
