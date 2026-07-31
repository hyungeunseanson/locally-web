const LOCALE_PREFIX_PATTERN = /^\/(ko|en|ja|zh)(?=\/|$)/;

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/about',
  '/become-a-host',
  '/help',
]);

const RIGHT_RAIL_EXACT_PATHS = new Set([
  '/company/notices',
  '/help',
]);

const PUBLIC_PATH_PREFIXES = [
  '/company',
  '/experiences',
  '/users',
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

  if (/^\/experiences\/[^/]+\/payment(?:\/|$)/.test(normalizedPathname)) return false;

  if (PUBLIC_EXACT_PATHS.has(normalizedPathname)) return true;

  return PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(normalizedPathname, prefix));
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
