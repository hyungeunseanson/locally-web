import { NextResponse } from 'next/server';
import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  getExpiredPendingBookingCancelReason,
  getPendingBookingExpiryCutoff,
} from '@/app/utils/bookings/pendingBookingHolds';

export async function GET(request: Request) {
  // [M-2] Auto Cancel Scheduler
  // Secure this endpoint with a secret key
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Find pending bookings older than 2 hours
    const { data: expiredBookings, error } = await supabase
      .from('bookings')
      .select('id, created_at, payment_method')
      .eq('status', 'PENDING')
      .is('tid', null)
      .lt('created_at', getPendingBookingExpiryCutoff());

    if (error) throw error;

    if (!expiredBookings || expiredBookings.length === 0) {
      return NextResponse.json({ message: 'No expired bookings found' });
    }

    const expiredIdsByReason = expiredBookings.reduce<Map<string, Array<string | number>>>(
      (groups, booking) => {
        const reason = getExpiredPendingBookingCancelReason(booking.payment_method);
        const ids = groups.get(reason) || [];
        ids.push(booking.id);
        groups.set(reason, ids);
        return groups;
      },
      new Map()
    );

    const cancelExpiredBookings = async (ids: Array<string | number>, cancelReason: string) => {
      if (ids.length === 0) return;

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancel_reason: cancelReason,
          refund_amount: 0,
        })
        .in('id', ids)
        .eq('status', 'PENDING')
        .is('tid', null);

      if (updateError) throw updateError;
    };

    for (const [cancelReason, ids] of expiredIdsByReason) {
      await cancelExpiredBookings(ids, cancelReason);
    }

    const expiredIds = expiredBookings.map((booking) => booking.id);

    console.log(`[CRON] Auto-cancelled ${expiredIds.length} pending bookings.`);

    return NextResponse.json({ success: true, count: expiredIds.length, ids: expiredIds });
  } catch (err: unknown) {
    console.error('[CRON] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown cron error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
