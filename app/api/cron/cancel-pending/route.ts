import { NextResponse } from 'next/server';
import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
  getExpiredPendingBookingCancelReason,
  getPendingBookingExpiryCutoff,
  STALE_CARD_CHECKOUT_CANCEL_REASON,
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

    const expiryCutoff = getPendingBookingExpiryCutoff();

    // Find pending bookings older than 2 hours. Card rows are temporary payment
    // holds, while bank transfers remain real pending bookings with an audit trail.
    const { data: expiredBookings, error } = await supabase
      .from('bookings')
      .select('id, created_at, payment_method')
      .eq('status', 'PENDING')
      .is('tid', null)
      .lt('created_at', expiryCutoff);

    if (error) throw error;

    const { data: releasedCardBookings, error: releasedCardBookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'cancelled')
      .eq('payment_method', 'card')
      .is('tid', null)
      .in('cancel_reason', [
        EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
        STALE_CARD_CHECKOUT_CANCEL_REASON,
      ])
      .lt('created_at', expiryCutoff);

    if (releasedCardBookingsError) throw releasedCardBookingsError;

    const expiredCardIds = (expiredBookings || [])
      .filter((booking) => String(booking.payment_method || '').toLowerCase() === 'card')
      .map((booking) => booking.id);
    const releasedCardIds = (releasedCardBookings || []).map((booking) => booking.id);
    const cardAttemptIds = Array.from(new Set([...expiredCardIds, ...releasedCardIds]));

    if (expiredCardIds.length > 0) {
      const { error: deletePendingCardError } = await supabase
        .from('bookings')
        .delete()
        .in('id', expiredCardIds)
        .eq('status', 'PENDING')
        .eq('payment_method', 'card')
        .is('tid', null);

      if (deletePendingCardError) throw deletePendingCardError;
    }

    if (releasedCardIds.length > 0) {
      const { error: deleteReleasedCardError } = await supabase
        .from('bookings')
        .delete()
        .in('id', releasedCardIds)
        .eq('status', 'cancelled')
        .eq('payment_method', 'card')
        .is('tid', null)
        .in('cancel_reason', [
          EXPLICIT_CARD_CHECKOUT_CANCEL_REASON,
          STALE_CARD_CHECKOUT_CANCEL_REASON,
        ]);

      if (deleteReleasedCardError) throw deleteReleasedCardError;
    }

    const nonCardExpiredBookings = (expiredBookings || []).filter(
      (booking) => String(booking.payment_method || '').toLowerCase() !== 'card'
    );

    if (nonCardExpiredBookings.length === 0 && cardAttemptIds.length === 0) {
      return NextResponse.json({ message: 'No expired bookings found' });
    }

    const expiredIdsByReason = nonCardExpiredBookings.reduce<Map<string, Array<string | number>>>(
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

    const cancelledIds = nonCardExpiredBookings.map((booking) => booking.id);
    const affectedIds = [...cardAttemptIds, ...cancelledIds];

    console.log(
      `[CRON] Removed ${cardAttemptIds.length} expired card attempts and cancelled ${cancelledIds.length} pending bookings.`
    );

    return NextResponse.json({
      success: true,
      count: affectedIds.length,
      ids: affectedIds,
      deletedCardAttemptCount: cardAttemptIds.length,
      cancelledBookingCount: cancelledIds.length,
    });
  } catch (err: unknown) {
    console.error('[CRON] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown cron error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
