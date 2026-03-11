import { NextResponse } from 'next/server';

import { processQueuedEmailNotificationJobs } from '@/app/utils/emailNotificationJobs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await processQueuedEmailNotificationJobs(100);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[cron/email-notifications] failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
