import { createExperienceTranslationQueueMessage } from './queueMessage';
import type { ExperienceTranslationQueueLike } from './queueProducer';

export const EXPERIENCE_TRANSLATION_RECOVERY_CRON = '17 19 * * *';
type ScheduledEnv = Record<string, unknown> & { CLOUDFLARE_DEPLOYMENT_ENV?: string; EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED?: string; EXPERIENCE_TRANSLATION_QUEUE?: ExperienceTranslationQueueLike };

export async function handleExperienceTranslationScheduledRecovery(controller: { cron: string }, env: ScheduledEnv, options: { createEventId?: () => string; log?: (entry: Record<string, unknown>) => void } = {}) {
  if (controller.cron !== EXPERIENCE_TRANSLATION_RECOVERY_CRON) return { status: 'not_translation_schedule' } as const;
  if (env.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' || env.EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED !== 'true' || !env.EXPERIENCE_TRANSLATION_QUEUE) return { status: 'disabled' } as const;
  const message = createExperienceTranslationQueueMessage('scheduled-recovery', 0, options.createEventId?.() ?? crypto.randomUUID());
  await env.EXPERIENCE_TRANSLATION_QUEUE.send(message, { contentType: 'json' });
  try { (options.log ?? ((entry) => console.log(JSON.stringify(entry))))({ event: 'experience_translation_scheduled_recovery', eventId: message.eventId, reason: message.reason, status: 'enqueued', diagnosticCode: 'queue_send_succeeded' }); } catch { /* observability only */ }
  return { status: 'enqueued', eventId: message.eventId } as const;
}
