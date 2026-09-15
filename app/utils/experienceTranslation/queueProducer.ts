import { createExperienceTranslationQueueMessage, type ExperienceTranslationQueueMessage } from './queueMessage';
export type ExperienceTranslationQueueLike = { send(message: ExperienceTranslationQueueMessage, options?: { contentType?: 'json'; delaySeconds?: number }): Promise<unknown> };
export type ExperienceTranslationExecutionContextLike = { waitUntil(promise: Promise<unknown>): void };
export type ExperienceTranslationProducerLog = { event: 'experience_translation_producer'; status: 'scheduled' | 'enqueued' | 'enqueue_failed'; eventId: string; reason: 'job-created'; diagnosticCode: string };
type ProducerRuntime = { env: Record<string, unknown>; ctx: ExperienceTranslationExecutionContextLike };
function safeLog(log: ((entry: ExperienceTranslationProducerLog) => void) | undefined, entry: ExperienceTranslationProducerLog) { try { log?.(entry); } catch { /* observability only */ } }
export function scheduleExperienceTranslationWake(dependencies: { loadRuntime(): ProducerRuntime; createEventId?: () => string; log?: (entry: ExperienceTranslationProducerLog) => void }) {
  let runtime: ProducerRuntime;
  try { runtime = dependencies.loadRuntime(); } catch { return { status: 'context_unavailable' } as const; }
  if (runtime.env.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' || runtime.env.EXPERIENCE_TRANSLATION_QUEUE_ENABLED !== 'true' || !runtime.env.EXPERIENCE_TRANSLATION_QUEUE || typeof (runtime.env.EXPERIENCE_TRANSLATION_QUEUE as ExperienceTranslationQueueLike).send !== 'function' || !runtime.ctx || typeof runtime.ctx.waitUntil !== 'function') return { status: 'disabled' } as const;
  let message: ExperienceTranslationQueueMessage;
  try { message = createExperienceTranslationQueueMessage('job-created', 0, dependencies.createEventId?.() ?? crypto.randomUUID()); } catch { return { status: 'invalid_state' } as const; }
  const queue = runtime.env.EXPERIENCE_TRANSLATION_QUEUE as ExperienceTranslationQueueLike;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const completion = gate.then(() => queue.send(message, { contentType: 'json' })).then(() => { safeLog(dependencies.log, { event: 'experience_translation_producer', status: 'enqueued', eventId: message.eventId, reason: 'job-created', diagnosticCode: 'queue_send_succeeded' }); return { status: 'enqueued', diagnosticCode: 'queue_send_succeeded' } as const; }).catch(() => { safeLog(dependencies.log, { event: 'experience_translation_producer', status: 'enqueue_failed', eventId: message.eventId, reason: 'job-created', diagnosticCode: 'queue_send_failed' }); return { status: 'enqueue_failed', diagnosticCode: 'queue_send_failed' } as const; });
  try { runtime.ctx.waitUntil(completion); } catch { return { status: 'context_unavailable' } as const; }
  release?.();
  safeLog(dependencies.log, { event: 'experience_translation_producer', status: 'scheduled', eventId: message.eventId, reason: 'job-created', diagnosticCode: 'wait_until_registered' });
  return { status: 'scheduled', message, completion } as const;
}
