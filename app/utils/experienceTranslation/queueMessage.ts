export const EXPERIENCE_TRANSLATION_QUEUE_NAME = 'locally-experience-translation-production';
export const EXPERIENCE_TRANSLATION_QUEUE_SCHEMA = 'locally.experience-translation-wake';
export const EXPERIENCE_TRANSLATION_QUEUE_VERSION = 1;
export const EXPERIENCE_TRANSLATION_MAX_HOP = 4;
export const EXPERIENCE_TRANSLATION_QUEUE_REASONS = ['job-created', 'continuation', 'retry-wakeup', 'scheduled-recovery', 'manual-canary'] as const;
export type ExperienceTranslationQueueReason = (typeof EXPERIENCE_TRANSLATION_QUEUE_REASONS)[number];
export type ExperienceTranslationQueueMessage = { schema: typeof EXPERIENCE_TRANSLATION_QUEUE_SCHEMA; version: typeof EXPERIENCE_TRANSLATION_QUEUE_VERSION; eventId: string; reason: ExperienceTranslationQueueReason; hop: number };
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
export function createExperienceTranslationQueueMessage(reason: ExperienceTranslationQueueReason, hop = 0, eventId = crypto.randomUUID()): ExperienceTranslationQueueMessage { return { schema: EXPERIENCE_TRANSLATION_QUEUE_SCHEMA, version: EXPERIENCE_TRANSLATION_QUEUE_VERSION, eventId, reason, hop }; }
export function parseExperienceTranslationQueueMessage(value: unknown): ExperienceTranslationQueueMessage | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !['schema', 'version', 'eventId', 'reason', 'hop'].includes(key))) return null;
  if (value.schema !== EXPERIENCE_TRANSLATION_QUEUE_SCHEMA || value.version !== EXPERIENCE_TRANSLATION_QUEUE_VERSION || typeof value.eventId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.eventId) || !EXPERIENCE_TRANSLATION_QUEUE_REASONS.includes(value.reason as ExperienceTranslationQueueReason) || !Number.isSafeInteger(value.hop) || Number(value.hop) < 0 || Number(value.hop) > EXPERIENCE_TRANSLATION_MAX_HOP) return null;
  return value as ExperienceTranslationQueueMessage;
}
