import { sendGoogleAnalyticsEvent } from '@/app/utils/analytics/google';
import type { ReviewRequestSource } from './reviewRequestDeepLinks';

export type ReviewRole = 'guest' | 'host';
export type ReviewFunnelSource = ReviewRequestSource | 'trips' | 'host_dashboard';
export type ReviewFunnelEvent =
  | 'review_request_landing'
  | 'review_modal_open'
  | 'review_submit_success'
  | 'review_submit_error';

export function trackReviewFunnelEvent(
  event: ReviewFunnelEvent,
  reviewRole: ReviewRole,
  source: ReviewFunnelSource
) {
  // The event contract intentionally has no booking, user, email, title, or review fields.
  try {
    return sendGoogleAnalyticsEvent(event, { review_role: reviewRole, source });
  } catch {
    return false;
  }
}
