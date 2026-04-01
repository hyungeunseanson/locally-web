import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedEmailCopy } from '@/app/utils/emailCopy';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import {
  fetchLocallyMembershipSummary,
  getLocallyMembershipMilestone,
  type LocallyMembershipStatus,
} from '@/app/utils/memberStatus';
import { createAdminClient } from '@/app/utils/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

function getMembershipMilestoneCopy(status: Extract<LocallyMembershipStatus, 'member' | 'circle'>) {
  if (status === 'circle') {
    return {
      type: 'circle_welcome' as const,
      notificationKey: 'membership.circle_welcome' as const,
      emailKey: 'membership.circle_welcome' as const,
    };
  }

  return {
    type: 'member_welcome' as const,
    notificationKey: 'membership.member_welcome' as const,
    emailKey: 'membership.member_welcome' as const,
  };
}

export async function notifyMembershipMilestone(params: {
  supabaseAdmin: AdminClient;
  userId: string | null;
}) {
  const { supabaseAdmin, userId } = params;
  if (!userId) return null;

  const membership = await fetchLocallyMembershipSummary(supabaseAdmin, userId);
  const milestone = getLocallyMembershipMilestone(membership.purchaseCount);

  if (!milestone) return membership;

  const copy = getMembershipMilestoneCopy(milestone);

  try {
    const notificationRow = await buildLocalizedNotificationInsert({
      supabaseAdmin,
      userId,
      type: copy.type,
      link: '/account',
      key: copy.notificationKey,
      copyParams: {
        status: milestone,
      },
    });

    const { error } = await supabaseAdmin.from('notifications').insert(notificationRow);

    if (error) {
      console.error('[memberMilestoneNotifications] notification insert failed:', error);
    }
  } catch (error) {
    console.error('[memberMilestoneNotifications] notification side effect failed:', error);
  }

  const emailCopy = await buildLocalizedEmailCopy({
    supabaseAdmin,
    userId,
    key: copy.emailKey,
    copyParams: {
      status: milestone,
    },
  });

  void sendImmediateGenericEmail({
    recipientUserId: userId,
    subject: emailCopy.subject,
    title: emailCopy.title,
    message: emailCopy.message,
    link: '/account',
    ctaLabel: emailCopy.ctaLabel,
  }).catch((error) => {
    console.error('[memberMilestoneNotifications] email dispatch failed:', error);
  });

  return membership;
}
