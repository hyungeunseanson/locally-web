import { createClient } from '@supabase/supabase-js';
import type { createAdminClient } from '@/app/utils/supabase/admin';
import {
  buildSourceTranslationContentFromExperience,
  getLocalizedColumnName,
  isExperienceLocale,
  mergeLocalizedItineraryValue,
  mergeLocalizedListValue,
  mergeLocalizedRulesValue,
  mergeLocalizedTextValue,
  normalizeExperienceLocaleArray,
  type ExperienceItineraryTranslationItem,
  type ExperienceLocale,
  type ExperienceRulesTranslationInput,
  type TranslationMetaEntry,
} from '@/app/utils/experienceTranslation';
import {
  TranslationProviderError,
  translateWithGemini,
  translateWithGrok,
  type TranslationRequest,
  type TranslationResult,
} from '@/app/utils/experienceTranslation/providers';

export type ExperienceTranslationProviderName = 'gemini' | 'grok';

export type ExperienceTranslationLeasedTask = {
  id: string;
  job_id: string;
  experience_id: number;
  translation_version: number;
  source_locale: ExperienceLocale;
  target_locale: ExperienceLocale;
  provider: ExperienceTranslationProviderName;
  attempt_count: number;
  priority: number;
  lease_expires_at: string;
};

export type ExperienceTranslationRow = {
  id: number;
  source_locale: ExperienceLocale;
  translation_version: number;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  meeting_point?: string | null;
  meeting_point_i18n?: Partial<Record<ExperienceLocale, string>> | null;
  supplies?: string | null;
  supplies_i18n?: Partial<Record<ExperienceLocale, string>> | null;
  inclusions?: string[] | null;
  inclusions_i18n?: Partial<Record<ExperienceLocale, string[]>> | null;
  exclusions?: string[] | null;
  exclusions_i18n?: Partial<Record<ExperienceLocale, string[]>> | null;
  itinerary?: ExperienceItineraryTranslationItem[] | null;
  itinerary_i18n?: Partial<Record<ExperienceLocale, ExperienceItineraryTranslationItem[]>> | null;
  rules?: ExperienceRulesTranslationInput | null;
  rules_i18n?: Partial<Record<ExperienceLocale, ExperienceRulesTranslationInput>> | null;
  title_ko?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  description_ko?: string | null;
  description_en?: string | null;
  description_ja?: string | null;
  description_zh?: string | null;
  manual_locales?: ExperienceLocale[] | null;
  translation_meta?: Record<string, TranslationMetaEntry> | null;
};

export type ExperienceTranslationWorkerSummary = {
  completed: number;
  failed: number;
  retried: number;
  cancelled: number;
  processed: number;
  saturated: boolean;
  providerCalls: Record<ExperienceTranslationProviderName, number>;
};

export type ExperienceTranslationWorkerConfig = {
  batchSize: number;
  leaseSeconds: number;
  maxAttempts: number;
  reservedTokens: Record<ExperienceTranslationProviderName, number>;
  models: Record<ExperienceTranslationProviderName, string | undefined>;
  hasGrokCredential: boolean;
};

export type ExperienceTranslationWorkerRepository = {
  leaseNextTask(
    provider: ExperienceTranslationProviderName,
    config: ExperienceTranslationWorkerConfig
  ): Promise<ExperienceTranslationLeasedTask | null>;
  fetchExperience(experienceId: number): Promise<ExperienceTranslationRow | null>;
  getProviderModel(provider: ExperienceTranslationProviderName): Promise<string>;
  markTaskProcessing(task: ExperienceTranslationLeasedTask): Promise<void>;
  markTaskCancelled(task: ExperienceTranslationLeasedTask, reason: string): Promise<void>;
  markTaskCompleted(task: ExperienceTranslationLeasedTask): Promise<void>;
  markTaskRetryable(
    task: ExperienceTranslationLeasedTask,
    provider: ExperienceTranslationProviderName,
    delaySeconds: number,
    lastError: string
  ): Promise<void>;
  markTaskFailed(
    task: ExperienceTranslationLeasedTask,
    experience: ExperienceTranslationRow | null,
    lastError: string
  ): Promise<void>;
  applyExperienceTranslation(
    task: ExperienceTranslationLeasedTask,
    payload: Record<string, unknown>
  ): Promise<boolean>;
  recordProviderOutcome(
    provider: ExperienceTranslationProviderName,
    tokenCount: number,
    cooldownSeconds: number | null,
    hitQuota: boolean,
    reservedTokenCount: number
  ): Promise<void>;
};

export type ExperienceTranslationWorkerDependencies = {
  repository: ExperienceTranslationWorkerRepository;
  config: ExperienceTranslationWorkerConfig;
  translateGemini(request: TranslationRequest): Promise<TranslationResult>;
  translateGrok(request: TranslationRequest): Promise<TranslationResult>;
};

export class ExperienceTranslationInfrastructureError extends Error {
  readonly diagnosticStage: string;
  readonly diagnosticCode: string;

  constructor(diagnosticStage: string, diagnosticCode: string) {
    super(diagnosticCode);
    this.diagnosticStage = diagnosticStage;
    this.diagnosticCode = diagnosticCode;
  }
}

type TranslationEnvironment = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const PROVIDER_ORDER: ExperienceTranslationProviderName[] = ['gemini', 'grok'];
const EXPERIENCE_SELECT = 'id, source_locale, translation_version, category, title, description, meeting_point, meeting_point_i18n, supplies, supplies_i18n, inclusions, inclusions_i18n, exclusions, exclusions_i18n, itinerary, itinerary_i18n, rules, rules_i18n, title_ko, title_en, title_ja, title_zh, description_ko, description_en, description_ja, description_zh, manual_locales, translation_meta';

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function readExperienceTranslationWorkerConfig(
  environment: TranslationEnvironment
): ExperienceTranslationWorkerConfig {
  return {
    batchSize: boundedInteger(environment.TRANSLATION_WORKER_BATCH_SIZE, 4, 1, 32),
    leaseSeconds: boundedInteger(environment.TRANSLATION_TASK_LEASE_SECONDS, 180, 30, 3600),
    maxAttempts: boundedInteger(environment.TRANSLATION_MAX_ATTEMPTS, 4, 1, 20),
    reservedTokens: {
      gemini: boundedInteger(environment.TRANSLATION_GEMINI_RESERVED_TOKENS, 3500, 0, 100000),
      grok: boundedInteger(environment.TRANSLATION_GROK_RESERVED_TOKENS, 3500, 0, 100000),
    },
    models: {
      gemini: stringValue(environment.TRANSLATION_GEMINI_MODEL),
      grok: stringValue(environment.TRANSLATION_GROK_MODEL),
    },
    hasGrokCredential: Boolean(stringValue(environment.XAI_API_KEY)),
  };
}

function getSourceFieldValue(
  experience: ExperienceTranslationRow,
  field: 'title' | 'description',
  locale: ExperienceLocale
) {
  const localizedValue = experience[getLocalizedColumnName(field, locale) as keyof ExperienceTranslationRow];
  if (typeof localizedValue === 'string' && localizedValue.trim()) return localizedValue;
  const canonical = experience[field];
  return typeof canonical === 'string' ? canonical : '';
}

function safeTranslationMeta(meta: ExperienceTranslationRow['translation_meta']) {
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? { ...meta }
    : {} as Record<string, TranslationMetaEntry>;
}

function nextTranslationMeta(
  current: ExperienceTranslationRow['translation_meta'],
  locale: ExperienceLocale,
  entry: TranslationMetaEntry
) {
  return { ...safeTranslationMeta(current), [locale]: entry };
}

function isManualTargetLocale(experience: ExperienceTranslationRow, locale: ExperienceLocale) {
  return normalizeExperienceLocaleArray(experience.manual_locales).includes(locale);
}

function retryDelaySeconds(attemptCount: number) {
  return Math.min(300, 30 * Math.max(1, 2 ** Math.max(attemptCount - 1, 0)));
}

async function processTask(
  dependencies: ExperienceTranslationWorkerDependencies,
  task: ExperienceTranslationLeasedTask,
  onProviderAttempt: (provider: ExperienceTranslationProviderName) => void
) {
  const { repository, config } = dependencies;
  const experience = await repository.fetchExperience(task.experience_id);

  if (!experience || experience.translation_version !== task.translation_version) {
    await repository.markTaskCancelled(task, 'Stale translation task');
    return 'cancelled' as const;
  }

  const sourceTitle = getSourceFieldValue(experience, 'title', task.source_locale).trim();
  const sourceDescription = getSourceFieldValue(experience, 'description', task.source_locale).trim();
  const sourceContent = buildSourceTranslationContentFromExperience(
    experience as Record<string, unknown>,
    task.source_locale
  );
  if (!sourceTitle || !sourceDescription) {
    await repository.markTaskFailed(task, experience, 'Missing source content');
    return 'failed' as const;
  }

  await repository.markTaskProcessing(task);
  const dbModel = await repository.getProviderModel(task.provider);
  const model = config.models[task.provider]
    || dbModel
    || (task.provider === 'gemini' ? 'gemini-2.5-flash' : 'grok-3-fast');
  const request: TranslationRequest = {
    sourceLocale: task.source_locale,
    targetLocale: task.target_locale,
    title: sourceTitle,
    description: sourceDescription,
    category: sourceContent.category,
    meetingPoint: sourceContent.meetingPoint,
    supplies: sourceContent.supplies,
    inclusions: sourceContent.inclusions,
    exclusions: sourceContent.exclusions,
    itinerary: sourceContent.itinerary,
    rules: sourceContent.rules,
    model,
  };

  try {
    onProviderAttempt(task.provider);
    const translation = task.provider === 'gemini'
      ? await dependencies.translateGemini(request)
      : await dependencies.translateGrok(request);
    const manual = isManualTargetLocale(experience, task.target_locale);
    const payload: Record<string, unknown> = {
      meeting_point_i18n: mergeLocalizedTextValue(experience.meeting_point_i18n, task.target_locale, translation.meetingPoint),
      supplies_i18n: mergeLocalizedTextValue(experience.supplies_i18n, task.target_locale, translation.supplies),
      inclusions_i18n: mergeLocalizedListValue(experience.inclusions_i18n, task.target_locale, translation.inclusions),
      exclusions_i18n: mergeLocalizedListValue(experience.exclusions_i18n, task.target_locale, translation.exclusions),
      itinerary_i18n: mergeLocalizedItineraryValue(experience.itinerary_i18n, task.target_locale, translation.itinerary),
      rules_i18n: mergeLocalizedRulesValue(experience.rules_i18n, task.target_locale, translation.rules),
      translation_meta: nextTranslationMeta(experience.translation_meta, task.target_locale, {
        mode: manual ? 'manual' : 'ai',
        status: 'ready',
        version: task.translation_version,
      }),
    };
    if (!manual) {
      payload[getLocalizedColumnName('title', task.target_locale)] = translation.title;
      payload[getLocalizedColumnName('description', task.target_locale)] = translation.description;
    }
    if (!await repository.applyExperienceTranslation(task, payload)) {
      await repository.markTaskCancelled(task, 'Stale translation task');
      return 'cancelled' as const;
    }
    await repository.markTaskCompleted(task);
    await repository.recordProviderOutcome(
      task.provider,
      translation.totalTokens,
      null,
      false,
      config.reservedTokens[task.provider]
    );
    return 'completed' as const;
  } catch (error) {
    if (error instanceof ExperienceTranslationInfrastructureError) throw error;
    const providerError = error instanceof TranslationProviderError
      ? error
      : new TranslationProviderError({
          provider: task.provider,
          message: error instanceof Error ? error.message : 'Translation failed',
          retryable: false,
        });
    const attemptCount = task.attempt_count + 1;
    await repository.recordProviderOutcome(
      task.provider,
      0,
      providerError.cooldownSeconds,
      providerError.quota,
      config.reservedTokens[task.provider]
    );
    if (task.provider === 'gemini' && providerError.retryable && config.hasGrokCredential) {
      await repository.markTaskRetryable(task, 'grok', 0, providerError.message);
      return 'retried' as const;
    }
    if (providerError.retryable && attemptCount < config.maxAttempts) {
      await repository.markTaskRetryable(
        task,
        task.provider,
        providerError.cooldownSeconds ?? retryDelaySeconds(attemptCount),
        providerError.message
      );
      return 'retried' as const;
    }
    await repository.markTaskFailed(task, experience, providerError.message);
    return 'failed' as const;
  }
}

export async function runExperienceTranslationWorker(
  dependencies: ExperienceTranslationWorkerDependencies,
  options: { maxTasks?: number } = {}
): Promise<ExperienceTranslationWorkerSummary> {
  const configuredLimit = dependencies.config.batchSize;
  const maxTasks = options.maxTasks === undefined
    ? configuredLimit
    : Math.max(1, Math.min(configuredLimit, options.maxTasks));
  const summary: ExperienceTranslationWorkerSummary = {
    completed: 0,
    failed: 0,
    retried: 0,
    cancelled: 0,
    processed: 0,
    saturated: false,
    providerCalls: { gemini: 0, grok: 0 },
  };
  for (let round = 0; round < maxTasks; round += 1) {
    let leasedAny = false;
    for (const provider of PROVIDER_ORDER) {
      if (summary.processed >= maxTasks) break;
      const task = await dependencies.repository.leaseNextTask(provider, dependencies.config);
      if (!task) continue;
      leasedAny = true;
      const outcome = await processTask(dependencies, task, (attemptedProvider) => {
        summary.providerCalls[attemptedProvider] += 1;
      });
      summary.processed += 1;
      summary[outcome] += 1;
    }
    if (!leasedAny || summary.processed >= maxTasks) break;
  }
  summary.saturated = summary.processed >= maxTasks;
  return summary;
}

function infrastructure(stage: string, code: string) {
  return new ExperienceTranslationInfrastructureError(stage, code);
}

function ensureNoError(error: unknown, stage: string, code: string) {
  if (error) throw infrastructure(stage, code);
}

function createSupabaseRepository(
  supabaseAdmin: SupabaseAdmin
): ExperienceTranslationWorkerRepository {
  async function syncJobStatus(jobId: string) {
    const { data: tasks, error } = await supabaseAdmin
      .from('experience_translation_tasks')
      .select('status')
      .eq('job_id', jobId);
    if (error || !tasks) return;
    const statuses = tasks.map((task) => task.status);
    if (statuses.some((status) => ['queued', 'retryable', 'leased', 'processing'].includes(status))) return;
    const nextStatus = statuses.some((status) => status === 'failed')
      ? 'failed'
      : statuses.some((status) => status === 'completed') ? 'completed' : 'cancelled';
    await supabaseAdmin.from('experience_translation_jobs').update({
      status: nextStatus,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  }

  return {
    async leaseNextTask(provider, config) {
      const { data, error } = await supabaseAdmin.rpc('lease_experience_translation_task', {
        p_provider: provider,
        p_lease_seconds: config.leaseSeconds,
        p_reserved_tokens: config.reservedTokens[provider],
      });
      ensureNoError(error, 'lease', 'lease_rpc_failed');
      if (!Array.isArray(data) || data.length === 0) return null;
      const task = data[0] as Record<string, unknown>;
      if (
        !isExperienceLocale(task.source_locale)
        || !isExperienceLocale(task.target_locale)
        || (task.provider !== 'gemini' && task.provider !== 'grok')
      ) throw infrastructure('lease', 'lease_invalid_shape');
      return {
        id: String(task.id),
        job_id: String(task.job_id),
        experience_id: Number(task.experience_id),
        translation_version: Number(task.translation_version),
        source_locale: task.source_locale,
        target_locale: task.target_locale,
        provider: task.provider,
        attempt_count: Number(task.attempt_count || 0),
        priority: Number(task.priority || 100),
        lease_expires_at: String(task.lease_expires_at),
      };
    },
    async fetchExperience(experienceId) {
      const { data, error } = await supabaseAdmin.from('experiences')
        .select(EXPERIENCE_SELECT).eq('id', experienceId).maybeSingle();
      ensureNoError(error, 'experience_load', 'experience_load_failed');
      if (!data) return null;
      if (!isExperienceLocale(data.source_locale)) {
        throw infrastructure('experience_load', 'experience_invalid_shape');
      }
      return data as ExperienceTranslationRow;
    },
    async getProviderModel(provider) {
      const { data, error } = await supabaseAdmin.from('translation_provider_state')
        .select('provider, model').eq('provider', provider).single();
      ensureNoError(error, 'provider_state', 'provider_state_load_failed');
      if (!data || data.provider !== provider || typeof data.model !== 'string') {
        throw infrastructure('provider_state', 'provider_state_invalid_shape');
      }
      return data.model;
    },
    async markTaskProcessing(task) {
      const { error: taskError } = await supabaseAdmin.from('experience_translation_tasks')
        .update({ status: 'processing', attempt_count: task.attempt_count + 1 }).eq('id', task.id);
      ensureNoError(taskError, 'task_state', 'task_processing_update_failed');
      const { error: jobError } = await supabaseAdmin.from('experience_translation_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', task.job_id);
      ensureNoError(jobError, 'job_state', 'job_processing_update_failed');
    },
    async markTaskCancelled(task, reason) {
      const { error } = await supabaseAdmin.from('experience_translation_tasks').update({
        status: 'cancelled', completed_at: new Date().toISOString(),
        lease_expires_at: null, last_error: reason,
      }).eq('id', task.id);
      ensureNoError(error, 'task_state', 'task_cancel_update_failed');
      await syncJobStatus(task.job_id);
    },
    async markTaskCompleted(task) {
      const { error } = await supabaseAdmin.from('experience_translation_tasks').update({
        status: 'completed', completed_at: new Date().toISOString(),
        lease_expires_at: null, last_error: null,
      }).eq('id', task.id);
      ensureNoError(error, 'task_state', 'task_complete_update_failed');
      await syncJobStatus(task.job_id);
    },
    async markTaskRetryable(task, provider, delaySeconds, lastError) {
      const notBefore = new Date(Date.now() + Math.max(delaySeconds, 0) * 1000).toISOString();
      const { error } = await supabaseAdmin.from('experience_translation_tasks').update({
        provider, status: 'retryable', not_before: notBefore,
        lease_expires_at: null, last_error: lastError,
      }).eq('id', task.id);
      ensureNoError(error, 'task_state', 'task_retryable_update_failed');
    },
    async markTaskFailed(task, experience, lastError) {
      const { error } = await supabaseAdmin.from('experience_translation_tasks').update({
        status: 'failed', completed_at: new Date().toISOString(),
        lease_expires_at: null, last_error: lastError,
      }).eq('id', task.id);
      ensureNoError(error, 'task_state', 'task_failed_update_failed');
      if (experience) {
        const manual = isManualTargetLocale(experience, task.target_locale);
        await supabaseAdmin.from('experiences').update({
          translation_meta: nextTranslationMeta(experience.translation_meta, task.target_locale, {
            mode: manual ? 'manual' : 'ai', status: 'failed', version: task.translation_version,
          }),
        }).eq('id', task.experience_id).eq('translation_version', task.translation_version);
      }
      await syncJobStatus(task.job_id);
    },
    async applyExperienceTranslation(task, payload) {
      const { data, error } = await supabaseAdmin.from('experiences').update(payload)
        .eq('id', task.experience_id).eq('translation_version', task.translation_version)
        .select('id').maybeSingle();
      ensureNoError(error, 'experience_update', 'experience_translation_update_failed');
      return Boolean(data);
    },
    async recordProviderOutcome(provider, tokenCount, cooldownSeconds, hitQuota, reservedTokenCount) {
      const { error } = await supabaseAdmin.rpc('record_translation_provider_outcome', {
        p_provider: provider,
        p_token_count: tokenCount,
        p_cooldown_seconds: cooldownSeconds,
        p_hit_quota: hitQuota,
        p_reserved_token_count: reservedTokenCount,
      });
      ensureNoError(error, 'provider_state', 'provider_outcome_update_failed');
    },
  };
}

function requireEnvironmentString(environment: TranslationEnvironment, name: string) {
  const value = stringValue(environment[name]);
  if (!value) throw infrastructure('runtime', `missing_${name.toLowerCase()}`);
  return value;
}

export function createExperienceTranslationWorkerDependencies(
  environment: TranslationEnvironment,
  options: { explicitCredentials?: boolean; fetch?: typeof fetch } = {}
): ExperienceTranslationWorkerDependencies {
  const runtimeEnvironment = options.explicitCredentials === true ? environment : process.env;
  const supabaseAdmin = createClient(
    requireEnvironmentString(runtimeEnvironment, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnvironmentString(runtimeEnvironment, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: options.fetch ?? fetch },
    }
  ) as unknown as SupabaseAdmin;
  const geminiKey = options.explicitCredentials === true
    ? requireEnvironmentString(environment, 'GEMINI_API_KEY')
    : stringValue(process.env.GEMINI_API_KEY);
  const grokKey = stringValue(environment.XAI_API_KEY);
  return {
    repository: createSupabaseRepository(supabaseAdmin),
    config: readExperienceTranslationWorkerConfig(environment),
    translateGemini: (request) => translateWithGemini(request, { apiKey: geminiKey }),
    translateGrok: (request) => translateWithGrok(request, {
      apiKey: grokKey,
      fetch: options.fetch,
    }),
  };
}
