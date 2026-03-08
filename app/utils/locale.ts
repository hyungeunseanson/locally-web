import { cookies, headers } from 'next/headers';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const normalizeLocale = (value: string | null | undefined): Locale | null => {
  if (!value) return null;

  const normalized = value.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return null;
};

const detectFromAcceptLanguage = (acceptLanguage: string): Locale | null => {
  const candidates = acceptLanguage
    .split(',')
    .map((item) => item.trim().split(';')[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }

  return null;
};

export async function getCurrentLocale(): Promise<Locale> {
  const headerStore = await headers();
  const headerLocale = normalizeLocale(headerStore.get('x-locally-locale'));
  if (headerLocale) {
    return headerLocale;
  }

  const cookieStore = await cookies();
  const cookieLocale = normalizeLocale(cookieStore.get('app_lang')?.value);
  if (cookieLocale) {
    return cookieLocale;
  }

  const acceptLanguage = headerStore.get('accept-language') || '';
  const acceptedLocale = detectFromAcceptLanguage(acceptLanguage);

  return acceptedLocale || 'ko';
}
