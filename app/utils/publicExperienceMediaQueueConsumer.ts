import {
  mirrorPublicExperienceMedia,
  parsePublicExperienceMediaQueueMessage,
  type PublicExperienceMediaMirrorDependencies,
  PUBLIC_EXPERIENCE_MEDIA_DIAGNOSTIC_STAGES,
  type PublicExperienceMediaMirrorOutcome,
} from './publicExperienceMediaQueueMirror';
import {
  createPublicExperienceMediaQueueDependencies,
  type PublicExperienceMediaQueueRuntimeEnv,
} from './publicExperienceMediaQueueRuntime';

export const PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE =
  'locally-public-experience-media-mirror-production';

export type PublicExperienceMediaQueueMessageLike = {
  readonly body: unknown;
  readonly attempts: number;
  ack(): void;
  retry(): void;
};

export type PublicExperienceMediaQueueBatchLike = {
  readonly queue: string;
  readonly messages: readonly PublicExperienceMediaQueueMessageLike[];
};

type QueueMirror = (
  message: unknown,
  dependencies: PublicExperienceMediaMirrorDependencies
) => Promise<PublicExperienceMediaMirrorOutcome>;

type QueueConsumerOptions = {
  createDependencies?: (
    environment: PublicExperienceMediaQueueRuntimeEnv
  ) => PublicExperienceMediaMirrorDependencies;
  mirror?: QueueMirror;
  log?: (record: Record<string, unknown>) => void;
};

const ACK_OUTCOMES = new Set([
  'success',
  'already_exact',
  'ineligible_noop',
]);
const RETRY_OUTCOMES = new Set([
  'source_drift',
  'transient_failure',
  'permanent_conflict',
  'invalid_message',
]);

function safeDiagnosticCode(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_:-]{0,63}$/.test(value)
    ? value
    : undefined;
}

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function safeDiagnosticStage(value: unknown) {
  return typeof value === 'string' &&
    PUBLIC_EXPERIENCE_MEDIA_DIAGNOSTIC_STAGES.includes(
      value as (typeof PUBLIC_EXPERIENCE_MEDIA_DIAGNOSTIC_STAGES)[number]
    )
    ? value
    : undefined;
}

function safeHttpStatus(value: unknown) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : undefined;
}

function queueLogRecord(
  message: PublicExperienceMediaQueueMessageLike,
  outcome: PublicExperienceMediaMirrorOutcome
) {
  const parsed = parsePublicExperienceMediaQueueMessage(message.body);
  return {
    event: 'public_experience_media_queue_outcome',
    experienceId: parsed?.experienceId,
    eventId: parsed?.eventId,
    reason: parsed?.reason,
    outcome: outcome.status,
    diagnosticCode: safeDiagnosticCode(outcome.diagnosticCode),
    diagnosticStage: safeDiagnosticStage(outcome.diagnosticStage),
    httpStatus: safeHttpStatus(outcome.httpStatus),
    sourceCount: safeCount(outcome.sourceCount),
    derivativeCount: safeCount(outcome.derivativeCount),
    originalCreatedCount: safeCount(outcome.originalCreatedCount),
    originalExactSkipCount: safeCount(outcome.originalExactSkipCount),
    derivativeCreatedCount: safeCount(outcome.derivativeCreatedCount),
    derivativeExactSkipCount: safeCount(outcome.derivativeExactSkipCount),
    attempt: safeCount(message.attempts),
  };
}

export async function handlePublicExperienceMediaQueueBatch(
  batch: PublicExperienceMediaQueueBatchLike,
  environment: PublicExperienceMediaQueueRuntimeEnv,
  options: QueueConsumerOptions = {}
) {
  if (batch.queue !== PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE) {
    throw new Error('public_experience_media_unexpected_queue');
  }
  if (environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production') {
    throw new Error('public_experience_media_non_production_environment');
  }
  const createDependencies =
    options.createDependencies || createPublicExperienceMediaQueueDependencies;
  const mirror = options.mirror || mirrorPublicExperienceMedia;
  const log = options.log || ((record) => console.log(JSON.stringify(record)));
  const dependencies = createDependencies(environment);

  for (const message of batch.messages) {
    const outcome = await mirror(message.body, dependencies);
    log(queueLogRecord(message, outcome));
    if (ACK_OUTCOMES.has(outcome.status)) {
      message.ack();
      continue;
    }
    if (RETRY_OUTCOMES.has(outcome.status)) {
      message.retry();
      continue;
    }
    throw new Error('public_experience_media_unknown_outcome');
  }
}
