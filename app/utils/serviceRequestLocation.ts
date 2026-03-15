import { CITY_OPTIONS, COUNTRY_OPTIONS, type CountryCode } from '@/app/host/create/localization';

const normalizeValue = (value: unknown) => String(value || '').trim();
const normalizeKey = (value: unknown) => normalizeValue(value).toLowerCase();
const stripFlagPrefix = (value: string) => value.replace(/^[^\p{L}\p{N}]+/u, '').trim();

const countryLookup = new Map<string, CountryCode>([
  ['kr', 'Korea'],
  ['korea', 'Korea'],
  ['south korea', 'Korea'],
  ['한국', 'Korea'],
  ['대한민국', 'Korea'],
  ['jp', 'Japan'],
  ['japan', 'Japan'],
  ['일본', 'Japan'],
  ['日本', 'Japan'],
]);

for (const option of COUNTRY_OPTIONS) {
  countryLookup.set(normalizeKey(option.value), option.value);
  for (const label of Object.values(option.labels)) {
    const normalizedLabel = normalizeKey(stripFlagPrefix(label));
    if (normalizedLabel) {
      countryLookup.set(normalizedLabel, option.value);
    }
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

export type ServiceCountryCode = CountryCode;

export function normalizeServiceCity(city: unknown): string {
  const rawCity = normalizeValue(city);
  if (!rawCity) return '';

  return cityLookup.get(normalizeKey(rawCity))?.value || rawCity;
}

export function normalizeServiceCountry(country: unknown): ServiceCountryCode | null {
  const rawCountry = normalizeValue(country);
  if (!rawCountry) return null;

  return countryLookup.get(normalizeKey(rawCountry)) || null;
}

export function getServiceCountryFromCity(city: unknown): ServiceCountryCode | null {
  const rawCity = normalizeValue(city);
  if (!rawCity) return null;

  return cityLookup.get(normalizeKey(rawCity))?.country || null;
}

export function resolveServiceCountry(city: unknown, country: unknown): ServiceCountryCode | null {
  return getServiceCountryFromCity(city) || normalizeServiceCountry(country);
}

export function getServiceLocationKey(input: { city?: unknown; country?: unknown }): string | null {
  const city = normalizeServiceCity(input.city);
  const country = resolveServiceCountry(city, input.country);

  if (!city || !country) {
    return null;
  }

  return `${country}::${city}`;
}
