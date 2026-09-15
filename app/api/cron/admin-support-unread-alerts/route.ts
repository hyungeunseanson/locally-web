import { NextResponse } from 'next/server';

import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { processDueAdminSupportUnreadAlerts } from '@/app/utils/adminSupportUnreadAlerts';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function executeAdminSupportUnreadAlertsCron(
  request: Request,
  process: typeof processDueAdminSupportUnreadAlerts = processDueAdminSupportUnreadAlerts
) {
  const authHeader = request.headers.get('authorization');
  if (!hasValidCronAuthorization(authHeader)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await process({
      supabaseAdmin: createAdminClient(),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error(JSON.stringify({
      event: 'admin_support_unread_http_fallback',
      status: 'failed',
      diagnosticCode: 'processor_failed',
    }));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return executeAdminSupportUnreadAlertsCron(request);
}
