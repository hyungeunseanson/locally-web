import { NextResponse } from 'next/server';

import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('refresh_experience_popularity_snapshot');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      refreshedCount: Number(data || 0),
      refreshedAt: new Date().toISOString(),
    });
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
