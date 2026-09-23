import type { SupabaseClient } from '@supabase/supabase-js';

import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { getHostGuestReviewRequestHref } from '@/app/utils/reviews/reviewRequestDeepLinks';

type ExperienceRelation = {
  host_id: string | null;
  title: string | null;
};

type CompletedBookingRow = {
  id: string;
  user_id: string | null;
  experiences: ExperienceRelation | ExperienceRelation[] | null;
};

type HostReviewRequestNotificationRow = {
  id: number;
  user_id: string;
  booking_id: string | null;
};

type SendEmail = typeof sendImmediateGenericEmail;

function getExperience(relation: CompletedBookingRow['experiences'] | undefined) {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

function normalizeBookingIds(bookingIds: string[]) {
  return Array.from(
    new Set(
      bookingIds
        .map((bookingId) => bookingId.trim())
        .filter(Boolean)
    )
  );
}

export async function deliverHostGuestReviewRequestsForCompletedBookings(params: {
  supabaseAdmin: SupabaseClient;
  completedBookingIds: string[];
  sendEmail?: SendEmail;
}) {
  const bookingIds = normalizeBookingIds(params.completedBookingIds);
  if (bookingIds.length === 0) {
    return { processedCount: 0, failedCount: 0 };
  }

  const [bookingsResult, notificationsResult] = await Promise.all([
    params.supabaseAdmin
      .from('bookings')
      .select('id, user_id, experiences!inner(host_id, title)')
      .in('id', bookingIds),
    params.supabaseAdmin
      .from('notifications')
      .select('id, user_id, booking_id')
      .eq('type', 'guest_review_request')
      .in('booking_id', bookingIds),
  ]);

  if (bookingsResult.error) throw bookingsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;

  const bookingById = new Map(
    ((bookingsResult.data as CompletedBookingRow[] | null) || []).map((booking) => [
      String(booking.id),
      booking,
    ])
  );
  const notificationByBookingId = new Map(
    ((notificationsResult.data as HostReviewRequestNotificationRow[] | null) || [])
      .filter((notification) => notification.booking_id)
      .map((notification) => [String(notification.booking_id), notification])
  );
  const sendEmail = params.sendEmail ?? sendImmediateGenericEmail;

  const settledResults = await Promise.allSettled(
    bookingIds.map(async (bookingId) => {
      const booking = bookingById.get(bookingId);
      const experience = getExperience(booking?.experiences);
      const notification = notificationByBookingId.get(bookingId);

      if (
        !booking?.user_id ||
        !experience?.host_id ||
        !notification ||
        notification.user_id !== experience.host_id
      ) {
        return false;
      }

      const experienceTitle = experience.title || 'Locally Experience';
      const localizedNotification = await buildLocalizedNotificationInsert({
        supabaseAdmin: params.supabaseAdmin,
        userId: experience.host_id,
        type: 'guest_review_request',
        link: getHostGuestReviewRequestHref(bookingId, 'notification'),
        key: 'review.guest_request.host',
        copyParams: { experienceTitle },
      });

      const { error: updateError } = await params.supabaseAdmin
        .from('notifications')
        .update({
          title: localizedNotification.title,
          message: localizedNotification.message,
          link: localizedNotification.link,
        })
        .eq('id', notification.id)
        .eq('user_id', experience.host_id)
        .eq('type', 'guest_review_request')
        .eq('booking_id', bookingId);

      if (updateError) {
        console.warn(JSON.stringify({
          event: 'guest_review_request_delivery',
          status: 'partial',
          diagnosticCode: 'notification_localization_failed',
        }));
      }

      const emailResult = await sendEmail({
        recipientUserId: experience.host_id,
        templatedEmail: {
          templateId: 'notice.copy',
          audience: 'host',
          payload: {
            copyKey: 'review.guest_request.host',
            copyParams: { experienceTitle },
            ctaUrl: getHostGuestReviewRequestHref(bookingId, 'email'),
          },
        },
      });

      if (!emailResult.sent) {
        return emailResult.skipped === 'provider_not_configured' || emailResult.skipped === 'recipient_missing'
          ? emailResult.skipped
          : 'email_not_sent';
      }

      return true;
    })
  );

  let processedCount = 0;
  let failedCount = 0;

  settledResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value === true) processedCount += 1;
      if (typeof result.value === 'string') {
        failedCount += 1;
        console.warn(JSON.stringify({
          event: 'guest_review_request_delivery',
          status: 'failed',
          diagnosticCode: result.value,
        }));
      }
      return;
    }

    failedCount += 1;
    console.warn(JSON.stringify({
      event: 'guest_review_request_delivery',
      status: 'failed',
      diagnosticCode: 'post_completion_delivery_failed',
    }));
  });

  return { processedCount, failedCount };
}
