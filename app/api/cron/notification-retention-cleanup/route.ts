import { NextResponse } from 'next/server';

import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  buildNotificationRetentionCutoff,
  createSupabaseNotificationRetentionRepository,
  NotificationRetentionCleanupError,
  runNotificationRetentionCleanup,
  type NotificationRetentionRepository,
} from '@/app/utils/notificationRetentionCleanup';

export async function executeNotificationRetentionCleanupCron(
  request: Request,
  repository?: NotificationRetentionRepository,
  now: () => Date = () => new Date()
) {
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const invocationNow = now();
  const cutoff = buildNotificationRetentionCutoff(invocationNow);

  try {
    const result = await runNotificationRetentionCleanup(
      repository ??
        createSupabaseNotificationRetentionRepository(createAdminClient()),
      { now: () => invocationNow }
    );
    return NextResponse.json(result);
  } catch (error) {
    const diagnosticCode = error instanceof NotificationRetentionCleanupError
      ? error.diagnosticCode
      : 'cleanup_failed';
    console.error(JSON.stringify({
      event: 'notification_retention_cleanup_http_fallback',
      status: 'failed',
      diagnosticCode,
    }));
    return NextResponse.json(
      {
        success: false,
        cutoff,
        deletedCount: 0,
        batches: 0,
        error: diagnosticCode,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return executeNotificationRetentionCleanupCron(request);
}
