import { CITY_OPTIONS, type FormLocale } from '@/app/host/create/localization';
import { getLocalizedCityLabel } from '@/app/utils/locationLocalization';
import { normalizeServiceCity } from '@/app/utils/serviceRequestLocation';

export type SearchPresetId = 'tokyo' | 'osaka' | 'izakaya' | 'seoul';

export type SearchPreset = {
  id: SearchPresetId;
  kind: 'city' | 'keyword';
  queryValue: string;
  labelKey: string;
  descKey: string;
  cityValue?: string;
};

type SearchLocationTranslator = (key: string, vars?: Record<string, string | number>) => string;

const SUPPORTED_LOCALES: FormLocale[] = ['ko', 'en', 'ja', 'zh'];

const PRESET_KEYWORD_ALIASES: Partial<Record<SearchPresetId, string[]>> = {
  izakaya: ['이자카야', 'izakaya', '居酒屋'],
};

export const RECOMMENDED_SEARCH_PRESETS: SearchPreset[] = [
  {
    id: 'tokyo',
    kind: 'city',
    queryValue: '도쿄',
    cityValue: '도쿄',
    labelKey: 'search_place_tokyo',
    descKey: 'search_place_tokyo_desc',
  },
  {
    id: 'osaka',
    kind: 'city',
    queryValue: '오사카',
    cityValue: '오사카',
    labelKey: 'search_place_osaka',
    descKey: 'search_place_osaka_desc',
  },
  {
    id: 'izakaya',
    kind: 'keyword',
    queryValue: '이자카야',
    labelKey: 'search_place_izakaya',
    descKey: 'search_place_izakaya_desc',
  },
  {
    id: 'seoul',
    kind: 'city',
    queryValue: '서울',
    cityValue: '서울',
    labelKey: 'search_place_seoul',
    descKey: 'search_place_seoul_desc',
  },
];

const normalizeLocale = (locale: string): FormLocale => {
  return SUPPORTED_LOCALES.includes(locale as FormLocale) ? (locale as FormLocale) : 'ko';
};

const normalizeText = (value: unknown) => String(value ?? '').toLowerCase().replace(/\s+/g, '').trim();

const dedupeStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) continue;
    const key = normalizeText(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }

  return next;
};

export function getSearchableCityAliases(city: unknown): string[] {
  const rawCity = String(city ?? '').trim();
  if (!rawCity) return [];

  const canonicalCity = normalizeServiceCity(rawCity);

  for (const options of Object.values(CITY_OPTIONS)) {
    const matched = options.find((option) => option.value === canonicalCity);
    if (!matched) continue;

    return dedupeStrings([matched.value, ...Object.values(matched.labels)]);
  }

  return dedupeStrings([rawCity]);
}

function getPresetAliases(preset: SearchPreset, locale: string, t: SearchLocationTranslator) {
  const normalizedLocale = normalizeLocale(locale);
  const aliases = [preset.queryValue, preset.id, t(preset.labelKey)];

  if (preset.kind === 'city' && preset.cityValue) {
    aliases.push(...getSearchableCityAliases(preset.cityValue));
  }

  if (preset.kind === 'keyword') {
    aliases.push(...(PRESET_KEYWORD_ALIASES[preset.id] || []));
  }

  if (normalizedLocale === 'en') {
    aliases.push(preset.id);
  }

  return dedupeStrings(aliases);
}

export function matchSearchPreset(value: unknown, locale: string, t: SearchLocationTranslator): SearchPreset | null {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;

  return (
    RECOMMENDED_SEARCH_PRESETS.find((preset) =>
      getPresetAliases(preset, locale, t).some((alias) => normalizeText(alias) === normalizedValue)
    ) || null
  );
}

export function getLocalizedSearchLocationLabel(
  value: unknown,
  locale: string,
  t: SearchLocationTranslator
): string {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';

  const matchedPreset = matchSearchPreset(rawValue, locale, t);
  if (matchedPreset) {
    if (matchedPreset.kind === 'city' && matchedPreset.cityValue) {
      return getLocalizedCityLabel(matchedPreset.cityValue, locale);
    }
    return t(matchedPreset.labelKey);
  }

  const canonicalCity = normalizeServiceCity(rawValue);
  const localizedCity = getLocalizedCityLabel(canonicalCity, locale);
  return localizedCity || rawValue;
}
