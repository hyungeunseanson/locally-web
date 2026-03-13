type AnalyticsTrackingMetadata = {
  session_id: string | null;
  referrer: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
};

const SESSION_STORAGE_KEY = 'locally.analytics.session_id';
const ATTRIBUTION_STORAGE_KEY = 'locally.analytics.attribution';

function normalizeValue(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function getSessionStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `locally_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateSessionId() {
  const storage = getSessionStorage();
  if (!storage) return null;

  const existing = normalizeValue(storage.getItem(SESSION_STORAGE_KEY));
  if (existing) return existing;

  const next = createSessionId();
  storage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

function getCurrentAttributionSnapshot() {
  if (typeof window === 'undefined') {
    return {
      referrer: null,
      referrer_host: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      landing_path: null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const referrer = normalizeValue(document.referrer);
  let referrerHost: string | null = null;

  if (referrer) {
    try {
      referrerHost = normalizeValue(new URL(referrer).hostname);
    } catch {
      referrerHost = null;
    }
  }

  return {
    referrer,
    referrer_host: referrerHost,
    utm_source: normalizeValue(searchParams.get('utm_source')),
    utm_medium: normalizeValue(searchParams.get('utm_medium')),
    utm_campaign: normalizeValue(searchParams.get('utm_campaign')),
    landing_path: normalizeValue(window.location.pathname),
  };
}

export function getAnalyticsTrackingMetadata(): AnalyticsTrackingMetadata {
  const session_id = getOrCreateSessionId();
  const storage = getSessionStorage();
  const currentSnapshot = getCurrentAttributionSnapshot();

  if (!storage) {
    return { session_id, ...currentSnapshot };
  }

  const storedRaw = storage.getItem(ATTRIBUTION_STORAGE_KEY);
  let storedSnapshot: Partial<AnalyticsTrackingMetadata> | null = null;

  if (storedRaw) {
    try {
      storedSnapshot = JSON.parse(storedRaw) as Partial<AnalyticsTrackingMetadata>;
    } catch {
      storedSnapshot = null;
    }
  }

  const mergedSnapshot: AnalyticsTrackingMetadata = {
    session_id,
    referrer: normalizeValue(storedSnapshot?.referrer) || currentSnapshot.referrer,
    referrer_host: normalizeValue(storedSnapshot?.referrer_host) || currentSnapshot.referrer_host,
    utm_source: normalizeValue(storedSnapshot?.utm_source) || currentSnapshot.utm_source,
    utm_medium: normalizeValue(storedSnapshot?.utm_medium) || currentSnapshot.utm_medium,
    utm_campaign: normalizeValue(storedSnapshot?.utm_campaign) || currentSnapshot.utm_campaign,
    landing_path: normalizeValue(storedSnapshot?.landing_path) || currentSnapshot.landing_path,
  };

  storage.setItem(
    ATTRIBUTION_STORAGE_KEY,
    JSON.stringify({
      referrer: mergedSnapshot.referrer,
      referrer_host: mergedSnapshot.referrer_host,
      utm_source: mergedSnapshot.utm_source,
      utm_medium: mergedSnapshot.utm_medium,
      utm_campaign: mergedSnapshot.utm_campaign,
      landing_path: mergedSnapshot.landing_path,
    })
  );

  return mergedSnapshot;
}
