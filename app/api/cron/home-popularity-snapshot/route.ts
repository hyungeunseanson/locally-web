import { NextResponse } from 'next/server';

import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  createSupabaseHomePopularitySnapshotRepository,
  refreshHomePopularitySnapshot,
  type HomePopularitySnapshotRepository,
} from '@/app/utils/homePopularitySnapshot';

export async function executeHomePopularitySnapshotCron(
  request: Request,
  repository?: HomePopularitySnapshotRepository
) {
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await refreshHomePopularitySnapshot(
      repository ??
        createSupabaseHomePopularitySnapshotRepository(createAdminClient())
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown cron error';
    console.error('[CRON Home Popularity Snapshot] Error:', err);
    return NextResponse.json(
      {
        success: false,
        refreshedCount: 0,
        refreshedAt: new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return executeHomePopularitySnapshotCron(request);
}
