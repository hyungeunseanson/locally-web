import { NextResponse } from 'next/server';
import { FIXED_REFUND_POLICY, MAX_EXPERIENCE_PHOTOS } from '@/app/host/create/config';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { normalizeLanguageLevels, getLanguageNames, type LanguageLevelEntry } from '@/app/utils/languageLevels';
import {
  areExperienceLocaleArraysEqual,
  buildExperienceTranslationState,
  buildManualContentFromExperience,
  buildSourceTranslationContent,
  buildSourceTranslationContentFromExperience,
  createEmptyLocalizedTextInput,
  didSourceTranslationContentChange,
  EXPERIENCE_LOCALES,
  getManualLocalesFromLanguageLevels,
  getManualLocalesFromManualContent,
  isExperienceLocale,
  mergeExperienceLocales,
  normalizeExperienceLocale,
  normalizeExperienceLocaleArray,
  type ExperienceLocale,
  type ManualContent,
  type ExperienceSourceTranslationContent,
  type TranslationMetaEntry,
} from '@/app/utils/experienceTranslation';

type RouteActor = {
  id: string;
  email: string | null;
  isAdmin: boolean;
};

type ExperienceWriteBody = {
  country?: unknown;
  city?: unknown;
  category?: unknown;
  language_levels?: unknown;
  languages?: unknown;
  source_locale?: unknown;
  manual_locales?: unknown;
  manual_content?: unknown;
  photos?: unknown;
  location?: unknown;
  itinerary?: unknown;
  inclusions?: unknown;
  exclusions?: unknown;
  supplies?: unknown;
  duration?: unknown;
  maxGuests?: unknown;
  max_guests?: unknown;
  meeting_point?: unknown;
  rules?: unknown;
  price?: unknown;
  is_private_enabled?: unknown;
  private_price?: unknown;
};

type NormalizedItineraryItem = {
  title: string;
  description: string;
  type: 'meet' | 'spot' | 'end';
  image_url: string;
};

type NormalizedExperienceWriteInput = {
  country: string;
  city: string;
  category: string;
  languageLevels: LanguageLevelEntry[];
  requestedManualLocales: ExperienceLocale[];
  sourceLocale: ExperienceLocale;
  manualContent: ManualContent;
  sourceContent: ExperienceSourceTranslationContent;
  photos: string[];
  location: string;
  itinerary: NormalizedItineraryItem[];
  inclusions: string[];
  exclusions: string[];
  supplies: string;
  duration: number;
  maxGuests: number;
  meetingPoint: string;
  rules: {
    age_limit: string;
    activity_level: string;
    refund_policy: string;
  };
  price: number;
  isPrivateEnabled: boolean;
  privatePrice: number;
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asTrimmedString(item))
    .filter(Boolean);
}

function parseManualContent(value: unknown): ManualContent {
  const next: ManualContent = {};

  if (!value || typeof value !== 'object') {
    return next;
  }

  for (const locale of EXPERIENCE_LOCALES) {
    const rawEntry = (value as Record<string, unknown>)[locale];
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;
    next[locale] = {
      title: asTrimmedString(entry.title),
      description: asTrimmedString(entry.description),
    };
  }

  return next;
}

function parseItinerary(value: unknown): NormalizedItineraryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const rawType = asTrimmedString(raw.type);
      const type = rawType === 'meet' || rawType === 'end' ? rawType : 'spot';

      return {
        title: asTrimmedString(raw.title),
        description: asTrimmedString(raw.description),
        type,
        image_url: asTrimmedString(raw.image_url),
      } satisfies NormalizedItineraryItem;
    })
    .filter((item): item is NormalizedItineraryItem => Boolean(item));
}

function buildFailedTranslationMeta(
  version: number,
  manualLocales: ExperienceLocale[],
  autoLocales: ExperienceLocale[]
): Partial<Record<ExperienceLocale, TranslationMetaEntry>> {
  const meta: Partial<Record<ExperienceLocale, TranslationMetaEntry>> = {};

  for (const locale of manualLocales) {
    meta[locale] = {
      mode: 'manual',
      status: 'ready',
      version,
    };
  }

  for (const locale of autoLocales) {
    meta[locale] = {
      mode: 'ai',
      status: 'failed',
      version,
    };
  }

  return meta;
}

function getQueuedTranslationLocales(params: {
  sourceLocale: ExperienceLocale;
  manualLocales: ExperienceLocale[];
  existingManualLocales?: ExperienceLocale[];
  sourceContentDirty: boolean;
}) {
  const manualContentLocales = params.manualLocales.filter((locale) => locale !== params.sourceLocale);
  const existingManualLocales = params.existingManualLocales ?? [];

  const manualContentTargets = manualContentLocales.filter((locale) => (
    params.sourceContentDirty || !existingManualLocales.includes(locale)
  ));
  const autoLocales = EXPERIENCE_LOCALES.filter((locale) => !params.manualLocales.includes(locale));

  return mergeExperienceLocales(autoLocales, manualContentTargets).filter(
    (locale) => locale !== params.sourceLocale
  );
}

function mergeManualContentWithExisting(params: {
  locales: ExperienceLocale[];
  writableLocales: ExperienceLocale[];
  existingContent: ManualContent;
  incomingContent: ManualContent;
}) {
  const next: ManualContent = {};

  for (const locale of params.locales) {
    const existing = params.existingContent[locale] ?? createEmptyLocalizedTextInput();
    const incoming = params.incomingContent[locale];
    const allowIncoming = params.writableLocales.includes(locale);

    next[locale] = {
      title: allowIncoming ? (incoming?.title ?? existing.title) : existing.title,
      description: allowIncoming ? (incoming?.description ?? existing.description) : existing.description,
    };
  }

  return next;
}

function didManualContentChange(
  left: ManualContent,
  right: ManualContent,
  locales: ExperienceLocale[]
) {
  return locales.some((locale) => {
    const leftEntry = left[locale] ?? createEmptyLocalizedTextInput();
    const rightEntry = right[locale] ?? createEmptyLocalizedTextInput();

    return leftEntry.title.trim() !== rightEntry.title.trim()
      || leftEntry.description.trim() !== rightEntry.description.trim();
  });
}

function normalizeExperienceWriteBody(body: ExperienceWriteBody): NormalizedExperienceWriteInput {
  const country = asTrimmedString(body.country);
  const city = asTrimmedString(body.city);
  const category = asTrimmedString(body.category);
  const languageLevels = normalizeLanguageLevels(body.language_levels, body.languages ?? [], 3);
  const manualContent = parseManualContent(body.manual_content);
  const requestedManualLocales = mergeExperienceLocales(
    normalizeExperienceLocaleArray(body.manual_locales),
    getManualLocalesFromLanguageLevels(languageLevels),
    getManualLocalesFromManualContent(manualContent)
  );
  const sourceLocale = normalizeExperienceLocale(body.source_locale);
  const photos = parseStringArray(body.photos).slice(0, MAX_EXPERIENCE_PHOTOS);
  const itinerary = parseItinerary(body.itinerary);
  const inclusions = parseStringArray(body.inclusions);
  const exclusions = parseStringArray(body.exclusions);
  const supplies = asTrimmedString(body.supplies);
  const duration = asNumber(body.duration);
  const maxGuests = asNumber(body.maxGuests ?? body.max_guests);
  const meetingPoint = asTrimmedString(body.meeting_point);
  const location = asTrimmedString(body.location);
  const rules = body.rules && typeof body.rules === 'object' ? body.rules as Record<string, unknown> : {};
  const ageLimit = asTrimmedString(rules.age_limit);
  const activityLevel = asTrimmedString(rules.activity_level);
  const price = asNumber(body.price);
  const isPrivateEnabled = Boolean(body.is_private_enabled);
  const privatePrice = isPrivateEnabled ? asNumber(body.private_price) : 0;

  if (!city) {
    throw new ApiError(400, '도시를 입력해주세요.');
  }
  if (!category) {
    throw new ApiError(400, '카테고리를 선택해주세요.');
  }
  if (languageLevels.length === 0 || requestedManualLocales.length === 0) {
    throw new ApiError(400, '진행 가능한 언어를 1개 이상 선택해주세요.');
  }
  if (!sourceLocale || !requestedManualLocales.includes(sourceLocale)) {
    throw new ApiError(400, '대표 원문 언어를 선택해주세요.');
  }
  if (photos.length === 0) {
    throw new ApiError(400, '대표 사진을 1장 이상 업로드해주세요.');
  }
  if (photos.length > MAX_EXPERIENCE_PHOTOS) {
    throw new ApiError(400, `대표 사진은 최대 ${MAX_EXPERIENCE_PHOTOS}장까지 업로드 가능합니다.`);
  }
  if (!meetingPoint) {
    throw new ApiError(400, '만나는 장소를 입력해주세요.');
  }
  if (!location) {
    throw new ApiError(400, '정확한 주소를 입력해주세요.');
  }
  if (itinerary.length === 0 || itinerary.some((item) => !item.title)) {
    throw new ApiError(400, '이동 동선의 장소 이름을 모두 입력해주세요.');
  }
  if (inclusions.length === 0) {
    throw new ApiError(400, '포함 사항을 1개 이상 입력해주세요.');
  }
  if (!ageLimit) {
    throw new ApiError(400, '참가 연령 기준을 입력해주세요.');
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ApiError(400, '소요 시간을 올바르게 입력해주세요.');
  }
  if (!Number.isFinite(maxGuests) || maxGuests <= 0) {
    throw new ApiError(400, '최대 인원을 올바르게 입력해주세요.');
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new ApiError(400, '기본 가격을 올바르게 입력해주세요.');
  }
  if (isPrivateEnabled && (!Number.isFinite(privatePrice) || privatePrice <= 0)) {
    throw new ApiError(400, '단독 투어 가격을 입력해주세요.');
  }

  for (const locale of requestedManualLocales) {
    const entry = manualContent[locale] ?? createEmptyLocalizedTextInput();
    if (entry.title.trim().length < 6) {
      throw new ApiError(400, '선택한 언어의 제목을 6자 이상 입력해주세요.');
    }
    if (entry.description.trim().length < 30) {
      throw new ApiError(400, '선택한 언어의 소개글을 30자 이상 입력해주세요.');
    }
  }

  return {
    country,
    city,
    category,
    languageLevels,
    requestedManualLocales,
    sourceLocale,
    manualContent,
    sourceContent: buildSourceTranslationContent({
      category,
      meetingPoint,
      supplies,
      inclusions,
      exclusions,
      itinerary,
      rules: {
        age_limit: ageLimit,
        activity_level: activityLevel || '보통',
        refund_policy: FIXED_REFUND_POLICY,
      },
    }),
    photos,
    location,
    itinerary,
    inclusions,
    exclusions,
    supplies,
    duration,
    maxGuests,
    meetingPoint,
    rules: {
      age_limit: ageLimit,
      activity_level: activityLevel || '보통',
      refund_policy: FIXED_REFUND_POLICY,
    },
    price,
    isPrivateEnabled,
    privatePrice: isPrivateEnabled ? privatePrice : 0,
  };
}

export function toApiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }

  console.error('[Experience API] Unexpected error:', error);
  return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
}

export async function getRouteActor() {
  const { createClient: createServerClient } = await import('@/app/utils/supabase/server');
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const supabaseAdmin = createAdminClient();
  const [profileRes, whitelistRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
  ]);

  return {
    actor: {
      id: user.id,
      email: user.email ?? null,
      isAdmin: profileRes.data?.role === 'admin' || Boolean(whitelistRes.data),
    } satisfies RouteActor,
    supabaseAdmin,
  };
}

async function enqueueTranslationJob(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  experienceId: number;
  sourceLocale: ExperienceLocale;
  translationVersion: number;
  targetLocales: ExperienceLocale[];
}) {
  const { supabaseAdmin, experienceId, sourceLocale, translationVersion, targetLocales } = params;

  if (targetLocales.length === 0) {
    return;
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('experience_translation_jobs')
    .insert({
      experience_id: experienceId,
      translation_version: translationVersion,
      source_locale: sourceLocale,
      status: 'queued',
    })
    .select('id')
    .single();

  if (jobError || !job) {
    throw jobError ?? new Error('Failed to create translation job.');
  }

  const { error: taskError } = await supabaseAdmin
    .from('experience_translation_tasks')
    .insert(
      targetLocales.map((locale) => ({
        job_id: job.id,
        experience_id: experienceId,
        translation_version: translationVersion,
        source_locale: sourceLocale,
        target_locale: locale,
        provider: 'gemini',
        status: 'queued',
      }))
    );

  if (taskError) {
    await supabaseAdmin.from('experience_translation_jobs').delete().eq('id', job.id);
    throw taskError;
  }
}

async function markTranslationQueueFailure(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  experienceId: number;
  version: number;
  manualLocales: ExperienceLocale[];
  autoLocales: ExperienceLocale[];
}) {
  const { supabaseAdmin, experienceId, version, manualLocales, autoLocales } = params;

  await supabaseAdmin
    .from('experiences')
    .update({
      translation_meta: buildFailedTranslationMeta(version, manualLocales, autoLocales),
    })
    .eq('id', experienceId);
}

export async function createExperienceFromBody(body: ExperienceWriteBody, actor: RouteActor) {
  const input = normalizeExperienceWriteBody(body);
  const translationVersion = 1;
  const queuedLocales = getQueuedTranslationLocales({
    sourceLocale: input.sourceLocale,
    manualLocales: input.requestedManualLocales,
    sourceContentDirty: true,
  });
  const translationState = buildExperienceTranslationState({
    sourceLocale: input.sourceLocale,
    manualContent: input.manualContent,
    manualLocales: input.requestedManualLocales,
    sourceContent: input.sourceContent,
    translationVersion,
    queuedLocales,
  });
  const supabaseAdmin = createAdminClient();
  const languageNames = getLanguageNames(input.languageLevels);

  const { data, error } = await supabaseAdmin
    .from('experiences')
    .insert({
      host_id: actor.id,
      country: input.country,
      city: input.city,
      title: translationState.canonicalTitle,
      category: input.category,
      languages: languageNames,
      language_levels: input.languageLevels,
      duration: input.duration,
      max_guests: input.maxGuests,
      description: translationState.canonicalDescription,
      itinerary: input.itinerary,
      spots: input.itinerary.map((item) => item.title).join(' -> '),
      meeting_point: input.meetingPoint,
      location: input.location,
      photos: input.photos,
      price: input.price,
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      supplies: input.supplies,
      rules: input.rules,
      status: 'pending',
      is_private_enabled: input.isPrivateEnabled,
      private_price: input.privatePrice,
      source_locale: input.sourceLocale,
      manual_locales: translationState.manualLocales,
      translation_version: translationVersion,
      translation_meta: translationState.translationMeta,
      ...translationState.localizedColumns,
      ...translationState.localizedContentColumns,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create experience.');
  }

  if (translationState.queuedLocales.length > 0) {
    try {
      await enqueueTranslationJob({
        supabaseAdmin,
        experienceId: data.id,
        sourceLocale: input.sourceLocale,
        translationVersion,
        targetLocales: translationState.queuedLocales,
      });
    } catch (queueError) {
      console.error('[Experience API] Failed to enqueue translation job:', queueError);
      await markTranslationQueueFailure({
        supabaseAdmin,
        experienceId: data.id,
        version: translationVersion,
        manualLocales: translationState.manualLocales,
        autoLocales: translationState.autoLocales,
      });
    }
  }

  if (!actor.isAdmin) {
    insertAdminAlerts({
      title: '새 체험 신청이 접수되었습니다',
      message: `'${translationState.canonicalTitle}' 체험이 신규 제출되었습니다.`,
      link: '/admin/dashboard?tab=APPROVALS',
    }).catch((adminAlertError) => {
      console.error('[Experience API] Failed to insert admin alert:', adminAlertError);
    });
  }

  return {
    id: data.id,
    queuedLocales: translationState.queuedLocales,
  };
}

export async function updateExperienceFromBody(params: {
  experienceId: number;
  body: ExperienceWriteBody;
  actor: RouteActor;
}) {
  const { experienceId, body, actor } = params;
  const input = normalizeExperienceWriteBody(body);
  const supabaseAdmin = createAdminClient();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('experiences')
    .select('id, host_id, translation_version, source_locale, manual_locales, title, description, title_ko, title_en, title_ja, title_zh, description_ko, description_en, description_ja, description_zh, category, meeting_point, meeting_point_i18n, supplies, supplies_i18n, inclusions, inclusions_i18n, exclusions, exclusions_i18n, itinerary, itinerary_i18n, rules, rules_i18n')
    .eq('id', experienceId)
    .maybeSingle();

  if (existingError || !existing) {
    throw new ApiError(404, '체험을 찾을 수 없습니다.');
  }

  if (!actor.isAdmin && existing.host_id !== actor.id) {
    throw new ApiError(403, '수정 권한이 없습니다.');
  }

  const existingSourceLocale = isExperienceLocale(existing.source_locale) ? existing.source_locale : 'ko';
  const existingManualLocales = mergeExperienceLocales(normalizeExperienceLocaleArray(existing.manual_locales));
  const mergedManualLocales = mergeExperienceLocales(existingManualLocales, input.requestedManualLocales);
  const existingManualContent = buildManualContentFromExperience(
    existing as Record<string, unknown>,
    mergedManualLocales,
    existingSourceLocale
  );
  const existingSourceContent = buildSourceTranslationContentFromExperience(
    existing as Record<string, unknown>,
    existingSourceLocale
  );
  const nextManualContent = mergeManualContentWithExisting({
    locales: mergedManualLocales,
    writableLocales: input.requestedManualLocales,
    existingContent: existingManualContent,
    incomingContent: input.manualContent,
  });
  const nextSourceContent = input.sourceContent;
  const sourceContentDirty = existingSourceLocale !== input.sourceLocale
    || didSourceTranslationContentChange(existingSourceContent, nextSourceContent);
  const translationDirty = existingSourceLocale !== input.sourceLocale
    || !areExperienceLocaleArraysEqual(existingManualLocales, mergedManualLocales)
    || didManualContentChange(existingManualContent, nextManualContent, mergedManualLocales)
    || sourceContentDirty;
  const translationVersion = translationDirty
    ? Math.max(Number(existing.translation_version) || 1, 1) + 1
    : Math.max(Number(existing.translation_version) || 1, 1);
  const queuedLocales = getQueuedTranslationLocales({
    sourceLocale: input.sourceLocale,
    manualLocales: mergedManualLocales,
    existingManualLocales,
    sourceContentDirty,
  });
  const translationState = buildExperienceTranslationState({
    sourceLocale: input.sourceLocale,
    manualContent: nextManualContent,
    manualLocales: mergedManualLocales,
    sourceContent: nextSourceContent,
    translationVersion,
    queuedLocales,
  });
  const languageNames = getLanguageNames(input.languageLevels);

  const updatePayload: Record<string, unknown> = {
    country: input.country,
    city: input.city,
    category: input.category,
    languages: languageNames,
    language_levels: input.languageLevels,
    duration: input.duration,
    max_guests: input.maxGuests,
    itinerary: input.itinerary,
    spots: input.itinerary.map((item) => item.title).join(' -> '),
    meeting_point: input.meetingPoint,
    location: input.location,
    photos: input.photos,
    price: input.price,
    inclusions: input.inclusions,
    exclusions: input.exclusions,
    supplies: input.supplies,
    rules: input.rules,
    is_private_enabled: input.isPrivateEnabled,
    private_price: input.privatePrice,
  };

  if (translationDirty) {
    Object.assign(updatePayload, {
      title: translationState.canonicalTitle,
      description: translationState.canonicalDescription,
      source_locale: input.sourceLocale,
      manual_locales: translationState.manualLocales,
      translation_version: translationVersion,
      translation_meta: translationState.translationMeta,
      ...translationState.localizedColumns,
      ...translationState.localizedContentColumns,
    });
  }

  const updateQuery = supabaseAdmin
    .from('experiences')
    .update(updatePayload)
    .eq('id', experienceId);

  if (!actor.isAdmin) {
    updateQuery.eq('host_id', actor.id);
  }

  const { data, error } = await updateQuery.select('id').maybeSingle();

  if (error || !data) {
    throw error ?? new ApiError(500, '체험 저장에 실패했습니다.');
  }

  if (translationDirty && translationState.queuedLocales.length > 0) {
    try {
      await enqueueTranslationJob({
        supabaseAdmin,
        experienceId,
        sourceLocale: input.sourceLocale,
        translationVersion,
        targetLocales: translationState.queuedLocales,
      });
    } catch (queueError) {
      console.error('[Experience API] Failed to enqueue translation job:', queueError);
      await markTranslationQueueFailure({
        supabaseAdmin,
        experienceId,
        version: translationVersion,
        manualLocales: translationState.manualLocales,
        autoLocales: translationState.autoLocales,
      });
    }
  }

  return {
    id: data.id,
    queuedLocales: translationDirty ? translationState.queuedLocales : [],
  };
}
