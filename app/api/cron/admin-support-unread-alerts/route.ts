import { NextResponse } from 'next/server';

import { processDueAdminSupportUnreadAlerts } from '@/app/utils/adminSupportUnreadAlerts';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await processDueAdminSupportUnreadAlerts({
      supabaseAdmin: createAdminClient(),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[CRON admin-support-unread-alerts] error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
