import { NextResponse } from 'next/server';

import { runCancelPendingBookings } from '@/app/utils/bookings/cancelPendingBookings';
import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET(request: Request) {
  if (!hasValidCronAuthorization(request.headers.get('authorization'))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await runCancelPendingBookings({
    supabaseAdmin: createAdminClient(),
    triggerSource: 'cron',
  });

  if (!result.success && result.outcome === 'already_running') {
    console.log(JSON.stringify({
      event: 'cancel_pending_bookings',
      status: 'completed',
      outcome: 'already_running',
    }));
    return NextResponse.json({ success: true, outcome: 'already_running' });
  }

  if (!result.success) {
    console.error(JSON.stringify({
      event: 'cancel_pending_bookings',
      status: 'failed',
      diagnosticCode: 'processor_failed',
    }));
    return NextResponse.json(
      { success: false, error: 'Pending booking cleanup failed.' },
      { status: result.status }
    );
  }

  const response = {
    success: true,
    outcome: result.outcome,
    cancelledCount: result.cancelledCount,
    activeSkippedCount: result.activeSkippedCount,
    reconciliationRequiredCount: result.reconciliationRequiredCount,
    alreadyTerminalCount: result.alreadyTerminalCount,
    batchCount: result.batchCount,
    hasMore: result.hasMore,
  };

  console.log(JSON.stringify({
    event: 'cancel_pending_bookings',
    status: 'completed',
    ...response,
  }));
  return NextResponse.json(response);
}
