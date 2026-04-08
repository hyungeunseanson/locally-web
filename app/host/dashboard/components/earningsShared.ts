export function formatLatestPayoutDate(value: string | null, locale: string) {
  if (!value) return null;

  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };

  return new Intl.DateTimeFormat(localeMap[locale] || 'ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
