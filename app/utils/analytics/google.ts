export type GoogleAnalyticsEnv = Record<string, string | undefined>;

export type GoogleAnalyticsConfig = {
  enabled: boolean;
  measurementId: string | null;
  propertyId: string | null;
  cmpScriptUrl: string | null;
  allowedHostname: string | null;
};

export type GoogleConsentModeValues = {
  analyticsStoragePurposeConsentStatus?: number;
};

export type GoogleConsentModeStatusEnum = {
  CONSENT_MODE_PURPOSE_STATUS_GRANTED?: number;
  CONSENT_MODE_PURPOSE_STATUS_NOT_APPLICABLE?: number;
};

export type GoogleAnalyticsEventParams = Record<string, unknown>;

type QueuedGoogleAnalyticsEvent = {
  name: string;
  params: GoogleAnalyticsEventParams;
  dedupeStorageKey?: string;
};

const GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const GOOGLE_ANALYTICS_PROPERTY_ID_PATTERN = /^\d+$/;
const GOOGLE_ANALYTICS_ACCOUNT_ID_PATTERN = /^\d+$/;
const GOOGLE_ANALYTICS_PRODUCTION_HOSTNAME = 'www.locally-travel.com';
const GOOGLE_ANALYTICS_QUEUE_LIMIT = 50;
const GOOGLE_ANALYTICS_PURCHASE_STORAGE_PREFIX = 'locally.ga.purchase.';

const SAFE_SEARCH_TERMS = new Map<string, string>([
  ['서울', 'seoul'],
  ['seoul', 'seoul'],
  ['부산', 'busan'],
  ['busan', 'busan'],
  ['제주', 'jeju'],
  ['제주도', 'jeju'],
  ['jeju', 'jeju'],
  ['도쿄', 'tokyo'],
  ['동경', 'tokyo'],
  ['tokyo', 'tokyo'],
  ['오사카', 'osaka'],
  ['osaka', 'osaka'],
  ['후쿠오카', 'fukuoka'],
  ['fukuoka', 'fukuoka'],
  ['삿포로', 'sapporo'],
  ['sapporo', 'sapporo'],
  ['나고야', 'nagoya'],
  ['nagoya', 'nagoya'],
]);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    googlefc?: {
      callbackQueue?: Array<Record<string, () => void>>;
      getGoogleConsentModeValues?: () => GoogleConsentModeValues;
      ConsentModePurposeStatusEnum?: GoogleConsentModeStatusEnum;
    };
    __locallyGoogleAnalyticsConsentGranted?: boolean;
    __locallyGoogleAnalyticsReady?: boolean;
    __locallyGoogleAnalyticsQueue?: QueuedGoogleAnalyticsEvent[];
  }
}

function readTrimmedEnv(env: GoogleAnalyticsEnv, key: string) {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

export function normalizeGoogleAnalyticsMeasurementId(value?: string | null) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeGoogleAnalyticsPropertyId(value?: string | null) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^p/i, '');
  return GOOGLE_ANALYTICS_PROPERTY_ID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeGoogleAnalyticsAccountId(value?: string | null) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^a/i, '');
  return GOOGLE_ANALYTICS_ACCOUNT_ID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeGoogleCmpScriptUrl(value?: string | null) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'fundingchoicesmessages.google.com') return null;
    if (!/^\/i\/pub-\d+/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function readAllowedHostname(env: GoogleAnalyticsEnv) {
  const siteUrl = readTrimmedEnv(env, 'NEXT_PUBLIC_SITE_URL');
  if (!siteUrl) return null;

  try {
    return new URL(siteUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function resolveGoogleAnalyticsConfig(
  env: GoogleAnalyticsEnv = process.env,
): GoogleAnalyticsConfig {
  const measurementId = normalizeGoogleAnalyticsMeasurementId(
    readTrimmedEnv(env, 'NEXT_PUBLIC_GOOGLE_ANALYTICS_ID'),
  );
  const propertyId = normalizeGoogleAnalyticsPropertyId(
    readTrimmedEnv(env, 'NEXT_PUBLIC_GOOGLE_ANALYTICS_PROPERTY_ID'),
  );
  const cmpScriptUrl = normalizeGoogleCmpScriptUrl(
    readTrimmedEnv(env, 'NEXT_PUBLIC_GOOGLE_CMP_SCRIPT_URL'),
  );
  const allowedHostname = readAllowedHostname(env);
  const explicitlyEnabled =
    readTrimmedEnv(env, 'NEXT_PUBLIC_GOOGLE_ANALYTICS_ENABLED') === 'true';

  return {
    measurementId,
    propertyId,
    cmpScriptUrl,
    allowedHostname,
    enabled:
      explicitlyEnabled &&
      Boolean(measurementId) &&
      Boolean(cmpScriptUrl) &&
      allowedHostname === GOOGLE_ANALYTICS_PRODUCTION_HOSTNAME,
  };
}

export function buildGoogleAnalyticsAdminUrl(
  propertyId?: string | null,
  accountId?: string | null,
) {
  const normalizedPropertyId = normalizeGoogleAnalyticsPropertyId(propertyId);
  if (!normalizedPropertyId) return 'https://analytics.google.com/analytics/web/';

  const normalizedAccountId = normalizeGoogleAnalyticsAccountId(accountId);
  const propertyPath = normalizedAccountId
    ? `a${normalizedAccountId}p${normalizedPropertyId}`
    : `p${normalizedPropertyId}`;
  return `https://analytics.google.com/analytics/web/#/${propertyPath}/reports/intelligenthome`;
}

export function isGoogleAnalyticsConsentGranted(
  values?: GoogleConsentModeValues | null,
  statusEnum?: GoogleConsentModeStatusEnum | null,
) {
  const analyticsStatus = values?.analyticsStoragePurposeConsentStatus;
  if (typeof analyticsStatus !== 'number' || !statusEnum) return false;

  return (
    analyticsStatus === statusEnum.CONSENT_MODE_PURPOSE_STATUS_GRANTED ||
    analyticsStatus === statusEnum.CONSENT_MODE_PURPOSE_STATUS_NOT_APPLICABLE
  );
}

export function isGoogleAnalyticsPathAllowed(pathname?: string | null) {
  if (!pathname) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return !(
    normalized === '/admin' ||
    normalized.startsWith('/admin/') ||
    normalized === '/auth' ||
    normalized.startsWith('/auth/') ||
    normalized === '/api' ||
    normalized.startsWith('/api/')
  );
}

export function buildSanitizedGoogleAnalyticsLocation(origin: string, pathname: string) {
  try {
    const base = new URL(origin);
    return new URL(pathname.startsWith('/') ? pathname : `/${pathname}`, base.origin).toString();
  } catch {
    return null;
  }
}

export function normalizeGoogleAnalyticsSearchTerm(value?: string | null) {
  const normalized = String(value || '').trim().toLocaleLowerCase();
  return SAFE_SEARCH_TERMS.get(normalized) || 'other';
}

export function initializeGoogleAnalytics(measurementId: string) {
  if (typeof window === 'undefined') return false;
  const normalizedMeasurementId = normalizeGoogleAnalyticsMeasurementId(measurementId);
  if (!normalizedMeasurementId || !window.__locallyGoogleAnalyticsConsentGranted) return false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => {
    window.dataLayer?.push(args);
  });
  window.gtag('js', new Date());
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('config', normalizedMeasurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: buildSanitizedGoogleAnalyticsLocation(
      window.location.origin,
      window.location.pathname,
    ),
  });
  window.__locallyGoogleAnalyticsReady = true;

  const queuedEvents = window.__locallyGoogleAnalyticsQueue || [];
  window.__locallyGoogleAnalyticsQueue = [];
  for (const event of queuedEvents) {
    window.gtag('event', event.name, event.params);
    if (event.dedupeStorageKey) {
      getLocalStorage()?.setItem(event.dedupeStorageKey, '1');
    }
  }

  return true;
}

export function sendGoogleAnalyticsEvent(
  name: string,
  params: GoogleAnalyticsEventParams = {},
) {
  if (typeof window === 'undefined') return false;
  if (!window.__locallyGoogleAnalyticsConsentGranted) return false;

  const safeParams: GoogleAnalyticsEventParams = {
    ...params,
    page_location: buildSanitizedGoogleAnalyticsLocation(
      window.location.origin,
      window.location.pathname,
    ),
    page_path: window.location.pathname,
  };

  if (window.__locallyGoogleAnalyticsReady && window.gtag) {
    window.gtag('event', name, safeParams);
    return true;
  }

  const queue = window.__locallyGoogleAnalyticsQueue || [];
  if (queue.length >= GOOGLE_ANALYTICS_QUEUE_LIMIT) return false;
  queue.push({ name, params: safeParams });
  window.__locallyGoogleAnalyticsQueue = queue;
  return true;
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function sendGoogleAnalyticsPurchase(params: {
  transactionId: string;
  value: number;
  itemId: string;
}) {
  if (typeof window === 'undefined') return false;

  const transactionId = params.transactionId.trim();
  const itemId = params.itemId.trim();
  const value = Number(params.value);
  if (!transactionId || !itemId || !Number.isFinite(value) || value < 0) return false;

  const storage = getLocalStorage();
  const storageKey = `${GOOGLE_ANALYTICS_PURCHASE_STORAGE_PREFIX}${transactionId}`;
  if (storage?.getItem(storageKey) === '1') return false;

  const eventParams: GoogleAnalyticsEventParams = {
    transaction_id: transactionId,
    value,
    currency: 'KRW',
    items: [{ item_id: itemId }],
    page_location: buildSanitizedGoogleAnalyticsLocation(
      window.location.origin,
      window.location.pathname,
    ),
    page_path: window.location.pathname,
  };

  if (!window.__locallyGoogleAnalyticsConsentGranted) return false;
  if (window.__locallyGoogleAnalyticsReady && window.gtag) {
    window.gtag('event', 'purchase', eventParams);
    storage?.setItem(storageKey, '1');
    return true;
  }

  const queue = window.__locallyGoogleAnalyticsQueue || [];
  if (queue.some((event) => event.dedupeStorageKey === storageKey)) return false;
  if (queue.length >= GOOGLE_ANALYTICS_QUEUE_LIMIT) return false;

  queue.push({
    name: 'purchase',
    params: eventParams,
    dedupeStorageKey: storageKey,
  });
  window.__locallyGoogleAnalyticsQueue = queue;
  return true;
}
