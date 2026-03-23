import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

type ExperiencePaymentConfirmedParams = {
  supabaseAdmin: AdminClient;
  guestId: string | null;
  hostId: string | null;
  experienceTitle: string;
  guestName: string;
  guestsCount: number;
  bookingDate: string;
  bookingTime: string | null;
  totalAmount: number;
};

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export async function notifyExperiencePaymentConfirmed(
  params: ExperiencePaymentConfirmedParams
) {
  const {
    supabaseAdmin,
    guestId,
    hostId,
    experienceTitle,
    guestName,
    guestsCount,
    bookingDate,
    bookingTime,
    totalAmount,
  } = params;

  // Resolve actual profile name (fallback to passed guestName)
  let displayName = guestName;
  if (guestId) {
    const { data: guestProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', guestId)
      .maybeSingle();
    if (guestProfile?.full_name) displayName = guestProfile.full_name;
  }

  try {
    const notifications = [];

    if (hostId) {
      notifications.push({
        user_id: hostId,
        type: 'new_booking',
        title: '🎉 새로운 예약 도착!',
        message: `[${experienceTitle}] 체험에 ${displayName}님의 예약이 확정되었습니다.`,
        link: '/host/dashboard',
        is_read: false,
      });
    }

    if (guestId) {
      notifications.push({
        user_id: guestId,
        type: 'booking_confirmed',
        title: '✅ 예약이 확정되었습니다',
        message: `'${experienceTitle}' 결제가 완료되어 예약이 확정되었습니다.`,
        link: '/guest/trips',
        is_read: false,
      });
    }

    if (notifications.length > 0) {
      const { error } = await supabaseAdmin.from('notifications').insert(notifications);
      if (error) {
        console.error('[ExperienceNotificationFlows] payment notification insert failed:', error);
      }
    }
  } catch (error) {
    console.error('[ExperienceNotificationFlows] payment notification side effect failed:', error);
  }

  if (hostId) {
    const internalApiSecret = process.env.INTERNAL_API_SECRET;

    if (!internalApiSecret) {
      console.error('[ExperienceNotificationFlows] INTERNAL_API_SECRET is missing. Skipping host booking email dispatch.');
    } else {
      void fetch(`${getSiteUrl()}/api/notifications/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalApiSecret,
        },
        body: JSON.stringify({
          type: 'booking_confirmation',
          hostId,
          guestName: displayName,
          experienceTitle,
          guestsCount,
          bookingDate,
          bookingTime,
          totalAmount,
        }),
      }).catch((mailError) => {
        console.error('[ExperienceNotificationFlows] host booking email dispatch failed:', mailError);
      });
    }
  }

  if (guestId) {
    void sendImmediateGenericEmail({
      recipientUserId: guestId,
      subject: '[Locally] 예약이 확정되었습니다',
      title: '예약이 확정되었습니다',
      message: `'${experienceTitle}' 결제가 완료되어 예약이 확정되었습니다.`,
      link: '/guest/trips',
      ctaLabel: '내 여행 보기',
    }).catch((emailError) => {
      console.error('[ExperienceNotificationFlows] guest booking email failed:', emailError);
    });
  }
}
