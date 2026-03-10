import { getLocalizedLanguageLabel } from '@/app/utils/languageLevels';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const normalizeLocale = (locale: string): Locale => {
  if (locale === 'en' || locale === 'ja' || locale === 'zh') return locale;
  return 'ko';
};

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
      return { prefix: 'From ', suffix: ' / guest' };
    case 'ja':
      return { prefix: '', suffix: 'から / 人' };
    case 'zh':
      return { prefix: '', suffix: '起 / 人' };
    case 'ko':
    default:
      return { prefix: '1인당 ', suffix: '부터' };
  }
}
