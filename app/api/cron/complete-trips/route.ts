import { NextResponse } from 'next/server';

import { runExperienceCompletionSync } from '@/app/utils/settlementSync/experienceCompletion';
import { createAdminClient } from '@/app/utils/supabase/admin';

function parseTestDelayMs(request: Request) {
  if (process.env.NODE_ENV === 'production') return undefined;
  const raw = request.headers.get('x-locally-test-delay-settlement-sync-ms');
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await runExperienceCompletionSync({
      supabaseAdmin: createAdminClient(),
      triggerSource: 'cron',
      testDelayMs: parseTestDelayMs(request),
    });

    if (!result.success) {
      if (result.outcome === 'already_running') {
        return NextResponse.json({
          success: true,
          message: 'Experience completion sync already running',
          count: 0,
          ids: [],
        });
      }

      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const bookingIds = Array.isArray(result.details?.booking_ids)
      ? (result.details.booking_ids as string[])
      : [];

    if (result.outcome === 'no_candidates') {
      return NextResponse.json({
        success: true,
        message: 'No pending past bookings to complete',
        count: 0,
        ids: [],
      });
    }

    return NextResponse.json({
      success: true,
      count: result.processedCount,
      ids: bookingIds,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[CRON Complete] Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
