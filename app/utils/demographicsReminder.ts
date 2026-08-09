import 'server-only';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveRecipientLocale, type NotificationLocale } from '@/app/utils/notificationLocale';

const REMINDER_COPY: Record<NotificationLocale, { title: string; message: string }> = {
  ko: {
    title: '예약 전 필수 정보를 입력해 주세요',
    message: '생년월일과 성별을 입력하면 호스트가 체험을 더 잘 준비할 수 있습니다.',
  },
  en: {
    title: 'Complete your information before booking',
    message: 'Your birth date and gender help the host prepare the experience appropriately.',
  },
  ja: {
    title: '予約前に必須情報を入力してください',
    message: '生年月日と性別を入力すると、ホストが体験を適切に準備できます。',
  },
  zh: {
    title: '请在预订前填写必要信息',
    message: '填写出生日期和性别后，体验达人可以更妥善地准备体验。',
  },
};

export async function ensureDemographicsReminder(userId: string) {
  const supabaseAdmin = createAdminClient();
  const locale = await resolveRecipientLocale(supabaseAdmin, userId);
  const copy = REMINDER_COPY[locale];
  const { data, error } = await supabaseAdmin.rpc('ensure_profile_demographics_reminder', {
    p_user_id: userId,
    p_title: copy.title,
    p_message: copy.message,
    p_link: '/account?complete=demographics',
  });

  if (error) throw error;
  return Boolean(data);
}
