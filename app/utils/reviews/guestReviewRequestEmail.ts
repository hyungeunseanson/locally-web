import type { SupabaseClient } from '@supabase/supabase-js';

import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

type ExperienceRelation = {
  title: string | null;
};

type CompletedBookingRow = {
  id: string;
  user_id: string | null;
  experiences: ExperienceRelation | ExperienceRelation[] | null;
};

type ReviewRequestNotificationRow = {
  user_id: string;
  booking_id: string | null;
};

type ReviewRow = {
  booking_id: string | null;
};

type SendEmail = typeof sendImmediateGenericEmail;

function getExperience(relation: CompletedBookingRow['experiences'] | undefined) {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

function normalizeBookingIds(bookingIds: string[]) {
  return Array.from(new Set(bookingIds.map((bookingId) => bookingId.trim()).filter(Boolean)));
}

export async function deliverGuestReviewRequestEmailsForCompletedBookings(params: {
  supabaseAdmin: SupabaseClient;
  notificationBookingIds: string[];
  sendEmail?: SendEmail;
}) {
  const bookingIds = normalizeBookingIds(params.notificationBookingIds);
  if (bookingIds.length === 0) {
    return { processedCount: 0, failedCount: 0 };
  }

  const [bookingsResult, notificationsResult, reviewsResult] = await Promise.all([
    params.supabaseAdmin
      .from('bookings')
      .select('id, user_id, experiences!inner(title)')
      .in('id', bookingIds),
    params.supabaseAdmin
      .from('notifications')
      .select('user_id, booking_id')
      .eq('type', 'review_request')
      .in('booking_id', bookingIds),
    params.supabaseAdmin
      .from('reviews')
      .select('booking_id')
      .in('booking_id', bookingIds),
  ]);

  if (bookingsResult.error) throw bookingsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const bookingById = new Map(
    ((bookingsResult.data as CompletedBookingRow[] | null) || []).map((booking) => [
      String(booking.id),
      booking,
    ])
  );
  const notificationByBookingId = new Map(
    ((notificationsResult.data as ReviewRequestNotificationRow[] | null) || [])
      .filter((notification) => notification.booking_id)
      .map((notification) => [String(notification.booking_id), notification])
  );
  const reviewedBookingIds = new Set(
    ((reviewsResult.data as ReviewRow[] | null) || [])
      .map((review) => review.booking_id)
      .filter((bookingId): bookingId is string => Boolean(bookingId))
  );
  const sendEmail = params.sendEmail ?? sendImmediateGenericEmail;

  const settledResults = await Promise.allSettled(
    bookingIds.map(async (bookingId) => {
      const booking = bookingById.get(bookingId);
      const notification = notificationByBookingId.get(bookingId);
      const experience = getExperience(booking?.experiences);

      if (
        !booking?.user_id ||
        !notification ||
        notification.user_id !== booking.user_id ||
        reviewedBookingIds.has(bookingId)
      ) {
        return false;
      }

      const result = await sendEmail({
        recipientUserId: booking.user_id,
        templatedEmail: {
          templateId: 'notice.copy',
          audience: 'guest',
          payload: {
            copyKey: 'review.request.guest',
            copyParams: { experienceTitle: experience?.title || 'Locally Experience' },
            ctaUrl: '/guest/trips',
          },
        },
      });

      if (!result.sent) {
        throw new Error(`Guest review request email was not sent: ${result.skipped || 'unknown'}`);
      }

      return true;
    })
  );

  let processedCount = 0;
  let failedCount = 0;

  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      if (result.value) processedCount += 1;
      continue;
    }

    failedCount += 1;
    console.warn(JSON.stringify({
      event: 'guest_review_request_email_delivery',
      status: 'failed',
      diagnosticCode: 'post_completion_email_failed',
    }));
  }

  return { processedCount, failedCount };
}
