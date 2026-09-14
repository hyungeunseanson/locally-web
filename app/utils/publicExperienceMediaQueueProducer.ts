import {
  buildPublicExperienceMediaInventory,
  parsePublicExperienceMediaQueueMessage,
  PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
  PUBLIC_EXPERIENCE_MEDIA_MESSAGE_VERSION,
  type PublicExperienceMediaQueueMessage,
  type PublicExperienceMediaQueueReason,
  type PublicExperienceMediaRow,
} from './publicExperienceMediaQueueMirror';
import { isPublicExperienceR2Eligible } from './publicExperienceMediaKeys';

const PRODUCER_BINDING = 'PUBLIC_EXPERIENCE_MEDIA_QUEUE';
const PRODUCER_ENABLED = 'PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED';
const PRODUCER_ALLOWLIST = 'PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS';

type WriteKind = 'create' | 'edit' | 'activation' | 'reorder';

type QueueLike = {
  send(
    body: PublicExperienceMediaQueueMessage,
    options: { contentType: 'json' }
  ): Promise<unknown>;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export type PublicExperienceMediaProducerRuntime = {
  env: unknown;
  ctx: unknown;
};

export type PublicExperienceMediaProducerLog = {
  event: 'public_experience_media_producer';
  status: 'scheduled' | 'enqueued' | 'enqueue_failed';
  eventId: string;
  experienceId: string;
  reason: PublicExperienceMediaQueueReason;
  diagnosticCode: string;
};

export type PublicExperienceMediaProducerCompletion = {
  status: 'enqueued' | 'enqueue_failed';
  diagnosticCode: string;
};

export type PublicExperienceMediaProducerScheduleResult =
  | { status: 'disabled' | 'ineligible' | 'unchanged' | 'invalid_state' | 'context_unavailable' }
  | {
      status: 'scheduled';
      message: PublicExperienceMediaQueueMessage;
      completion: Promise<PublicExperienceMediaProducerCompletion>;
    };

export type PublicExperienceMediaAfterWrite = {
  before: PublicExperienceMediaRow | null;
  after: PublicExperienceMediaRow | null;
  writeKind: WriteKind;
};

type ScheduleDependencies = {
  loadRuntime: () => PublicExperienceMediaProducerRuntime;
  createEventId?: () => string;
  log?: (entry: PublicExperienceMediaProducerLog) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asExperienceId(value: number | string) {
  const id = String(value);
  return /^[1-9][0-9]{0,18}$/.test(id) ? id : null;
}

function readAllowlist(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ids = value.split(',').map((item) => item.trim());
  if (ids.some((id) => !/^[1-9][0-9]{0,18}$/.test(id))) return null;
  return new Set(ids);
}

function isQueueLike(value: unknown): value is QueueLike {
  return isRecord(value) && typeof value.send === 'function';
}

function isExecutionContextLike(value: unknown): value is ExecutionContextLike {
  return isRecord(value) && typeof value.waitUntil === 'function';
}

function reasonForWrite(writeKind: WriteKind): PublicExperienceMediaQueueReason {
  return writeKind;
}

function safeLog(
  log: ScheduleDependencies['log'],
  entry: PublicExperienceMediaProducerLog
) {
  try {
    log?.(entry);
  } catch {
    // Logging is observability only and must never affect a committed DB write.
  }
}

export function planPublicExperienceMediaAfterWrite(
  input: PublicExperienceMediaAfterWrite
):
  | { status: 'ineligible' | 'unchanged' | 'invalid_state' }
  | {
      status: 'enqueue';
      experienceId: string;
      reason: PublicExperienceMediaQueueReason;
    } {
  if (!input.after || !isPublicExperienceR2Eligible(input.after)) {
    return { status: 'ineligible' };
  }

  const experienceId = asExperienceId(input.after.id);
  if (!experienceId) return { status: 'invalid_state' };

  let afterDigest: string;
  try {
    afterDigest = buildPublicExperienceMediaInventory(input.after).snapshotDigest;
  } catch {
    return { status: 'invalid_state' };
  }

  if (input.before && isPublicExperienceR2Eligible(input.before)) {
    try {
      if (
        buildPublicExperienceMediaInventory(input.before).snapshotDigest === afterDigest
      ) {
        return { status: 'unchanged' };
      }
    } catch {
      // The saved authoritative row is valid. A malformed prior snapshot must not
      // suppress repair of the current public media inventory.
    }
  }

  return {
    status: 'enqueue',
    experienceId,
    reason: reasonForWrite(input.writeKind),
  };
}

export function schedulePublicExperienceMediaAfterWrite(
  input: PublicExperienceMediaAfterWrite,
  dependencies: ScheduleDependencies
): PublicExperienceMediaProducerScheduleResult {
  const plan = planPublicExperienceMediaAfterWrite(input);
  if (plan.status !== 'enqueue') return plan;

  let runtime: PublicExperienceMediaProducerRuntime;
  try {
    runtime = dependencies.loadRuntime();
  } catch {
    return { status: 'context_unavailable' };
  }
  if (!isRecord(runtime.env) || !isExecutionContextLike(runtime.ctx)) {
    return { status: 'context_unavailable' };
  }

  if (
    runtime.env.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    runtime.env[PRODUCER_ENABLED] !== 'true'
  ) {
    return { status: 'disabled' };
  }

  const allowlist = readAllowlist(runtime.env[PRODUCER_ALLOWLIST]);
  if (!allowlist?.has(plan.experienceId)) return { status: 'disabled' };

  const queue = runtime.env[PRODUCER_BINDING];
  if (!isQueueLike(queue)) return { status: 'disabled' };

  let eventId: string;
  try {
    eventId = (dependencies.createEventId ?? (() => crypto.randomUUID()))();
  } catch {
    return { status: 'invalid_state' };
  }
  const message: PublicExperienceMediaQueueMessage = {
    schema: PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
    version: PUBLIC_EXPERIENCE_MEDIA_MESSAGE_VERSION,
    experienceId: plan.experienceId,
    reason: plan.reason,
    eventId,
  };
  if (!parsePublicExperienceMediaQueueMessage(message)) {
    return { status: 'invalid_state' };
  }

  let releaseSend: (() => void) | undefined;
  const startGate = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });
  const completion: Promise<PublicExperienceMediaProducerCompletion> = startGate
    .then(() => queue.send(message, { contentType: 'json' }))
    .then(() => {
      safeLog(dependencies.log, {
        event: 'public_experience_media_producer',
        status: 'enqueued',
        eventId,
        experienceId: plan.experienceId,
        reason: plan.reason,
        diagnosticCode: 'queue_send_succeeded',
      });
      return { status: 'enqueued', diagnosticCode: 'queue_send_succeeded' } as const;
    })
    .catch(() => {
      safeLog(dependencies.log, {
        event: 'public_experience_media_producer',
        status: 'enqueue_failed',
        eventId,
        experienceId: plan.experienceId,
        reason: plan.reason,
        diagnosticCode: 'queue_send_failed',
      });
      return { status: 'enqueue_failed', diagnosticCode: 'queue_send_failed' } as const;
    });

  try {
    runtime.ctx.waitUntil(completion);
  } catch {
    return { status: 'context_unavailable' };
  }

  releaseSend?.();
  safeLog(dependencies.log, {
    event: 'public_experience_media_producer',
    status: 'scheduled',
    eventId,
    experienceId: plan.experienceId,
    reason: plan.reason,
    diagnosticCode: 'wait_until_registered',
  });
  return { status: 'scheduled', message, completion };
}
