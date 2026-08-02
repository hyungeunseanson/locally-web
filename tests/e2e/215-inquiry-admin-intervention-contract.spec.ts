import './helpers/serverOnlyTestShim';

import { expect, test } from '@playwright/test';

import { notifyAdminsOfNewGuestInquiry } from '@/app/api/inquiries/thread/shared';
import { isOfficialInquirySupportMessage } from '@/app/utils/inquiry';

test.describe('Inquiry admin intervention contracts', () => {
  test('classifies only support-side messages as official support', () => {
    expect(isOfficialInquirySupportMessage({
      inquiryType: 'general',
      senderId: 'guest',
      guestId: 'guest',
      hostId: 'host',
    })).toBe(false);

    expect(isOfficialInquirySupportMessage({
      inquiryType: 'general',
      senderId: 'host',
      guestId: 'guest',
      hostId: 'host',
    })).toBe(false);

    expect(isOfficialInquirySupportMessage({
      inquiryType: 'general',
      senderId: 'admin',
      guestId: 'guest',
      hostId: 'host',
    })).toBe(true);

    expect(isOfficialInquirySupportMessage({
      inquiryType: 'admin_support',
      senderId: 'guest',
      guestId: 'guest',
      hostId: null,
    })).toBe(false);

    expect(isOfficialInquirySupportMessage({
      inquiryType: 'admin_support',
      senderId: 'admin',
      guestId: 'guest',
      hostId: null,
    })).toBe(true);
  });

  test('builds distinct first-inquiry alerts and contains insertion failures', async () => {
    const writes: Array<{ title: string; message: string; link?: string | null }> = [];
    const insertAlerts = async (params: { title: string; message: string; link?: string | null }) => {
      writes.push(params);
      return { success: true, count: 1, targetCount: 1 };
    };

    await expect(notifyAdminsOfNewGuestInquiry({
      inquiryId: 101,
      inquiryType: 'admin_support',
      insertAlerts,
    })).resolves.toEqual({ success: true });

    await expect(notifyAdminsOfNewGuestInquiry({
      inquiryId: 102,
      inquiryType: 'general',
      insertAlerts,
    })).resolves.toEqual({ success: true });

    expect(writes).toEqual([
      {
        title: '새 고객센터 1:1 문의',
        message: '문의방 101에 새 문의가 접수되었습니다.',
        link: '/admin/dashboard?tab=CHATS&inquiryId=101',
      },
      {
        title: '새 게스트 문의',
        message: '문의방 102에 새 문의가 접수되었습니다.',
        link: '/admin/dashboard?tab=CHATS&inquiryId=102',
      },
    ]);

    await expect(notifyAdminsOfNewGuestInquiry({
      inquiryId: 103,
      inquiryType: 'general',
      insertAlerts: async () => {
        throw new Error('fixture insert failure');
      },
    })).resolves.toEqual({ success: false });
  });
});
