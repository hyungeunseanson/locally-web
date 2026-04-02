import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET(request: Request) {
  // [M-2] Auto Cancel Scheduler
  // Secure this endpoint with a secret key
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find pending bookings older than 2 hours
    const { data: expiredBookings, error } = await supabase
      .from('bookings')
      .select('id, created_at')
      .eq('status', 'PENDING')
      .lt('created_at', twoHoursAgo);

    if (error) throw error;

    if (!expiredBookings || expiredBookings.length === 0) {
      return NextResponse.json({ message: 'No expired bookings found' });
    }

    // Cancel them
    const expiredIds = expiredBookings.map(b => b.id);
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancel_reason: '입금 기한 만료 (2시간 경과 자동 취소)'
      })
      .in('id', expiredIds)
      .eq('status', 'PENDING');

    if (updateError) throw updateError;

    console.log(`[CRON] Auto-cancelled ${expiredBookings.length} pending bookings.`);

    return NextResponse.json({ success: true, count: expiredBookings.length, ids: expiredIds });
  } catch (err: unknown) {
    console.error('[CRON] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown cron error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
