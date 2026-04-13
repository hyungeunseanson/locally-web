const LOCAL_DEV_SITE_URL = 'http://localhost:3000';

type SiteUrlEnv = Record<string, string | undefined>;

function readTrimmedEnv(env: SiteUrlEnv, key: string) {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export function resolveSiteUrl(env: SiteUrlEnv = process.env): string {
  const configuredSiteUrl = readTrimmedEnv(env, 'NEXT_PUBLIC_SITE_URL');
  if (configuredSiteUrl) {
    return normalizeSiteUrl(configuredSiteUrl);
  }

  if (env.NODE_ENV !== 'production') {
    return LOCAL_DEV_SITE_URL;
  }

  throw new Error(
    'Missing NEXT_PUBLIC_SITE_URL for production runtime. Refusing to fall back to a legacy alias.'
  );
}

export function getSiteUrl(): string {
  return resolveSiteUrl(process.env);
}

export function buildAbsoluteUrl(pathname: string = '/', env: SiteUrlEnv = process.env): string {
  const baseUrl = resolveSiteUrl(env);

  // [Security] 절대 URL 또는 프로토콜 상대 문자열 차단 — open redirect 방지
  if (/^(https?:)?\/\//i.test(pathname)) {
    return baseUrl;
  }

  if (pathname === '/' || pathname === '') {
    return baseUrl;
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}

export function buildLocalizedAbsoluteUrl(
  locale: 'ko' | 'en' | 'ja' | 'zh',
  pathname: string = '/',
  env: SiteUrlEnv = process.env
): string {
  const normalizedPath = pathname === '/' || pathname === '' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (locale === 'ko') {
    return normalizedPath ? buildAbsoluteUrl(normalizedPath, env) : buildAbsoluteUrl('/', env);
  }

  return buildAbsoluteUrl(`/${locale}${normalizedPath}`, env);
}
