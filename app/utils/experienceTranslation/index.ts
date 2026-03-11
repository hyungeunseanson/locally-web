import {
  ACTIVITY_LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
  EXPERIENCE_LANGUAGE_OPTIONS,
  FIXED_REFUND_POLICY_LABELS,
} from '@/app/host/create/config';
import type { LanguageLevelEntry } from '@/app/utils/languageLevels';

export const EXPERIENCE_LOCALES = ['ko', 'en', 'ja', 'zh'] as const;

export type ExperienceLocale = (typeof EXPERIENCE_LOCALES)[number];
export type LocalizedField = 'title' | 'description';
export type ExperienceTextField = 'meeting_point' | 'supplies';
export type ExperienceListField = 'inclusions' | 'exclusions';

export type LocalizedTextInput = {
  title: string;
  description: string;
};

export type ManualContent = Partial<Record<ExperienceLocale, LocalizedTextInput>>;

export type TranslationMetaEntry = {
  mode: 'manual' | 'ai';
  status: 'ready' | 'queued' | 'processing' | 'failed';
  version: number;
};

export type ExperienceItineraryTranslationItem = {
  title: string;
  description: string;
  type: string;
  image_url: string;
};

export type ExperienceRulesTranslationInput = {
  age_limit: string;
  activity_level: string;
  refund_policy: string;
};

export type ExperienceSourceTranslationContent = {
  category: string;
  meetingPoint: string;
  supplies: string;
  inclusions: string[];
  exclusions: string[];
  itinerary: ExperienceItineraryTranslationItem[];
  rules: ExperienceRulesTranslationInput;
};

export type ExperienceLocalizedContentColumns = {
  meeting_point_i18n: Partial<Record<ExperienceLocale, string>>;
  supplies_i18n: Partial<Record<ExperienceLocale, string>>;
  inclusions_i18n: Partial<Record<ExperienceLocale, string[]>>;
  exclusions_i18n: Partial<Record<ExperienceLocale, string[]>>;
  itinerary_i18n: Partial<Record<ExperienceLocale, ExperienceItineraryTranslationItem[]>>;
  rules_i18n: Partial<Record<ExperienceLocale, ExperienceRulesTranslationInput>>;
};

export type ExperienceTranslationState = {
  canonicalTitle: string;
  canonicalDescription: string;
  manualLocales: ExperienceLocale[];
  autoLocales: ExperienceLocale[];
  queuedLocales: ExperienceLocale[];
  localizedColumns: Record<string, string | null>;
  localizedContentColumns: ExperienceLocalizedContentColumns;
  translationMeta: Partial<Record<ExperienceLocale, TranslationMetaEntry>>;
};

const localeByLanguageName = new Map(
  EXPERIENCE_LANGUAGE_OPTIONS.map((option) => [option.value, option.code satisfies ExperienceLocale])
);
const categoryOptionByValue = new Map(CATEGORY_OPTIONS.map((option) => [option.value, option]));
const activityLevelOptionByValue = new Map(ACTIVITY_LEVEL_OPTIONS.map((option) => [option.value, option]));

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSafeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asTrimmedString(entry))
    .filter(Boolean);
}

function normalizeItineraryItem(value: unknown): ExperienceItineraryTranslationItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    title: asTrimmedString(raw.title),
    description: asTrimmedString(raw.description),
    type: asTrimmedString(raw.type) || 'spot',
    image_url: asTrimmedString(raw.image_url),
  };
}

function normalizeItineraryArray(value: unknown): ExperienceItineraryTranslationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeItineraryItem(entry))
    .filter((entry): entry is ExperienceItineraryTranslationItem => Boolean(entry));
}

function normalizeRules(value: unknown): ExperienceRulesTranslationInput {
  const raw = getSafeJsonObject(value);

  return {
    age_limit: asTrimmedString(raw.age_limit),
    activity_level: asTrimmedString(raw.activity_level),
    refund_policy: asTrimmedString(raw.refund_policy),
  };
}

function readLocalizedJsonValue(
  row: Record<string, unknown>,
  field: string,
  locale: ExperienceLocale
) {
  const localized = getSafeJsonObject(row[`${field}_i18n`]);
  return localized[locale];
}

function buildLocalizedTextMap(
  sourceLocale: ExperienceLocale,
  value: string
): Partial<Record<ExperienceLocale, string>> {
  const text = value.trim();
  return text ? { [sourceLocale]: text } : {};
}

function buildLocalizedStringListMap(
  sourceLocale: ExperienceLocale,
  values: string[]
): Partial<Record<ExperienceLocale, string[]>> {
  const normalized = normalizeStringArray(values);
  return normalized.length > 0 ? { [sourceLocale]: normalized } : {};
}

function buildLocalizedItineraryMap(
  sourceLocale: ExperienceLocale,
  values: ExperienceItineraryTranslationItem[]
): Partial<Record<ExperienceLocale, ExperienceItineraryTranslationItem[]>> {
  const normalized = normalizeItineraryArray(values);
  return normalized.length > 0 ? { [sourceLocale]: normalized } : {};
}

function buildLocalizedRulesMap(
  sourceLocale: ExperienceLocale,
  value: ExperienceRulesTranslationInput
): Partial<Record<ExperienceLocale, ExperienceRulesTranslationInput>> {
  const normalized = normalizeRules(value);
  return normalized.age_limit || normalized.activity_level || normalized.refund_policy
    ? { [sourceLocale]: normalized }
    : {};
}

export function isExperienceLocale(value: unknown): value is ExperienceLocale {
  return typeof value === 'string' && EXPERIENCE_LOCALES.includes(value as ExperienceLocale);
}

export function normalizeExperienceLocale(value: unknown): ExperienceLocale | null {
  if (!isExperienceLocale(value)) {
    return null;
  }
  return value;
}

export function normalizeExperienceLocaleArray(value: unknown): ExperienceLocale[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<ExperienceLocale>();

  return value
    .map((entry) => normalizeExperienceLocale(entry))
    .filter((locale): locale is ExperienceLocale => Boolean(locale))
    .filter((locale) => {
      if (seen.has(locale)) {
        return false;
      }
      seen.add(locale);
      return true;
    });
}

export function getLocaleForLanguageName(languageName: unknown): ExperienceLocale | null {
  if (typeof languageName !== 'string') {
    return null;
  }

  return localeByLanguageName.get(languageName.trim()) ?? null;
}

export function getManualLocalesFromLanguageLevels(entries: LanguageLevelEntry[]): ExperienceLocale[] {
  const seen = new Set<ExperienceLocale>();

  return entries
    .map((entry) => getLocaleForLanguageName(entry?.language))
    .filter((locale): locale is ExperienceLocale => Boolean(locale))
    .filter((locale) => {
      if (seen.has(locale)) {
        return false;
      }
      seen.add(locale);
      return true;
    });
}

export function getManualLocalesFromManualContent(manualContent: ManualContent): ExperienceLocale[] {
  return EXPERIENCE_LOCALES.filter((locale) => {
    const content = manualContent[locale];
    return Boolean(content?.title?.trim() || content?.description?.trim());
  });
}

export function mergeExperienceLocales(...localeGroups: Array<ExperienceLocale[]>): ExperienceLocale[] {
  const seen = new Set<ExperienceLocale>();
  const merged: ExperienceLocale[] = [];

  for (const locale of EXPERIENCE_LOCALES) {
    for (const group of localeGroups) {
      if (group.includes(locale) && !seen.has(locale)) {
        seen.add(locale);
        merged.push(locale);
        break;
      }
    }
  }

  return merged;
}

export function areExperienceLocaleArraysEqual(left: ExperienceLocale[], right: ExperienceLocale[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((locale, index) => locale === right[index]);
}

export function createEmptyLocalizedTextInput(): LocalizedTextInput {
  return {
    title: '',
    description: '',
  };
}

export function createManualContent(locales: ExperienceLocale[] = []): ManualContent {
  const next: ManualContent = {};

  for (const locale of locales) {
    next[locale] = createEmptyLocalizedTextInput();
  }

  return next;
}

export function mergeManualContent(
  currentContent: ManualContent,
  locales: ExperienceLocale[],
  sourceLocale?: ExperienceLocale | null
): ManualContent {
  const next: ManualContent = {};

  for (const locale of locales) {
    const existing = currentContent[locale];
    next[locale] = {
      title: existing?.title ?? '',
      description: existing?.description ?? '',
    };
  }

  if (sourceLocale && !next[sourceLocale]) {
    next[sourceLocale] = createEmptyLocalizedTextInput();
  }

  return next;
}

export function getLocalizedColumnName(field: LocalizedField, locale: ExperienceLocale): string {
  return `${field}_${locale}`;
}

function readLocalizedColumn(
  row: Record<string, unknown>,
  field: LocalizedField,
  locale: ExperienceLocale
): string {
  const localizedValue = row[getLocalizedColumnName(field, locale)];

  if (typeof localizedValue === 'string' && localizedValue.trim()) {
    return localizedValue;
  }

  if (locale === 'ko' || row.source_locale === locale) {
    const canonicalValue = row[field];
    if (typeof canonicalValue === 'string') {
      return canonicalValue;
    }
  }

  return '';
}

export function buildManualContentFromExperience(
  row: Record<string, unknown>,
  manualLocales: ExperienceLocale[],
  sourceLocale: ExperienceLocale
): ManualContent {
  const locales = new Set<ExperienceLocale>(manualLocales);
  locales.add(sourceLocale);

  const next: ManualContent = {};

  for (const locale of locales) {
    next[locale] = {
      title: readLocalizedColumn(row, 'title', locale),
      description: readLocalizedColumn(row, 'description', locale),
    };
  }

  return next;
}

export function getCanonicalField(
  manualContent: ManualContent,
  sourceLocale: ExperienceLocale,
  field: LocalizedField
): string {
  return String(manualContent[sourceLocale]?.[field] ?? '').trim();
}

export function getLocalizedCategoryLabel(category: unknown, locale: string) {
  const categoryValue = asTrimmedString(category);

  if (!categoryValue) {
    return '';
  }

  const option = categoryOptionByValue.get(categoryValue);
  if (!option) {
    return categoryValue;
  }

  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  return option.labels[targetLocale] || categoryValue;
}

export function getLocalizedActivityLevelLabel(activityLevel: unknown, locale: string) {
  const activityLevelValue = asTrimmedString(activityLevel);

  if (!activityLevelValue) {
    return '';
  }

  const option = activityLevelOptionByValue.get(activityLevelValue);
  if (!option) {
    return activityLevelValue;
  }

  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  return option.labels[targetLocale] || activityLevelValue;
}

export function getLocalizedRefundPolicyLabel(locale: string) {
  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  return FIXED_REFUND_POLICY_LABELS[targetLocale] || FIXED_REFUND_POLICY_LABELS.ko;
}

export function getLocalizedExperienceText(
  row: Record<string, unknown> | null | undefined,
  field: ExperienceTextField,
  locale: string
) {
  if (!row) {
    return '';
  }

  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  const localized = readLocalizedJsonValue(row, field, targetLocale);

  if (typeof localized === 'string' && localized.trim()) {
    return localized.trim();
  }

  return asTrimmedString(row[field]);
}

export function getLocalizedExperienceList(
  row: Record<string, unknown> | null | undefined,
  field: ExperienceListField,
  locale: string
) {
  if (!row) {
    return [] as string[];
  }

  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  const localized = readLocalizedJsonValue(row, field, targetLocale);
  const localizedList = normalizeStringArray(localized);

  if (localizedList.length > 0) {
    return localizedList;
  }

  return normalizeStringArray(row[field]);
}

export function getLocalizedExperienceItinerary(
  row: Record<string, unknown> | null | undefined,
  locale: string
) {
  if (!row) {
    return [] as ExperienceItineraryTranslationItem[];
  }

  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  const localized = normalizeItineraryArray(readLocalizedJsonValue(row, 'itinerary', targetLocale));

  if (localized.length > 0) {
    return localized;
  }

  return normalizeItineraryArray(row.itinerary);
}

export function getLocalizedExperienceRules(
  row: Record<string, unknown> | null | undefined,
  locale: string
) {
  if (!row) {
    return normalizeRules(null);
  }

  const targetLocale = isExperienceLocale(locale) ? locale : 'ko';
  const localized = normalizeRules(readLocalizedJsonValue(row, 'rules', targetLocale));

  if (localized.age_limit || localized.activity_level || localized.refund_policy) {
    return localized;
  }

  return normalizeRules(row.rules);
}

export function buildSourceTranslationContent(params: {
  category: unknown;
  meetingPoint: unknown;
  supplies: unknown;
  inclusions: unknown;
  exclusions: unknown;
  itinerary: unknown;
  rules: unknown;
}): ExperienceSourceTranslationContent {
  return {
    category: asTrimmedString(params.category),
    meetingPoint: asTrimmedString(params.meetingPoint),
    supplies: asTrimmedString(params.supplies),
    inclusions: normalizeStringArray(params.inclusions),
    exclusions: normalizeStringArray(params.exclusions),
    itinerary: normalizeItineraryArray(params.itinerary),
    rules: normalizeRules(params.rules),
  };
}

export function buildSourceTranslationContentFromExperience(
  row: Record<string, unknown>,
  sourceLocale: ExperienceLocale
) {
  const localizedMeetingPoint = readLocalizedJsonValue(row, 'meeting_point', sourceLocale);
  const localizedSupplies = readLocalizedJsonValue(row, 'supplies', sourceLocale);
  const localizedInclusions = readLocalizedJsonValue(row, 'inclusions', sourceLocale);
  const localizedExclusions = readLocalizedJsonValue(row, 'exclusions', sourceLocale);
  const localizedItinerary = readLocalizedJsonValue(row, 'itinerary', sourceLocale);
  const localizedRules = readLocalizedJsonValue(row, 'rules', sourceLocale);

  return buildSourceTranslationContent({
    category: row.category,
    meetingPoint: typeof localizedMeetingPoint === 'string' ? localizedMeetingPoint : row.meeting_point,
    supplies: typeof localizedSupplies === 'string' ? localizedSupplies : row.supplies,
    inclusions: Array.isArray(localizedInclusions) ? localizedInclusions : row.inclusions,
    exclusions: Array.isArray(localizedExclusions) ? localizedExclusions : row.exclusions,
    itinerary: Array.isArray(localizedItinerary) ? localizedItinerary : row.itinerary,
    rules: localizedRules && typeof localizedRules === 'object' ? localizedRules : row.rules,
  });
}

function areItineraryArraysEqual(
  left: ExperienceItineraryTranslationItem[],
  right: ExperienceItineraryTranslationItem[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return item.title === other.title
      && item.description === other.description
      && item.type === other.type
      && item.image_url === other.image_url;
  });
}

export function didSourceTranslationContentChange(
  left: ExperienceSourceTranslationContent,
  right: ExperienceSourceTranslationContent
) {
  return left.category !== right.category
    || left.meetingPoint !== right.meetingPoint
    || left.supplies !== right.supplies
    || !areStringArraysEqual(left.inclusions, right.inclusions)
    || !areStringArraysEqual(left.exclusions, right.exclusions)
    || !areItineraryArraysEqual(left.itinerary, right.itinerary)
    || left.rules.age_limit !== right.rules.age_limit
    || left.rules.activity_level !== right.rules.activity_level
    || left.rules.refund_policy !== right.rules.refund_policy;
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function buildLocalizedContentColumns(params: {
  sourceLocale: ExperienceLocale;
  sourceContent: ExperienceSourceTranslationContent;
}): ExperienceLocalizedContentColumns {
  const { sourceLocale, sourceContent } = params;

  return {
    meeting_point_i18n: buildLocalizedTextMap(sourceLocale, sourceContent.meetingPoint),
    supplies_i18n: buildLocalizedTextMap(sourceLocale, sourceContent.supplies),
    inclusions_i18n: buildLocalizedStringListMap(sourceLocale, sourceContent.inclusions),
    exclusions_i18n: buildLocalizedStringListMap(sourceLocale, sourceContent.exclusions),
    itinerary_i18n: buildLocalizedItineraryMap(sourceLocale, sourceContent.itinerary),
    rules_i18n: buildLocalizedRulesMap(sourceLocale, sourceContent.rules),
  };
}

export function mergeLocalizedTextValue(
  existing: unknown,
  locale: ExperienceLocale,
  value: string
) {
  const next = getSafeJsonObject(existing);
  const text = value.trim();

  if (!text) {
    delete next[locale];
    return next as Partial<Record<ExperienceLocale, string>>;
  }

  next[locale] = text;
  return next as Partial<Record<ExperienceLocale, string>>;
}

export function mergeLocalizedListValue(
  existing: unknown,
  locale: ExperienceLocale,
  value: string[]
) {
  const next = getSafeJsonObject(existing);
  const normalized = normalizeStringArray(value);

  if (normalized.length === 0) {
    delete next[locale];
    return next as Partial<Record<ExperienceLocale, string[]>>;
  }

  next[locale] = normalized;
  return next as Partial<Record<ExperienceLocale, string[]>>;
}

export function mergeLocalizedItineraryValue(
  existing: unknown,
  locale: ExperienceLocale,
  value: ExperienceItineraryTranslationItem[]
) {
  const next = getSafeJsonObject(existing);
  const normalized = normalizeItineraryArray(value);

  if (normalized.length === 0) {
    delete next[locale];
    return next as Partial<Record<ExperienceLocale, ExperienceItineraryTranslationItem[]>>;
  }

  next[locale] = normalized;
  return next as Partial<Record<ExperienceLocale, ExperienceItineraryTranslationItem[]>>;
}

export function mergeLocalizedRulesValue(
  existing: unknown,
  locale: ExperienceLocale,
  value: ExperienceRulesTranslationInput
) {
  const next = getSafeJsonObject(existing);
  const normalized = normalizeRules(value);

  if (!normalized.age_limit && !normalized.activity_level && !normalized.refund_policy) {
    delete next[locale];
    return next as Partial<Record<ExperienceLocale, ExperienceRulesTranslationInput>>;
  }

  next[locale] = normalized;
  return next as Partial<Record<ExperienceLocale, ExperienceRulesTranslationInput>>;
}

export function buildExperienceTranslationState(params: {
  sourceLocale: ExperienceLocale;
  manualContent: ManualContent;
  manualLocales: ExperienceLocale[];
  sourceContent: ExperienceSourceTranslationContent;
  translationVersion: number;
  queuedLocales?: ExperienceLocale[];
}): ExperienceTranslationState {
  const { sourceLocale, manualContent, sourceContent, translationVersion } = params;
  const manualLocales = Array.from(new Set(params.manualLocales.filter((locale) => isExperienceLocale(locale))));

  if (!manualLocales.includes(sourceLocale)) {
    manualLocales.unshift(sourceLocale);
  }

  const canonicalTitle = getCanonicalField(manualContent, sourceLocale, 'title');
  const canonicalDescription = getCanonicalField(manualContent, sourceLocale, 'description');
  const autoLocales = EXPERIENCE_LOCALES.filter((locale) => !manualLocales.includes(locale));
  const queuedLocales = mergeExperienceLocales(
    normalizeExperienceLocaleArray(params.queuedLocales ?? autoLocales)
  ).filter((locale) => locale !== sourceLocale);
  const localizedColumns: Record<string, string | null> = {};

  for (const locale of EXPERIENCE_LOCALES) {
    const content = manualContent[locale];
    localizedColumns[getLocalizedColumnName('title', locale)] = manualLocales.includes(locale)
      ? String(content?.title ?? '').trim() || null
      : null;
    localizedColumns[getLocalizedColumnName('description', locale)] = manualLocales.includes(locale)
      ? String(content?.description ?? '').trim() || null
      : null;
  }

  const translationMeta: Partial<Record<ExperienceLocale, TranslationMetaEntry>> = {};

  for (const locale of manualLocales) {
    translationMeta[locale] = {
      mode: 'manual',
      status: 'ready',
      version: translationVersion,
    };
  }

  for (const locale of autoLocales) {
    translationMeta[locale] = {
      mode: 'ai',
      status: 'queued',
      version: translationVersion,
    };
  }

  return {
    canonicalTitle,
    canonicalDescription,
    manualLocales,
    autoLocales,
    queuedLocales,
    localizedColumns,
    localizedContentColumns: buildLocalizedContentColumns({ sourceLocale, sourceContent }),
    translationMeta,
  };
}
