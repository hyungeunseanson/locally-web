import { NextResponse } from 'next/server';

import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { runExperienceCompletionSync } from '@/app/utils/settlementSync/experienceCompletion';
import { isSettlementSyncInfrastructureError } from '@/app/utils/settlementSync/types';
import { createAdminClient } from '@/app/utils/supabase/admin';

function allowSettlementSyncTestHeaders(request: Request) {
  if (process.env.NODE_ENV !== 'production') return true;

  try {
    const hostname = new URL(request.url).hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

function parseTestDelayMs(request: Request) {
  if (!allowSettlementSyncTestHeaders(request)) return undefined;
  const raw = request.headers.get('x-locally-test-delay-settlement-sync-ms');
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseTestLeaseMs(request: Request) {
  if (!allowSettlementSyncTestHeaders(request)) return undefined;
  const raw = request.headers.get('x-locally-test-settlement-sync-lease-ms');
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseBooleanTestHeader(request: Request, headerName: string) {
  if (!allowSettlementSyncTestHeaders(request)) return false;
  const value = request.headers.get(headerName);
  return value === '1' || value === 'true';
}

function parseFailPhase(request: Request) {
  if (!allowSettlementSyncTestHeaders(request)) return undefined;
  const value = request.headers.get('x-locally-test-fail-settlement-sync-phase');
  return value === 'after_lock' ? 'after_lock' : undefined;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await runExperienceCompletionSync({
      supabaseAdmin: createAdminClient(),
      triggerSource: 'cron',
      testDelayMs: parseTestDelayMs(request),
      testLeaseMs: parseTestLeaseMs(request),
      simulateMissingAdminJobRuns: parseBooleanTestHeader(
        request,
        'x-locally-test-simulate-missing-admin-job-runs'
      ),
      simulateMissingExperienceDueRpc: parseBooleanTestHeader(
        request,
        'x-locally-test-simulate-missing-experience-completion-rpc'
      ),
      failPhase: parseFailPhase(request),
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
    if (isSettlementSyncInfrastructureError(err)) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[CRON Complete] Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
