import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  captureServerException,
  flushServerSentry,
  getSentryEnvironment,
  isServerSentryEnabled,
} from '@/app/utils/monitoring/sentry';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === '1';
    const sentryEnabled = isServerSentryEnabled();

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        sent: false,
        sentryEnabled,
        environment: getSentryEnvironment(),
      });
    }

    if (!sentryEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sentry is not configured.',
          sentryEnabled: false,
          environment: getSentryEnvironment(),
        },
        { status: 503 },
      );
    }

    const eventId = captureServerException(new Error('Locally Sentry admin test event'), {
      route: '/api/admin/sentry-test',
      method: 'POST',
      test: true,
    });
    const flushed = await flushServerSentry();

    return NextResponse.json({
      success: true,
      sent: Boolean(eventId),
      eventId,
      flushed,
      environment: getSentryEnvironment(),
    });
  } catch (error) {
    console.error('[ADMIN] sentry-test error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send Sentry test event.' }, { status: 500 });
  }
}
