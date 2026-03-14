const VIEWED_BOOKING_IDS_KEY = 'viewed_booking_ids';

function normalizeViewedBookingIds(rawValue: unknown) {
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

function readStoredViewedBookingIds() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    return normalizeViewedBookingIds(JSON.parse(window.localStorage.getItem(VIEWED_BOOKING_IDS_KEY) || '[]'));
  } catch {
    return [] as string[];
  }
}

function writeViewedBookingIds(nextIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(VIEWED_BOOKING_IDS_KEY, JSON.stringify(normalizeViewedBookingIds(nextIds)));
}

export function syncViewedBookingIdsWithPending(pendingBookingIds: string[]) {
  const safePendingIds = normalizeViewedBookingIds(pendingBookingIds);
  const pendingIdSet = new Set(safePendingIds);
  const currentViewedIds = readStoredViewedBookingIds();
  const nextViewedIds = currentViewedIds.filter((id) => pendingIdSet.has(id));

  if (nextViewedIds.length !== currentViewedIds.length) {
    writeViewedBookingIds(nextViewedIds);
  }

  return nextViewedIds;
}

export function getUnviewedPendingBookingCount(pendingBookingIds: string[]) {
  const safePendingIds = normalizeViewedBookingIds(pendingBookingIds);
  const viewedBookingIds = syncViewedBookingIdsWithPending(safePendingIds);
  const viewedIdSet = new Set(viewedBookingIds);

  return safePendingIds.filter((id) => !viewedIdSet.has(id)).length;
}

export function markBookingViewed(bookingId: string) {
  const trimmedBookingId = bookingId.trim();
  if (!trimmedBookingId) {
    return false;
  }

  const currentViewedIds = readStoredViewedBookingIds();
  if (currentViewedIds.includes(trimmedBookingId)) {
    return false;
  }

  writeViewedBookingIds([...currentViewedIds, trimmedBookingId]);
  return true;
}
