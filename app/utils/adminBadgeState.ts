const LEGACY_TEAM_LAST_VIEWED_KEY = 'last_viewed_team';
const LEGACY_VIEWED_BOOKING_IDS_KEY = 'viewed_booking_ids';

function getTeamLastViewedKey(userId: string) {
  return `last_viewed_team:${userId}`;
}

function getViewedBookingIdsKey(userId: string) {
  return `viewed_booking_ids:${userId}`;
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeBookingIds(rawValue: unknown) {
  if (!Array.isArray(rawValue)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      rawValue
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function readJsonArray(key: string) {
  if (!isBrowser()) {
    return [] as string[];
  }

  try {
    return normalizeBookingIds(JSON.parse(window.localStorage.getItem(key) || '[]'));
  } catch {
    return [] as string[];
  }
}

function writeJsonArray(key: string, value: string[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(normalizeBookingIds(value)));
}

function normalizeIsoString(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function readAdminTeamLastViewed(userId: string) {
  if (!isBrowser()) {
    return null;
  }

  const scopedKey = getTeamLastViewedKey(userId);
  const scopedValue = normalizeIsoString(window.localStorage.getItem(scopedKey));
  if (scopedValue) {
    return scopedValue;
  }

  const legacyValue = normalizeIsoString(window.localStorage.getItem(LEGACY_TEAM_LAST_VIEWED_KEY));
  if (!legacyValue) {
    return null;
  }

  window.localStorage.setItem(scopedKey, legacyValue);
  return legacyValue;
}

export function ensureAdminTeamLastViewed(userId: string, fallback = new Date().toISOString()) {
  const existing = readAdminTeamLastViewed(userId);
  if (existing) {
    return existing;
  }

  if (!isBrowser()) {
    return fallback;
  }

  const nextValue = normalizeIsoString(fallback) || new Date().toISOString();
  window.localStorage.setItem(getTeamLastViewedKey(userId), nextValue);
  return nextValue;
}

export function markAdminTeamViewed(userId: string, viewedAt = new Date().toISOString()) {
  const normalized = normalizeIsoString(viewedAt) || new Date().toISOString();

  if (isBrowser()) {
    window.localStorage.setItem(getTeamLastViewedKey(userId), normalized);
  }

  return normalized;
}

function readAdminViewedBookingIds(userId: string) {
  if (!isBrowser()) {
    return [] as string[];
  }

  const scopedKey = getViewedBookingIdsKey(userId);
  const scopedValue = readJsonArray(scopedKey);
  if (scopedValue.length > 0) {
    return scopedValue;
  }

  const legacyValue = readJsonArray(LEGACY_VIEWED_BOOKING_IDS_KEY);
  if (legacyValue.length === 0) {
    return [] as string[];
  }

  writeJsonArray(scopedKey, legacyValue);
  return legacyValue;
}

function syncAdminViewedBookingIdsWithPending(userId: string, pendingBookingIds: string[]) {
  const pendingIdSet = new Set(normalizeBookingIds(pendingBookingIds));
  const currentViewedIds = readAdminViewedBookingIds(userId);
  const nextViewedIds = currentViewedIds.filter((id) => pendingIdSet.has(id));

  if (
    isBrowser() &&
    (nextViewedIds.length !== currentViewedIds.length ||
      window.localStorage.getItem(getViewedBookingIdsKey(userId)) === null)
  ) {
    writeJsonArray(getViewedBookingIdsKey(userId), nextViewedIds);
  }

  return nextViewedIds;
}

export function getAdminUnviewedPendingBookingCount(userId: string, pendingBookingIds: string[]) {
  const safePendingIds = normalizeBookingIds(pendingBookingIds);
  const viewedBookingIds = syncAdminViewedBookingIdsWithPending(userId, safePendingIds);
  const viewedIdSet = new Set(viewedBookingIds);

  return safePendingIds.filter((id) => !viewedIdSet.has(id)).length;
}

export function markAdminBookingViewed(userId: string, bookingId: string) {
  const trimmedBookingId = bookingId.trim();
  if (!trimmedBookingId) {
    return false;
  }

  const currentViewedIds = readAdminViewedBookingIds(userId);
  if (currentViewedIds.includes(trimmedBookingId)) {
    return false;
  }

  writeJsonArray(getViewedBookingIdsKey(userId), [...currentViewedIds, trimmedBookingId]);
  return true;
}
