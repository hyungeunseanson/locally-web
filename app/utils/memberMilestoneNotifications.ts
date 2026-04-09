import type { SupabaseClient } from '@supabase/supabase-js';

import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import {
  fetchLocallyMembershipSummary,
  getLocallyMembershipMilestone,
} from '@/app/utils/memberStatus';

export async function notifyMembershipMilestone(params: {
  supabaseAdmin: SupabaseClient;
  userId: string | null;
}) {
  const { supabaseAdmin, userId } = params;
  if (!userId) return null;

  const membership = await fetchLocallyMembershipSummary(supabaseAdmin, userId);
  const milestone = getLocallyMembershipMilestone(membership.purchaseCount);

  if (!milestone) return membership;

  try {
    const notificationRow =
      milestone === 'circle'
        ? await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId,
            type: 'circle_welcome',
            link: '/account',
            key: 'membership.circle_welcome',
            copyParams: {
              status: 'circle',
            },
          })
        : await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId,
            type: 'member_welcome',
            link: '/account',
            key: 'membership.member_welcome',
            copyParams: {
              status: 'member',
            },
          });

    const { error } = await supabaseAdmin.from('notifications').insert(notificationRow);

    if (error) {
      console.error('[memberMilestoneNotifications] notification insert failed:', error);
    }
  } catch (error) {
    console.error('[memberMilestoneNotifications] notification side effect failed:', error);
  }

  return membership;
}
