import { NextResponse } from 'next/server';

import { runServiceCompletionSync } from '@/app/utils/settlementSync/serviceCompletion';
import { createAdminClient } from '@/app/utils/supabase/admin';

function parseTestDelayMs(request: Request) {
  if (process.env.NODE_ENV === 'production') return undefined;
  const raw = request.headers.get('x-locally-test-delay-settlement-sync-ms');
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getTodayKSTDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await runServiceCompletionSync({
      supabaseAdmin: createAdminClient(),
      triggerSource: 'cron',
      testDelayMs: parseTestDelayMs(request),
    });

    if (!result.success) {
      if (result.outcome === 'already_running') {
        return NextResponse.json({
          success: true,
          requestCount: 0,
          bookingCount: 0,
          requestIds: [],
          bookingIds: [],
        });
      }

      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const bookingIds = Array.isArray(result.details?.booking_ids)
      ? (result.details.booking_ids as string[])
      : [];
    const requestIds = Array.isArray(result.details?.request_ids)
      ? (result.details.request_ids as string[])
      : [];

    return NextResponse.json({
      success: true,
      requestCount: requestIds.length,
      bookingCount: bookingIds.length,
      requestIds,
      bookingIds,
      completedBeforeDate: getTodayKSTDateString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[CRON complete-services] error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
