import { NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
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
      .select('id, date, time, status')
      .eq('user_id', user.id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    if (error) throw error;

    const now = new Date();
    const bookingIdsToComplete = (bookings || [])
      .filter((booking) => {
        const experienceDate = new Date(`${booking.date}T${booking.time || '00:00'}`);
        return experienceDate < now;
      })
      .map((booking) => booking.id);

    if (bookingIdsToComplete.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, updatedIds: [] });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('user_id', user.id)
      .in('id', bookingIdsToComplete);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      updatedCount: bookingIdsToComplete.length,
      updatedIds: bookingIdsToComplete,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[guest/trips/sync-completed] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
