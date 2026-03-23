const HOST_UNAVAILABLE_REVIEW_PREFIX = '[HOST_UNAVAILABLE_REVIEW_PENDING]';

export function formatHostUnavailableReviewMarker(detail?: string | null) {
  const normalizedDetail = (detail || '').trim();
  return normalizedDetail
    ? `${HOST_UNAVAILABLE_REVIEW_PREFIX} ${normalizedDetail}`
    : HOST_UNAVAILABLE_REVIEW_PREFIX;
}

export function isHostUnavailableReviewPending(value?: string | null) {
  return (value || '').startsWith(HOST_UNAVAILABLE_REVIEW_PREFIX);
}

export function getHostUnavailableReviewDetail(value?: string | null) {
  if (!isHostUnavailableReviewPending(value)) {
    return null;
  }

  const detail = (value || '').slice(HOST_UNAVAILABLE_REVIEW_PREFIX.length).trim();
  return detail || null;
}

export function clearHostUnavailableReviewMarker(value?: string | null) {
  if (!isHostUnavailableReviewPending(value)) {
    return value || null;
  }

  return null;
}

