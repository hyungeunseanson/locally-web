import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { notifyMembershipMilestone } from '@/app/utils/memberMilestoneNotifications';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
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
      notifications.push(
        await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: hostId,
          type: 'new_booking',
          link: '/host/dashboard',
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
          amount: totalAmount,
          ctaUrl: '/host/dashboard',
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
        payload: {
          experienceTitle,
          bookingDate,
          bookingTime: bookingTime || undefined,
          partySize: guestsCount,
          amount: totalAmount,
          ctaUrl: '/guest/trips',
        },
      },
    }).catch((emailError) => {
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
