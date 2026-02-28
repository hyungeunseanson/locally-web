export type LanguageLevel = 1 | 2 | 3 | 4 | 5;

export type LanguageLevelEntry = {
  language: string;
  level: LanguageLevel;
};

const DEFAULT_LEVEL: LanguageLevel = 3;

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

export function formatLanguageLevelLabel(level?: number | null): string {
  switch (level) {
    case 1:
      return 'Lv.1 기초 단계';
    case 2:
      return 'Lv.2 초급 회화';
    case 3:
      return 'Lv.3 일상 회화';
    case 4:
      return 'Lv.4 비즈니스 회화';
    case 5:
      return 'Lv.5 원어민 수준';
    default:
      return '';
  }
}

export function formatLanguageLevelSummary(entries: LanguageLevelEntry[]): string {
  return entries
    .map((entry) => {
      const language = String(entry?.language || '').trim();
      if (!language) return '';
      const level = coerceLevel(entry?.level, DEFAULT_LEVEL);
      return `${language} Lv.${level}`;
    })
    .filter(Boolean)
    .join(' · ');
}
