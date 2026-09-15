import {
  ExperienceTranslationInfrastructureError,
  createExperienceTranslationWorkerDependencies,
  runExperienceTranslationWorker,
  type ExperienceTranslationWorkerDependencies,
  type ExperienceTranslationWorkerSummary,
} from './worker';
import {
  EXPERIENCE_TRANSLATION_MAX_HOP,
  EXPERIENCE_TRANSLATION_QUEUE_NAME,
  createExperienceTranslationQueueMessage,
  parseExperienceTranslationQueueMessage,
} from './queueMessage';
import type { ExperienceTranslationQueueLike } from './queueProducer';

export type ExperienceTranslationQueueRuntimeEnv = Record<string, unknown> & {
  CLOUDFLARE_DEPLOYMENT_ENV: string;
  EXPERIENCE_TRANSLATION_QUEUE?: ExperienceTranslationQueueLike;
  EXPERIENCE_TRANSLATION_QUEUE_ENABLED?: string;
};
export type ExperienceTranslationQueueMessageLike = { readonly body: unknown; readonly attempts: number; ack(): void; retry(): void };
export type ExperienceTranslationQueueBatchLike = { readonly queue: string; readonly messages: readonly ExperienceTranslationQueueMessageLike[] };

type ConsumerOptions = {
  createDependencies?: (env: ExperienceTranslationQueueRuntimeEnv) => ExperienceTranslationWorkerDependencies;
  runWorker?: typeof runExperienceTranslationWorker;
  createEventId?: () => string;
  log?: (entry: Record<string, unknown>) => void;
};

function safeLog(log: ConsumerOptions['log'], entry: Record<string, unknown>) { try { (log ?? ((record) => console.log(JSON.stringify(record))))(entry); } catch { /* observability only */ } }
function counts(summary: ExperienceTranslationWorkerSummary) { return { processed: summary.processed, completed: summary.completed, failed: summary.failed, retried: summary.retried, cancelled: summary.cancelled, providerCalls: summary.providerCalls }; }

export async function handleExperienceTranslationQueueBatch(batch: ExperienceTranslationQueueBatchLike, environment: ExperienceTranslationQueueRuntimeEnv, options: ConsumerOptions = {}) {
  if (batch.queue !== EXPERIENCE_TRANSLATION_QUEUE_NAME) throw new Error('experience_translation_unexpected_queue');
  if (environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production') throw new Error('experience_translation_non_production_environment');
  const createDependencies = options.createDependencies ?? ((env) => createExperienceTranslationWorkerDependencies(env, { explicitCredentials: true }));
  const runWorker = options.runWorker ?? runExperienceTranslationWorker;
  for (const message of batch.messages) {
    const parsed = parseExperienceTranslationQueueMessage(message.body);
    if (!parsed) {
      safeLog(options.log, { event: 'experience_translation_queue_outcome', outcome: 'invalid_message', diagnosticStage: 'message', diagnosticCode: 'invalid_message', attempt: message.attempts });
      message.retry();
      continue;
    }
    try {
      const summary = await runWorker(createDependencies(environment), { maxTasks: parsed.reason === 'manual-canary' ? 1 : undefined });
      let continuation = 'not_needed';
      if (summary.saturated && parsed.reason !== 'manual-canary' && parsed.hop < EXPERIENCE_TRANSLATION_MAX_HOP && environment.EXPERIENCE_TRANSLATION_QUEUE_ENABLED === 'true' && environment.EXPERIENCE_TRANSLATION_QUEUE) {
        try {
          await environment.EXPERIENCE_TRANSLATION_QUEUE.send(createExperienceTranslationQueueMessage('continuation', parsed.hop + 1, options.createEventId?.() ?? crypto.randomUUID()), { contentType: 'json' });
          continuation = 'enqueued';
        } catch { continuation = 'enqueue_failed'; }
      } else if (summary.saturated && parsed.hop >= EXPERIENCE_TRANSLATION_MAX_HOP) continuation = 'hop_limit';
      safeLog(options.log, { event: 'experience_translation_queue_outcome', eventId: parsed.eventId, reason: parsed.reason, hop: parsed.hop, outcome: 'processed', continuation, attempt: message.attempts, ...counts(summary) });
      message.ack();
    } catch (error) {
      const diagnosticStage = error instanceof ExperienceTranslationInfrastructureError ? error.diagnosticStage : 'runtime';
      const diagnosticCode = error instanceof ExperienceTranslationInfrastructureError ? error.diagnosticCode : 'unclassified_runtime_failure';
      safeLog(options.log, { event: 'experience_translation_queue_outcome', eventId: parsed.eventId, reason: parsed.reason, hop: parsed.hop, outcome: 'transport_retry', diagnosticStage, diagnosticCode, attempt: message.attempts });
      message.retry();
    }
  }
}
