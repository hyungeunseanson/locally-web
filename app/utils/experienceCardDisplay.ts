import { getLocalizedLanguageLabel } from '@/app/utils/languageLevels';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const normalizeLocale = (locale: string): Locale => {
  if (locale === 'en' || locale === 'ja' || locale === 'zh') return locale;
  return 'ko';
};

export function getExperienceDurationHours(rawDuration: unknown): string | null {
  if (rawDuration == null) return null;

  if (typeof rawDuration === 'string' && rawDuration.trim() === '') {
    return null;
  }

  const duration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Number.isInteger(duration) ? String(duration) : duration.toString();
}

export function getNormalizedExperiencePrice(rawPrice: unknown): number | null {
  if (rawPrice == null) return null;

  if (typeof rawPrice === 'string' && rawPrice.trim() === '') {
    return null;
  }

  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
}

export function formatExperiencePrice(rawPrice: unknown): string | null {
  const price = getNormalizedExperiencePrice(rawPrice);
  return price === null ? null : price.toLocaleString();
}

export function getExperienceLanguageBadges(rawLanguages: unknown, locale: string, maxVisible: number = 2) {
  const normalizedLocale = normalizeLocale(locale);
  const labels = Array.isArray(rawLanguages)
    ? Array.from(
        new Set(
          rawLanguages
            .map((language) => getLocalizedLanguageLabel(String(language || '').trim(), normalizedLocale))
            .filter(Boolean)
        )
      )
    : [];

  return {
    visible: labels.slice(0, maxVisible),
    hiddenCount: Math.max(0, labels.length - maxVisible),
  };
}

export function getExperiencePriceParts(locale: string) {
  switch (normalizeLocale(locale)) {
    case 'en':
      return { prefix: '', suffix: ' / guest' };
    case 'ja':
      return { prefix: '', suffix: 'から / 人' };
    case 'zh':
      return { prefix: '', suffix: '起 / 人' };
    case 'ko':
    default:
      return { prefix: '1인당 ', suffix: '' };
  }
}
