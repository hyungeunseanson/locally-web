import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
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
      title: '🌙 Tier 2에 오신 것을 환영합니다',
      message: '다시 찾아와 주셔서 감사합니다. 더 가까운 케어와 우선 안내가 이어집니다.',
      emailSubject: '[Locally] Tier 2에 오신 것을 환영합니다',
      emailTitle: '이제 Tier 2입니다',
      emailMessage:
        '다시 찾아와 주셔서 감사합니다. 이제 Tier 2 게스트로 더 가까운 케어와 우선 안내를 받을 수 있습니다.',
    };
  }

  return {
    type: 'member_welcome' as const,
    title: '✨ Tier 1이 열렸습니다',
    message: '첫 구매가 완료되며 로컬리와의 연결이 시작됐어요.',
    emailSubject: '[Locally] Tier 1이 열렸습니다',
    emailTitle: '이제 Tier 1입니다',
    emailMessage:
      '첫 구매가 완료되며 로컬리와의 연결이 시작됐어요. 로컬리 안에서 여행 기록이 쌓이고, 필요할 때 Locally Care로 이어갈 수 있습니다.',
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
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: copy.type,
      title: copy.title,
      message: copy.message,
      link: '/account',
      is_read: false,
    });

    if (error) {
      console.error('[memberMilestoneNotifications] notification insert failed:', error);
    }
  } catch (error) {
    console.error('[memberMilestoneNotifications] notification side effect failed:', error);
  }

  void sendImmediateGenericEmail({
    recipientUserId: userId,
    subject: copy.emailSubject,
    title: copy.emailTitle,
    message: copy.emailMessage,
    link: '/account',
    ctaLabel: '내 멤버 보기',
  }).catch((error) => {
    console.error('[memberMilestoneNotifications] email dispatch failed:', error);
  });

  return membership;
}
