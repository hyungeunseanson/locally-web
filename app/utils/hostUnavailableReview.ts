const REVIEW_PREFIX_MAP = {
  host_unavailable: '[HOST_UNAVAILABLE_REVIEW_PENDING]',
  minimum_participants_unmet: '[MINIMUM_PARTICIPANTS_UNMET_REVIEW_PENDING]',
} as const;

export type BookingReviewRequestType = keyof typeof REVIEW_PREFIX_MAP;

function getReviewPrefix(type: BookingReviewRequestType) {
  return REVIEW_PREFIX_MAP[type];
}

export function formatBookingReviewMarker(type: BookingReviewRequestType, detail?: string | null) {
  const prefix = getReviewPrefix(type);
  const normalizedDetail = (detail || '').trim();
  return normalizedDetail
    ? `${prefix} ${normalizedDetail}`
    : prefix;
}

export function getBookingReviewType(value?: string | null): BookingReviewRequestType | null {
  const rawValue = value || '';

  if (rawValue.startsWith(REVIEW_PREFIX_MAP.host_unavailable)) {
    return 'host_unavailable';
  }

  if (rawValue.startsWith(REVIEW_PREFIX_MAP.minimum_participants_unmet)) {
    return 'minimum_participants_unmet';
  }

  return null;
}

export function isBookingReviewPending(value?: string | null) {
  return getBookingReviewType(value) !== null;
}

export function getBookingReviewDetail(value?: string | null) {
  const reviewType = getBookingReviewType(value);
  if (!reviewType) {
    return null;
  }

  const detail = (value || '').slice(getReviewPrefix(reviewType).length).trim();
  return detail || null;
}

export function clearBookingReviewMarker(value?: string | null) {
  if (!isBookingReviewPending(value)) {
    return value || null;
  }

  return null;
}

export function formatHostUnavailableReviewMarker(detail?: string | null) {
  return formatBookingReviewMarker('host_unavailable', detail);
}

export function isHostUnavailableReviewPending(value?: string | null) {
  return getBookingReviewType(value) === 'host_unavailable';
}

export function getHostUnavailableReviewDetail(value?: string | null) {
  return isHostUnavailableReviewPending(value) ? getBookingReviewDetail(value) : null;
}

export function clearHostUnavailableReviewMarker(value?: string | null) {
  return isHostUnavailableReviewPending(value) ? clearBookingReviewMarker(value) : (value || null);
}
