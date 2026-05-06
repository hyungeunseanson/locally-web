import { NextResponse } from 'next/server';

import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';

const NOTIFICATION_RETENTION_DAYS = 30;
const NOTIFICATION_RETENTION_BATCH_SIZE = 1000;
const NOTIFICATION_RETENTION_MAX_BATCHES = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const supabase = createAdminClient();
    let deletedCount = 0;
    let batches = 0;

    for (let attempt = 0; attempt < NOTIFICATION_RETENTION_MAX_BATCHES; attempt += 1) {
      const { data, error } = await supabase.rpc('prune_notifications_retention', {
        p_cutoff: cutoff,
        p_batch_size: NOTIFICATION_RETENTION_BATCH_SIZE,
      });

      if (error) {
        throw error;
      }

      const batchDeletedCount = Number(data || 0);
      if (!Number.isFinite(batchDeletedCount) || batchDeletedCount <= 0) {
        break;
      }

      deletedCount += batchDeletedCount;
      batches += 1;

      if (batchDeletedCount < NOTIFICATION_RETENTION_BATCH_SIZE) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      cutoff,
      deletedCount,
      batches,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown cron error';
    console.error('[CRON Notification Retention Cleanup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        cutoff,
        deletedCount: 0,
        batches: 0,
        error: message,
      },
      { status: 500 }
    );
  }
}
