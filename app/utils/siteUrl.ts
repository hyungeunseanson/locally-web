const DEFAULT_SITE_URL = 'https://locally-web.vercel.app';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function buildAbsoluteUrl(pathname: string = '/'): string {
  const baseUrl = getSiteUrl();

  if (pathname === '/' || pathname === '') {
    return baseUrl;
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}

export function buildLocalizedAbsoluteUrl(
  locale: 'ko' | 'en' | 'ja' | 'zh',
  pathname: string = '/'
): string {
  const normalizedPath = pathname === '/' || pathname === '' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (locale === 'ko') {
    return normalizedPath ? buildAbsoluteUrl(normalizedPath) : buildAbsoluteUrl('/');
  }

  return buildAbsoluteUrl(`/${locale}${normalizedPath}`);
}
