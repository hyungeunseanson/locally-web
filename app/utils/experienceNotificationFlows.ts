import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { getHostBookingMessageHref } from '@/app/utils/hostBookingMessageLink';
import { notifyMembershipMilestone } from '@/app/utils/memberMilestoneNotifications';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

type ExperiencePaymentConfirmedParams = {
  supabaseAdmin: AdminClient;
  guestId: string | null;
  hostId: string | null;
  experienceId: string | number | null;
  experienceTitle: string;
  guestName: string;
  guestsCount: number;
  bookingDate: string;
  bookingTime: string | null;
  guestPaidAmount: number;
  hostBookingAmount: number;
};

export async function notifyExperiencePaymentConfirmed(
  params: ExperiencePaymentConfirmedParams
) {
  const {
    supabaseAdmin,
    guestId,
    hostId,
    experienceId,
    experienceTitle,
    guestName,
    guestsCount,
    bookingDate,
    bookingTime,
    guestPaidAmount,
    hostBookingAmount,
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

  const hostMessageHref = getHostBookingMessageHref({
    guestId,
    experienceId,
  });

  try {
    const notifications = [];

    if (hostId) {
      notifications.push(
        await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: hostId,
          type: 'new_booking',
          link: hostMessageHref,
          key: 'booking.confirmed.host',
          copyParams: {
            experienceTitle,
            guestName: displayName,
          },
        })
      );
    }

    if (guestId) {
      notifications.push(
        await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: guestId,
          type: 'booking_confirmed',
          link: '/guest/trips',
          key: 'booking.confirmed.guest',
          copyParams: {
            experienceTitle,
          },
        })
      );
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
    void sendImmediateGenericEmail({
      recipientUserId: hostId,
      subject: '',
      title: '',
      message: '',
      templatedEmail: {
        templateId: 'booking.confirmed',
        audience: 'host',
        payload: {
          experienceTitle,
          bookingDate,
          bookingTime: bookingTime || undefined,
          partySize: guestsCount,
          amount: hostBookingAmount,
          ctaUrl: hostMessageHref,
          guestName: displayName,
        },
      },
    }).catch((mailError) => {
      console.error('[ExperienceNotificationFlows] host booking email dispatch failed:', mailError);
    });
  }

  if (guestId) {
    void sendImmediateGenericEmail({
      recipientUserId: guestId,
      subject: '',
      title: '',
      message: '',
      templatedEmail: {
        templateId: 'booking.confirmed',
        audience: 'guest',
        transportPolicy: 'opsAdmin',
        payload: {
          experienceTitle,
          bookingDate,
          bookingTime: bookingTime || undefined,
          partySize: guestsCount,
          amount: guestPaidAmount,
          ctaUrl: '/guest/trips',
        },
      },
    })
      .then((emailResult) => {
        if (!emailResult.sent) {
          console.error('[ExperienceNotificationFlows] guest booking email skipped:', emailResult.skipped);
        }
      })
      .catch((emailError) => {
        console.error('[ExperienceNotificationFlows] guest booking email failed:', emailError);
      });

    void notifyMembershipMilestone({
      supabaseAdmin,
      userId: guestId,
    }).catch((milestoneError) => {
      console.error('[ExperienceNotificationFlows] membership milestone failed:', milestoneError);
    });
  }
}
