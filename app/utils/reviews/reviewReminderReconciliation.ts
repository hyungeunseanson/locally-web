import type { SupabaseClient } from '@supabase/supabase-js';

import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { isBookingReviewEligible } from '@/app/utils/reviews/reviewEligibility';
import { getGuestReviewRequestHref, getHostGuestReviewRequestHref } from '@/app/utils/reviews/reviewRequestDeepLinks';

const REMINDER_LIMIT = 50;

type ReminderRow = {
  notification_id: number;
  booking_id: string;
  recipient_user_id: string;
  reminder_type: 'review_request_reminder' | 'guest_review_request_reminder';
  experience_title: string;
};

type BookingRow = {
  user_id: string | null;
  status: string | null;
  date: string | null;
  time: string | null;
  experiences: { host_id: string | null; duration: number | null } |
    { host_id: string | null; duration: number | null }[] | null;
};

function experienceOf(row: BookingRow) {
  return Array.isArray(row.experiences) ? row.experiences[0] ?? null : row.experiences;
}

function safeDiagnostic(skipped: string | undefined) {
  return skipped === 'provider_not_configured' || skipped === 'recipient_missing'
    ? skipped
    : 'email_not_sent';
}

export async function reconcileDueReviewRequestReminders(params: {
  supabaseAdmin: SupabaseClient;
  sendEmail?: typeof sendImmediateGenericEmail;
}) {
  const { data, error } = await params.supabaseAdmin.rpc('claim_due_review_request_reminders', {
    p_limit: REMINDER_LIMIT,
  });
  if (error) throw error;

  const reminders = (Array.isArray(data) ? data : []) as ReminderRow[];
  const sendEmail = params.sendEmail ?? sendImmediateGenericEmail;
  const settled = await Promise.allSettled(reminders.map(async (reminder) => {
    const guest = reminder.reminder_type === 'review_request_reminder';
    const title = reminder.experience_title || 'Locally Experience';
    const link = guest
      ? getGuestReviewRequestHref(reminder.booking_id, 'notification')
      : getHostGuestReviewRequestHref(reminder.booking_id, 'notification');
    const copyKey = guest
      ? 'review.request_reminder.guest' as const
      : 'review.guest_request_reminder.host' as const;

    // The DB claim is already committed. Copy or email failures must not undo it.
    try {
      const localized = await buildLocalizedNotificationInsert({
        supabaseAdmin: params.supabaseAdmin,
        userId: reminder.recipient_user_id,
        type: reminder.reminder_type,
        link,
        key: copyKey,
        copyParams: { experienceTitle: title },
      });
      const { error: updateError } = await params.supabaseAdmin
        .from('notifications')
        .update({ title: localized.title, message: localized.message, link })
        .eq('id', reminder.notification_id)
        .eq('booking_id', reminder.booking_id)
        .eq('type', reminder.reminder_type);
      if (updateError) throw updateError;
    } catch {
      console.warn(JSON.stringify({
        event: 'review_request_reminder', status: 'partial',
        diagnosticCode: 'notification_localization_failed',
      }));
    }

    // A review may have been submitted immediately after the DB claim.
    const [bookingResult, reviewResult] = await Promise.all([
      params.supabaseAdmin.from('bookings')
        .select('user_id, status, date, time, experiences!inner(host_id, duration)')
        .eq('id', reminder.booking_id).maybeSingle(),
      params.supabaseAdmin.from(guest ? 'reviews' : 'guest_reviews')
        .select('id').eq('booking_id', reminder.booking_id).limit(1),
    ]);
    if (bookingResult.error || reviewResult.error) throw new Error('post_claim_check_failed');
    const booking = bookingResult.data as BookingRow | null;
    const experience = booking ? experienceOf(booking) : null;
    if (
      !booking || booking.status !== 'completed' ||
      !isBookingReviewEligible({ date: booking.date, time: booking.time, duration: experience?.duration }) ||
      (guest ? booking.user_id : experience?.host_id) !== reminder.recipient_user_id ||
      (reviewResult.data?.length ?? 0) > 0
    ) return 'skipped' as const;

    const result = await sendEmail({
      recipientUserId: reminder.recipient_user_id,
      templatedEmail: {
        templateId: 'notice.copy',
        audience: guest ? 'guest' : 'host',
        payload: {
          copyKey,
          copyParams: { experienceTitle: title },
          ctaUrl: guest
            ? getGuestReviewRequestHref(reminder.booking_id, 'email')
            : getHostGuestReviewRequestHref(reminder.booking_id, 'email'),
        },
      },
    });
    return result.sent ? 'sent' as const : safeDiagnostic(result.skipped);
  }));

  let emailSentCount = 0;
  let emailFailedCount = 0;
  let skippedCount = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value === 'sent') {
      emailSentCount += 1;
    } else if (result.status === 'fulfilled' && result.value === 'skipped') {
      skippedCount += 1;
    } else {
      emailFailedCount += 1;
      console.warn(JSON.stringify({
        event: 'review_request_reminder', status: 'failed',
        diagnosticCode: result.status === 'fulfilled' ? result.value : 'email_delivery_failed',
      }));
    }
  }

  return { claimedCount: reminders.length, emailSentCount, emailFailedCount, skippedCount };
}
