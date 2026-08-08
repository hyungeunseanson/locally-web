const LOCALE_PREFIX_PATTERN = /^\/(ko|en|ja|zh)(?=\/|$)/;

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/about',
  '/become-a-host',
  '/community',
  '/help',
  '/privacy',
  '/search',
  '/services/intro',
]);

const RIGHT_RAIL_EXACT_PATHS = new Set([
  '/community',
  '/company/careers',
  '/company/investors',
  '/company/news',
  '/company/notices',
  '/company/partnership',
  '/help',
]);

const PUBLIC_PATH_PREFIXES = [
  '/company',
];

const EXCLUDED_PATH_PREFIXES = [
  '/admin',
  '/auth',
  '/login',
  '/signup',
  '/account',
  '/guest',
  '/host',
  '/notifications',
  '/payment',
  '/proxy-bookings',
];

const DYNAMIC_PUBLIC_DETAIL_PATTERN = /^\/(community|experiences|users)\/[^/]+$/;

export const ADSENSE_PUBLIC_PATH_META_NAME = 'locally-adsense-public-path';

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeDesktopFooterAdPathname(pathname: string): string {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutLocale = withLeadingSlash.replace(LOCALE_PREFIX_PATTERN, '');
  const normalized = withoutLocale || '/';

  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

export function shouldShowDesktopFooterAd(pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  const normalizedPathname = normalizeDesktopFooterAdPathname(pathname);

  if (EXCLUDED_PATH_PREFIXES.some((prefix) => matchesPathPrefix(normalizedPathname, prefix))) {
    return false;
  }

  if (normalizedPathname === '/community/write') return false;
  if (/^\/experiences\/[^/]+\/payment(?:\/|$)/.test(normalizedPathname)) return false;

  if (PUBLIC_EXACT_PATHS.has(normalizedPathname)) return true;

  if (DYNAMIC_PUBLIC_DETAIL_PATTERN.test(normalizedPathname)) return true;

  return PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(normalizedPathname, prefix));
}

export function requiresCanonicalMatchForDesktopFooterAd(
  pathname: string | null | undefined
): boolean {
  if (!pathname) return false;
  return DYNAMIC_PUBLIC_DETAIL_PATTERN.test(normalizeDesktopFooterAdPathname(pathname));
}

export function hasMatchingCanonicalPathname(
  pathname: string | null | undefined,
  canonicalHrefs: Array<string | null | undefined>
): boolean {
  if (!pathname) return false;

  const expectedPathname = normalizeDesktopFooterAdPathname(pathname);

  return canonicalHrefs.some((href) => {
    if (!href) return false;

    try {
      const canonicalUrl = new URL(href, 'https://locally.invalid');
      return normalizeDesktopFooterAdPathname(canonicalUrl.pathname) === expectedPathname;
    } catch {
      return false;
    }
  });
}

export function hasMatchingPublicAdPathname(
  pathname: string | null | undefined,
  publicPathValues: Array<string | null | undefined>
): boolean {
  if (!pathname) return false;

  const expectedPathname = normalizeDesktopFooterAdPathname(pathname);

  return publicPathValues.some((value) => {
    if (!value) return false;
    return normalizeDesktopFooterAdPathname(value) === expectedPathname;
  });
}

export function shouldShowDesktopRightRailAd(pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  return RIGHT_RAIL_EXACT_PATHS.has(normalizeDesktopFooterAdPathname(pathname));
}

export function hasNoIndexDirective(contents: Array<string | null | undefined>): boolean {
  return contents.some((content) =>
    (content || '')
      .toLowerCase()
      .split(/[\s,]+/)
      .includes('noindex')
  );
}
