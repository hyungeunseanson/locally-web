import { NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { completeExperienceBookingsIfDueAtomic } from '@/app/utils/bookings/completeExperienceBooking';
import { processSoloGuaranteeRefundsForCompletedBookings } from '@/app/utils/bookings/soloGuaranteeRefund';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient } from '@/app/utils/supabase/server';

export async function POST() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', user.id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, updatedIds: [] });
    }

    const supabaseAdmin = createAdminClient();
    const completionBatch = await completeExperienceBookingsIfDueAtomic(
      supabaseAdmin,
      bookings.map((booking) => String(booking.id))
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
      console.error('[guest/trips/sync-completed] solo guarantee refund processing failed:', refundError);
    }

    if (completionBatch.failures.length > 0) {
      throw completionBatch.failures[0].error;
    }

    return NextResponse.json({
      success: true,
      updatedCount: completedBookingIds.length,
      updatedIds: completedBookingIds,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[guest/trips/sync-completed] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
