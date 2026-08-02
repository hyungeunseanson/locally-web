export type ExternalBrowserTarget = 'home' | 'host';

const META_IN_APP_BROWSER_PATTERN = /Instagram|FBAN|FBAV|FB_IAB/i;
const ANDROID_PATTERN = /Android/i;

const TARGET_PATHS: Record<ExternalBrowserTarget, string> = {
  home: '/',
  host: '/become-a-host',
};

const TARGET_CAMPAIGNS: Record<ExternalBrowserTarget, string> = {
  home: 'linktree_home',
  host: 'linktree_host',
};

export function isExternalBrowserTarget(value: string): value is ExternalBrowserTarget {
  return value === 'home' || value === 'host';
}

export function isMetaInAppBrowser(userAgent: string): boolean {
  return META_IN_APP_BROWSER_PATTERN.test(userAgent);
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return ANDROID_PATTERN.test(userAgent);
}

export function buildExternalBrowserDestination(
  siteUrl: string,
  target: ExternalBrowserTarget,
): string {
  const url = new URL(TARGET_PATHS[target], siteUrl);
  url.searchParams.set('utm_source', 'instagram');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', TARGET_CAMPAIGNS[target]);
  return url.toString();
}

export function buildAndroidChromeIntentUrl(destinationUrl: string): string {
  const destination = new URL(destinationUrl);
  const intentTarget = `${destination.host}${destination.pathname}${destination.search}${destination.hash}`;

  return `intent://${intentTarget}#Intent;scheme=${destination.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(destinationUrl)};end`;
}
