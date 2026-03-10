import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  buildSourceTranslationContentFromExperience,
  getLocalizedColumnName,
  isExperienceLocale,
  mergeLocalizedItineraryValue,
  mergeLocalizedListValue,
  mergeLocalizedRulesValue,
  mergeLocalizedTextValue,
  type ExperienceLocale,
  type ExperienceItineraryTranslationItem,
  type ExperienceRulesTranslationInput,
  type TranslationMetaEntry,
} from '@/app/utils/experienceTranslation';
import {
  TranslationProviderError,
  translateWithGemini,
  translateWithGrok,
} from '@/app/utils/experienceTranslation/providers';

type ProviderName = 'gemini' | 'grok';

type LeasedTask = {
  id: string;
  job_id: string;
  experience_id: number;
  translation_version: number;
  source_locale: ExperienceLocale;
  target_locale: ExperienceLocale;
  provider: ProviderName;
  attempt_count: number;
  priority: number;
  lease_expires_at: string;
};

type ProviderStateRow = {
  provider: ProviderName;
  model: string;
};

type ExperienceRow = {
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
  translation_meta?: Record<string, TranslationMetaEntry> | null;
};

const PROVIDER_ORDER: ProviderName[] = ['gemini', 'grok'];
const MAX_BATCH = Number(process.env.TRANSLATION_WORKER_BATCH_SIZE || 4);
const LEASE_SECONDS = Number(process.env.TRANSLATION_TASK_LEASE_SECONDS || 180);
const MAX_ATTEMPTS = Number(process.env.TRANSLATION_MAX_ATTEMPTS || 4);
const RESERVED_TOKENS: Record<ProviderName, number> = {
  gemini: Number(process.env.TRANSLATION_GEMINI_RESERVED_TOKENS || 3500),
  grok: Number(process.env.TRANSLATION_GROK_RESERVED_TOKENS || 3500),
};

function getProviderModel(provider: ProviderName, dbModel: string) {
  if (provider === 'gemini') {
    return process.env.TRANSLATION_GEMINI_MODEL || dbModel || 'gemini-2.5-flash';
  }

  return process.env.TRANSLATION_GROK_MODEL || dbModel || 'grok-3-fast';
}

function getSourceFieldValue(experience: ExperienceRow, field: 'title' | 'description', locale: ExperienceLocale) {
  const localizedValue = experience[getLocalizedColumnName(field, locale) as keyof ExperienceRow];
  if (typeof localizedValue === 'string' && localizedValue.trim()) {
    return localizedValue;
  }

  const canonical = experience[field];
  return typeof canonical === 'string' ? canonical : '';
}

function getSafeTranslationMeta(meta: ExperienceRow['translation_meta']) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {} as Record<string, TranslationMetaEntry>;
  }

  return { ...meta };
}

function buildNextTranslationMeta(
  currentMeta: ExperienceRow['translation_meta'],
  locale: ExperienceLocale,
  nextEntry: TranslationMetaEntry
) {
  return {
    ...getSafeTranslationMeta(currentMeta),
    [locale]: nextEntry,
  };
}

function getRetryDelaySeconds(attemptCount: number) {
  return Math.min(300, 30 * Math.max(1, 2 ** Math.max(attemptCount - 1, 0)));
}

async function recordProviderOutcome(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  provider: ProviderName,
  tokenCount: number,
  cooldownSeconds?: number | null,
  hitQuota?: boolean,
  reservedTokenCount?: number
) {
  await supabaseAdmin.rpc('record_translation_provider_outcome', {
    p_provider: provider,
    p_token_count: tokenCount,
    p_cooldown_seconds: cooldownSeconds ?? null,
    p_hit_quota: Boolean(hitQuota),
    p_reserved_token_count: reservedTokenCount ?? 0,
  });
}

async function syncJobStatus(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  jobId: string
) {
  const { data: tasks, error } = await supabaseAdmin
    .from('experience_translation_tasks')
    .select('status')
    .eq('job_id', jobId);

  if (error || !tasks) {
    return;
  }

  const statuses = tasks.map((task) => task.status);
  const hasActive = statuses.some((status) => ['queued', 'retryable', 'leased', 'processing'].includes(status));

  if (hasActive) {
    return;
  }

  const hasFailed = statuses.some((status) => status === 'failed');
  const hasCompleted = statuses.some((status) => status === 'completed');
  const nextStatus = hasFailed ? 'failed' : hasCompleted ? 'completed' : 'cancelled';

  await supabaseAdmin
    .from('experience_translation_jobs')
    .update({
      status: nextStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

async function leaseNextTask(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  provider: ProviderName
) {
  const { data, error } = await supabaseAdmin.rpc('lease_experience_translation_task', {
    p_provider: provider,
    p_lease_seconds: LEASE_SECONDS,
    p_reserved_tokens: RESERVED_TOKENS[provider],
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const task = data[0] as Record<string, unknown>;

  if (
    !isExperienceLocale(task.source_locale)
    || !isExperienceLocale(task.target_locale)
    || (task.provider !== 'gemini' && task.provider !== 'grok')
  ) {
    return null;
  }

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
  } satisfies LeasedTask;
}

async function getProviderState(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  provider: ProviderName
) {
  const { data, error } = await supabaseAdmin
    .from('translation_provider_state')
    .select('provider, model')
    .eq('provider', provider)
    .single();

  if (error || !data) {
    throw new Error(`Missing provider state for ${provider}`);
  }

  return data as ProviderStateRow;
}

async function markTaskProcessing(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  task: LeasedTask
) {
  await supabaseAdmin
    .from('experience_translation_tasks')
    .update({
      status: 'processing',
      attempt_count: task.attempt_count + 1,
    })
    .eq('id', task.id);

  await supabaseAdmin
    .from('experience_translation_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', task.job_id);
}

async function markTaskCancelled(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  task: LeasedTask,
  reason: string
) {
  await supabaseAdmin
    .from('experience_translation_tasks')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
      last_error: reason,
    })
    .eq('id', task.id);

  await syncJobStatus(supabaseAdmin, task.job_id);
}

async function markTaskCompleted(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  task: LeasedTask
) {
  await supabaseAdmin
    .from('experience_translation_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
      last_error: null,
    })
    .eq('id', task.id);

  await syncJobStatus(supabaseAdmin, task.job_id);
}

async function markTaskRetryable(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  task: LeasedTask,
  provider: ProviderName,
  delaySeconds: number,
  lastError: string
) {
  const nextDate = new Date(Date.now() + Math.max(delaySeconds, 0) * 1000).toISOString();

  await supabaseAdmin
    .from('experience_translation_tasks')
    .update({
      provider,
      status: 'retryable',
      not_before: nextDate,
      lease_expires_at: null,
      last_error: lastError,
    })
    .eq('id', task.id);
}

async function markTaskFailed(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  task: LeasedTask,
  experience: ExperienceRow | null,
  lastError: string
) {
  await supabaseAdmin
    .from('experience_translation_tasks')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
      last_error: lastError,
    })
    .eq('id', task.id);

  if (experience) {
    await supabaseAdmin
      .from('experiences')
      .update({
        translation_meta: buildNextTranslationMeta(experience.translation_meta, task.target_locale, {
          mode: 'ai',
          status: 'failed',
          version: task.translation_version,
        }),
      })
      .eq('id', task.experience_id)
      .eq('translation_version', task.translation_version);
  }

  await syncJobStatus(supabaseAdmin, task.job_id);
}

async function fetchExperience(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  experienceId: number
) {
  const { data, error } = await supabaseAdmin
    .from('experiences')
    .select('id, source_locale, translation_version, category, title, description, meeting_point, meeting_point_i18n, supplies, supplies_i18n, inclusions, inclusions_i18n, exclusions, exclusions_i18n, itinerary, itinerary_i18n, rules, rules_i18n, title_ko, title_en, title_ja, title_zh, description_ko, description_en, description_ja, description_zh, translation_meta')
    .eq('id', experienceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (!isExperienceLocale(data.source_locale)) {
    return null;
  }

  return data as ExperienceRow;
}

async function processTask(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  task: LeasedTask
) {
  const experience = await fetchExperience(supabaseAdmin, task.experience_id);

  if (!experience || experience.translation_version !== task.translation_version) {
    await markTaskCancelled(supabaseAdmin, task, 'Stale translation task');
    return 'cancelled' as const;
  }

  const sourceTitle = getSourceFieldValue(experience, 'title', task.source_locale).trim();
  const sourceDescription = getSourceFieldValue(experience, 'description', task.source_locale).trim();
  const sourceContent = buildSourceTranslationContentFromExperience(
    experience as Record<string, unknown>,
    task.source_locale
  );

  if (!sourceTitle || !sourceDescription) {
    await markTaskFailed(supabaseAdmin, task, experience, 'Missing source content');
    return 'failed' as const;
  }

  await markTaskProcessing(supabaseAdmin, task);

  const providerState = await getProviderState(supabaseAdmin, task.provider);
  const model = getProviderModel(task.provider, providerState.model);

  try {
    const translation = task.provider === 'gemini'
      ? await translateWithGemini({
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
        })
      : await translateWithGrok({
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
        });

    const titleField = getLocalizedColumnName('title', task.target_locale);
    const descriptionField = getLocalizedColumnName('description', task.target_locale);
    const nextTranslationMeta = buildNextTranslationMeta(experience.translation_meta, task.target_locale, {
      mode: 'ai',
      status: 'ready',
      version: task.translation_version,
    });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('experiences')
      .update({
        [titleField]: translation.title,
        [descriptionField]: translation.description,
        meeting_point_i18n: mergeLocalizedTextValue(experience.meeting_point_i18n, task.target_locale, translation.meetingPoint),
        supplies_i18n: mergeLocalizedTextValue(experience.supplies_i18n, task.target_locale, translation.supplies),
        inclusions_i18n: mergeLocalizedListValue(experience.inclusions_i18n, task.target_locale, translation.inclusions),
        exclusions_i18n: mergeLocalizedListValue(experience.exclusions_i18n, task.target_locale, translation.exclusions),
        itinerary_i18n: mergeLocalizedItineraryValue(experience.itinerary_i18n, task.target_locale, translation.itinerary),
        rules_i18n: mergeLocalizedRulesValue(experience.rules_i18n, task.target_locale, translation.rules),
        translation_meta: nextTranslationMeta,
      })
      .eq('id', task.experience_id)
      .eq('translation_version', task.translation_version)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      await markTaskCancelled(supabaseAdmin, task, 'Stale translation task');
      return 'cancelled' as const;
    }

    await markTaskCompleted(supabaseAdmin, task);
    await recordProviderOutcome(
      supabaseAdmin,
      task.provider,
      translation.totalTokens,
      null,
      false,
      RESERVED_TOKENS[task.provider]
    );

    return 'completed' as const;
  } catch (error) {
    const providerError = error instanceof TranslationProviderError
      ? error
      : new TranslationProviderError({
          provider: task.provider,
          message: error instanceof Error ? error.message : 'Translation failed',
          retryable: false,
        });
    const attemptCount = task.attempt_count + 1;

    await recordProviderOutcome(
      supabaseAdmin,
      task.provider,
      0,
      providerError.cooldownSeconds,
      providerError.quota,
      RESERVED_TOKENS[task.provider]
    );

    if (task.provider === 'gemini' && providerError.retryable && process.env.XAI_API_KEY) {
      await markTaskRetryable(supabaseAdmin, task, 'grok', 0, providerError.message);
      return 'retried' as const;
    }

    if (providerError.retryable && attemptCount < MAX_ATTEMPTS) {
      await markTaskRetryable(
        supabaseAdmin,
        task,
        task.provider,
        providerError.cooldownSeconds ?? getRetryDelaySeconds(attemptCount),
        providerError.message
      );
      return 'retried' as const;
    }

    await markTaskFailed(supabaseAdmin, task, experience, providerError.message);
    return 'failed' as const;
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const summary = {
    completed: 0,
    failed: 0,
    retried: 0,
    cancelled: 0,
    processed: 0,
  };

  try {
    for (let round = 0; round < MAX_BATCH; round += 1) {
      let leasedAny = false;

      for (const provider of PROVIDER_ORDER) {
        if (summary.processed >= MAX_BATCH) {
          break;
        }

        const task = await leaseNextTask(supabaseAdmin, provider);
        if (!task) {
          continue;
        }

        leasedAny = true;
        const outcome = await processTask(supabaseAdmin, task);
        summary.processed += 1;
        summary[outcome] += 1;
      }

      if (!leasedAny || summary.processed >= MAX_BATCH) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('[Cron Experience Translations] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
