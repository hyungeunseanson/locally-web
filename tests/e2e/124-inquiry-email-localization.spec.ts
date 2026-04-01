import { expect, test } from '@playwright/test';

import { resolveInquiryNotificationEmailCopy } from '@/app/api/inquiries/thread/shared';
import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  getAdminClient,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];

async function setPreferredLocale(userId: string, locale: 'ko' | 'en' | 'ja' | 'zh') {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw error || new Error(`Failed to fetch auth user ${userId}.`);

  const metadata =
    data.user.user_metadata && typeof data.user.user_metadata === 'object'
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      preferred_locale: locale,
    },
  });

  if (updateError) throw updateError;
}

test.afterAll(async () => {
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Inquiry email localization helper', () => {
  test('localizes guest and host recipient email copy while keeping admin recipient copy Korean', async () => {
    const host = createTestUser('inquiry.locale.host');
    const guest = createTestUser('inquiry.locale.guest');
    const admin = createTestUser('inquiry.locale.admin');
    const hostId = await createAuthUser(host, createdAuthUserIds);
    const guestId = await createAuthUser(guest, createdAuthUserIds);
    const adminId = await createAuthUser(admin, createdAuthUserIds);

    await setPreferredLocale(hostId, 'ja');
    await setPreferredLocale(guestId, 'en');
    await setPreferredLocale(adminId, 'zh');

    const supabaseAdmin = getAdminClient();

    const hostRecipientCopy = await resolveInquiryNotificationEmailCopy({
      supabaseAdmin,
      recipientId: hostId,
      emailTitle: '💬 Sora님의 새 메시지',
      emailMessage: '集合場所を教えてください。',
      actorDisplayName: 'Sora',
      displayContent: '集合場所を教えてください。',
      localizeEmailForRecipient: true,
    });

    expect(hostRecipientCopy.subject).toBe('[Locally] Soraさんから新しいメッセージが届きました');
    expect(hostRecipientCopy.message).toBe('集合場所を教えてください。');
    expect(hostRecipientCopy.ctaLabel).toBe('メッセージを確認');

    const guestRecipientCopy = await resolveInquiryNotificationEmailCopy({
      supabaseAdmin,
      recipientId: guestId,
      emailTitle: '💬 로컬리 팀의 새 메시지',
      emailMessage: 'We checked your request.',
      actorDisplayName: 'Locally Support',
      displayContent: 'We checked your request.',
      localizeEmailForRecipient: true,
    });

    expect(guestRecipientCopy.subject).toBe('[Locally] New message from Locally Support');
    expect(guestRecipientCopy.message).toBe('We checked your request.');
    expect(guestRecipientCopy.ctaLabel).toBe('Check message');

    const adminRecipientCopy = await resolveInquiryNotificationEmailCopy({
      supabaseAdmin,
      recipientId: adminId,
      emailTitle: '💬 Mina님의 새 메시지',
      emailMessage: '문의 남겼습니다.',
      actorDisplayName: 'Mina',
      displayContent: '문의 남겼습니다.',
      localizeEmailForRecipient: false,
    });

    expect(adminRecipientCopy.subject).toBe('[Locally] 💬 Mina님의 새 메시지');
    expect(adminRecipientCopy.message).toBe('문의 남겼습니다.');
    expect(adminRecipientCopy.ctaLabel).toBe('확인하기');
  });
});
