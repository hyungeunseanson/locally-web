export type LanguageLevel = 1 | 2 | 3 | 4 | 5;

export type LanguageLevelEntry = {
  language: string;
  level: LanguageLevel;
};

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const DEFAULT_LEVEL: LanguageLevel = 3;

const LANGUAGE_LABELS: Record<Locale, Record<string, string>> = {
  ko: {
    ko: '한국어',
    en: '영어',
    ja: '일본어',
    zh: '중국어',
  },
  en: {
    ko: 'Korean',
    en: 'English',
    ja: 'Japanese',
    zh: 'Chinese',
  },
  ja: {
    ko: '韓国語',
    en: '英語',
    ja: '日本語',
    zh: '中国語',
  },
  zh: {
    ko: '韩语',
    en: '英语',
    ja: '日语',
    zh: '中文',
  },
};

const LEVEL_LABELS: Record<Locale, Record<LanguageLevel, string>> = {
  ko: {
    1: 'Lv.1 기초 단계',
    2: 'Lv.2 초급 회화',
    3: 'Lv.3 일상 회화',
    4: 'Lv.4 비즈니스 회화',
    5: 'Lv.5 원어민 수준',
  },
  en: {
    1: 'Lv.1 Basic',
    2: 'Lv.2 Beginner conversation',
    3: 'Lv.3 Everyday conversation',
    4: 'Lv.4 Business conversation',
    5: 'Lv.5 Native level',
  },
  ja: {
    1: 'Lv.1 基礎',
    2: 'Lv.2 初級会話',
    3: 'Lv.3 日常会話',
    4: 'Lv.4 ビジネス会話',
    5: 'Lv.5 ネイティブレベル',
  },
  zh: {
    1: 'Lv.1 基础',
    2: 'Lv.2 初级会话',
    3: 'Lv.3 日常会话',
    4: 'Lv.4 商务会话',
    5: 'Lv.5 母语水平',
  },
};

const LANGUAGE_ALIASES: Record<string, keyof typeof LANGUAGE_LABELS.ko> = {
  'ko': 'ko',
  'kr': 'ko',
  '한국어': 'ko',
  'korean': 'ko',
  'korea': 'ko',
  '한글': 'ko',
  'en': 'en',
  '영어': 'en',
  'english': 'en',
  'eng': 'en',
  'ja': 'ja',
  '일본어': 'ja',
  'japanese': 'ja',
  'jp': 'ja',
  '日本語': 'ja',
  'zh': 'zh',
  '중국어': 'zh',
  'chinese': 'zh',
  'cn': 'zh',
  '中文': 'zh',
};

function normalizeLocale(locale?: string): Locale {
  if (locale === 'en' || locale === 'ja' || locale === 'zh') return locale;
  return 'ko';
}

export function getLocalizedLanguageLabel(language: string, locale: string = 'ko'): string {
  const normalizedLanguage = String(language || '').trim();
  if (!normalizedLanguage) return '';
  const labelLocale = normalizeLocale(locale);
  const alias = LANGUAGE_ALIASES[normalizedLanguage.toLowerCase()];
  return alias ? LANGUAGE_LABELS[labelLocale][alias] : normalizedLanguage;
}

function coerceLevel(value: unknown, fallbackLevel: LanguageLevel): LanguageLevel {
  const parsed = Number(value);
  if (parsed >= 1 && parsed <= 5) {
    return parsed as LanguageLevel;
  }
  return fallbackLevel;
}

export function normalizeLanguageLevels(
  rawLevels: unknown,
  rawLanguages: unknown,
  fallbackLevel: LanguageLevel = DEFAULT_LEVEL
): LanguageLevelEntry[] {
  const seen = new Set<string>();

  if (Array.isArray(rawLevels)) {
    const normalized = rawLevels
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const language = String((entry as { language?: unknown }).language || '').trim();
        if (!language || seen.has(language)) return null;
        seen.add(language);
        return {
          language,
          level: coerceLevel((entry as { level?: unknown }).level, fallbackLevel),
        };
      })
      .filter(Boolean) as LanguageLevelEntry[];

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (!Array.isArray(rawLanguages)) {
    return [];
  }

  return rawLanguages
    .map((language) => String(language || '').trim())
    .filter((language) => {
      if (!language || seen.has(language)) return false;
      seen.add(language);
      return true;
    })
    .map((language) => ({
      language,
      level: fallbackLevel,
    }));
}

export function getLanguageNames(entries: LanguageLevelEntry[]): string[] {
  return entries
    .map((entry) => String(entry?.language || '').trim())
    .filter(Boolean);
}

export function formatLanguageLevelLabel(level?: number | null, locale: string = 'ko'): string {
  if (level === undefined || level === null) return '';
  const normalizedLocale = normalizeLocale(locale);
  const coercedLevel = coerceLevel(level, DEFAULT_LEVEL);
  return LEVEL_LABELS[normalizedLocale][coercedLevel] || '';
}

export function formatLanguageLevelSummary(entries: LanguageLevelEntry[], locale: string = 'ko'): string {
  const normalizedLocale = normalizeLocale(locale);
  return entries
    .map((entry) => {
      const language = getLocalizedLanguageLabel(String(entry?.language || '').trim(), normalizedLocale);
      if (!language) return '';
      const level = coerceLevel(entry?.level, DEFAULT_LEVEL);
      return `${language} Lv.${level}`;
    })
    .filter(Boolean)
    .join(' · ');
}
