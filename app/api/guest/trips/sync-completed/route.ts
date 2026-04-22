import { NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { isOverdueActiveBooking } from '@/app/utils/bookingStartTime';
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
      .filter((booking) => isOverdueActiveBooking(booking.status, booking.date, booking.time, now))
      .map((booking) => booking.id);

    if (bookingIdsToComplete.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, updatedIds: [] });
    }

    // [Safety] status precondition: SELECT와 UPDATE 사이에 취소된 예약을 completed로 덮어쓰지 않도록 방어
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('user_id', user.id)
      .in('id', bookingIdsToComplete)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

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
