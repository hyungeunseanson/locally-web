import { CITY_OPTIONS, COUNTRY_OPTIONS, type CountryCode, type FormLocale } from '@/app/host/create/localization';

type Locale = FormLocale;

type ExperienceLocationInput = {
  city?: string | null;
  subCity?: string | null;
  country?: string | null;
  location?: string | null;
};

const SUPPORTED_LOCALES: Locale[] = ['ko', 'en', 'ja', 'zh'];

const normalizeLocale = (locale: string): Locale => {
  return SUPPORTED_LOCALES.includes(locale as Locale) ? (locale as Locale) : 'ko';
};

const normalizeValue = (value: unknown) => String(value || '').trim();
const normalizeKey = (value: unknown) => normalizeValue(value).toLowerCase();
const stripFlagPrefix = (value: string) => value.replace(/^[^\p{L}\p{N}]+/u, '').trim();

const countryLookup = new Map<string, CountryCode>();
for (const option of COUNTRY_OPTIONS) {
  countryLookup.set(normalizeKey(option.value), option.value);
  for (const label of Object.values(option.labels)) {
    countryLookup.set(normalizeKey(stripFlagPrefix(label)), option.value);
  }
}

const cityLookup = new Map<string, { country: CountryCode; value: string }>();
for (const [country, options] of Object.entries(CITY_OPTIONS) as Array<[CountryCode, typeof CITY_OPTIONS[CountryCode]]>) {
  for (const option of options) {
    cityLookup.set(normalizeKey(option.value), { country, value: option.value });
    for (const label of Object.values(option.labels)) {
      cityLookup.set(normalizeKey(label), { country, value: option.value });
    }
  }
}

export function getLocalizedCountryLabel(country: unknown, locale: string): string {
  const normalizedLocale = normalizeLocale(locale);
  const rawCountry = normalizeValue(country);
  if (!rawCountry) return '';

  const canonicalCountry = countryLookup.get(normalizeKey(rawCountry));
  if (!canonicalCountry) return rawCountry;

  const option = COUNTRY_OPTIONS.find((entry) => entry.value === canonicalCountry);
  if (!option) return rawCountry;

  return stripFlagPrefix(option.labels[normalizedLocale]);
}

export function getLocalizedCityLabel(city: unknown, locale: string): string {
  const normalizedLocale = normalizeLocale(locale);
  const rawCity = normalizeValue(city);
  if (!rawCity) return '';

  const matched = cityLookup.get(normalizeKey(rawCity));
  if (!matched) return rawCity;

  const option = CITY_OPTIONS[matched.country].find((entry) => entry.value === matched.value);
  return option?.labels[normalizedLocale] || rawCity;
}

export function formatLocalizedExperienceLocation(input: ExperienceLocationInput, locale: string): string {
  const city = getLocalizedCityLabel(input.city, locale);
  const subCity = normalizeValue(input.subCity);
  const country = getLocalizedCountryLabel(input.country, locale);
  const fallbackLocation = normalizeValue(input.location);

  const parts = Array.from(
    new Set([city, subCity, country].map((value) => normalizeValue(value)).filter(Boolean))
  );

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return fallbackLocation;
}
