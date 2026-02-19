import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // [M-2] Auto Cancel Scheduler
  // Secure this endpoint with a secret key
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Find pending bookings older than 1 hour
    const { data: expiredBookings, error } = await supabase
      .from('bookings')
      .select('id, created_at')
      .eq('status', 'PENDING')
      .lt('created_at', oneHourAgo);

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
        cancel_reason: '입금 기한 만료 (1시간 경과 자동 취소)' 
      })
      .in('id', expiredIds);

    if (updateError) throw updateError;

    console.log(`[CRON] Auto-cancelled ${expiredBookings.length} pending bookings.`);

    return NextResponse.json({ success: true, count: expiredBookings.length, ids: expiredIds });
  } catch (err: any) {
    console.error('[CRON] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
