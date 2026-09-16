import type { SupabaseClient } from '@supabase/supabase-js';

import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';

const REVIEW_REQUEST_RECONCILIATION_LIMIT = 50;

type ReviewRequestCandidate = {
  booking_id?: unknown;
  user_id?: unknown;
  host_id?: unknown;
  experience_title?: unknown;
  customer_request_needed?: unknown;
  host_request_needed?: unknown;
};

type NotificationOperationResult = {
  bookingId: string;
  kind: 'customer' | 'host';
  created: boolean;
};

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function insertNotification(
  supabaseAdmin: SupabaseClient,
  row: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '23505') return false;
    throw error;
  }

  return data?.id != null;
}

export async function reconcileDueExperienceReviewRequests(params: {
  supabaseAdmin: SupabaseClient;
}) {
  const { data, error } = await params.supabaseAdmin.rpc(
    'list_due_experience_review_request_candidates',
    { p_limit: REVIEW_REQUEST_RECONCILIATION_LIMIT }
  );

  if (error) throw error;

  const candidates = (Array.isArray(data) ? data : []) as ReviewRequestCandidate[];
  const operations: Array<Promise<NotificationOperationResult>> = [];

  for (const candidate of candidates) {
    const bookingId = readString(candidate.booking_id);
    const userId = readString(candidate.user_id);
    const hostId = readString(candidate.host_id);
    const experienceTitle = readString(candidate.experience_title) || 'Locally Experience';
    if (!bookingId) continue;

    if (candidate.customer_request_needed === true && userId) {
      operations.push((async () => ({
        bookingId,
        kind: 'customer' as const,
        created: await insertNotification(params.supabaseAdmin, {
          user_id: userId,
          type: 'review_request',
          title: '후기를 남겨주세요!',
          message: `'${experienceTitle}' 어떠셨나요? 소중한 후기를 남겨주세요.`,
          link: '/guest/trips',
          is_read: false,
          booking_id: bookingId,
        }),
      }))());
    }

    if (candidate.host_request_needed === true && hostId) {
      operations.push((async () => {
        const notificationRow = await buildLocalizedNotificationInsert({
          supabaseAdmin: params.supabaseAdmin,
          userId: hostId,
          type: 'guest_review_request',
          link: '/host/dashboard?tab=reservations',
          key: 'review.guest_request.host',
          copyParams: { experienceTitle },
        });

        return {
          bookingId,
          kind: 'host' as const,
          created: await insertNotification(params.supabaseAdmin, {
            ...notificationRow,
            booking_id: bookingId,
          }),
        };
      })());
    }
  }

  const settled = await Promise.allSettled(operations);
  const customerNotificationBookingIds: string[] = [];
  const hostNotificationBookingIds: string[] = [];
  let customerCreatedCount = 0;
  let hostCreatedCount = 0;
  let failedCount = 0;

  for (const result of settled) {
    if (result.status === 'rejected') {
      failedCount += 1;
      console.warn(JSON.stringify({
        event: 'review_request_reconciliation',
        status: 'failed',
        diagnosticCode: 'notification_insert_failed',
      }));
      continue;
    }

    if (!result.value.created) continue;
    if (result.value.kind === 'customer') {
      customerCreatedCount += 1;
      customerNotificationBookingIds.push(result.value.bookingId);
    } else {
      hostCreatedCount += 1;
      hostNotificationBookingIds.push(result.value.bookingId);
    }
  }

  return {
    candidateCount: candidates.length,
    customerCreatedCount,
    hostCreatedCount,
    failedCount,
    customerNotificationBookingIds,
    hostNotificationBookingIds,
  };
}
