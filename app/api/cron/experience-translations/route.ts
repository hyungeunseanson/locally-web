import { NextRequest, NextResponse } from 'next/server';
import { hasValidCronAuthorization } from '@/app/utils/cronAuth';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { createExperienceTranslationWorkerDependencies, runExperienceTranslationWorker, type ExperienceTranslationWorkerDependencies } from '@/app/utils/experienceTranslation/worker';

export async function executeExperienceTranslationCron(request: NextRequest, dependencies?: ExperienceTranslationWorkerDependencies) {
  if (!hasValidCronAuthorization(request.headers.get('authorization'))) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const summary = await runExperienceTranslationWorker(dependencies ?? createExperienceTranslationWorkerDependencies(process.env));
    return NextResponse.json({
      success: true,
      completed: summary.completed,
      failed: summary.failed,
      retried: summary.retried,
      cancelled: summary.cancelled,
      processed: summary.processed,
    });
  } catch (error) {
    console.error('[Cron Experience Translations] Error:', error);
    captureServerException(error, { route: '/api/cron/experience-translations', method: 'GET' });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return executeExperienceTranslationCron(request); }
