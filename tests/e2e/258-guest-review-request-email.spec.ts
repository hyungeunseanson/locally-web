import { expect, test } from '@playwright/test';

import { buildEmailCopy } from '@/app/utils/emailCopy';
import { deliverGuestReviewRequestEmailsForCompletedBookings } from '@/app/utils/reviews/guestReviewRequestEmail';
import {
  buildHistoricalReviewRequestBackfillPlan,
  executeHistoricalReviewRequestBackfill,
} from '@/app/utils/reviews/guestReviewRequestEmailBackfill';

function createDeliveryClient(reviewed = false) {
  return {
    from(table: string) {
      if (table === 'bookings') return { select: () => ({ in: async () => ({
        data: [{ id: 'booking-1', user_id: 'guest-1', experiences: { title: 'Seoul Night Walk' } }],
        error: null,
      }) }) };
      if (table === 'notifications') return { select: () => ({ eq: () => ({ in: async () => ({
        data: [{ user_id: 'guest-1', booking_id: 'booking-1' }], error: null,
      }) }) }) };
      return { select: () => ({ in: async () => ({
        data: reviewed ? [{ booking_id: 'booking-1' }] : [], error: null,
      }) }) };
    },
  };
}

const baseBooking = {
  experienceId: 'experience',
  date: '2026-09-10',
  time: '14:00',
  duration: 2,
  status: 'completed',
};

test.describe('Guest review request email', () => {
  test('renders the four locales through the shared notice.copy key', () => {
    expect(buildEmailCopy('review.request.guest', 'ko', { experienceTitle: '서울 야경 산책' })).toEqual({
      subject: '[Locally] 여행은 어떠셨나요? 후기를 남겨주세요',
      title: '여행의 기억을 남겨주세요',
      message: "'서울 야경 산책' 체험은 어떠셨나요? 소중한 후기는 호스트와 다음 여행자에게 큰 도움이 됩니다.",
      ctaLabel: '후기 작성하기',
    });
    expect(buildEmailCopy('review.request.guest', 'en', { experienceTitle: 'Seoul Night Walk' })).toEqual({
      subject: '[Locally] How was your trip? Share your review',
      title: 'Keep your travel memories alive',
      message: "How was your 'Seoul Night Walk' experience? Your review means a lot to your host and helps future travelers.",
      ctaLabel: 'Write a review',
    });
    expect(buildEmailCopy('review.request.guest', 'ja', { experienceTitle: '東京ナイトツアー' })).toEqual({
      subject: '[Locally] 旅はいかがでしたか？レビューをお寄せください',
      title: '旅の思い出を残しましょう',
      message: '「東京ナイトツアー」の体験はいかがでしたか？大切なレビューは、ホストと次の旅行者の大きな助けになります。',
      ctaLabel: 'レビューを書く',
    });
    expect(buildEmailCopy('review.request.guest', 'zh', { experienceTitle: '首尔夜景散步' })).toEqual({
      subject: '[Locally] 这次旅行怎么样？欢迎留下评价',
      title: '记录您的旅行回忆',
      message: '“首尔夜景散步”体验怎么样？您的宝贵评价将为体验达人和之后的旅行者提供很大帮助。',
      ctaLabel: '撰写评价',
    });
  });

  test('sends notice.copy only for an unreviewed booking and isolates failures', async () => {
    const requests: unknown[] = [];
    await expect(deliverGuestReviewRequestEmailsForCompletedBookings({
      supabaseAdmin: createDeliveryClient() as never,
      notificationBookingIds: ['booking-1'],
      sendEmail: async (request) => { requests.push(request); return { sent: true } as never; },
    })).resolves.toEqual({ processedCount: 1, failedCount: 0 });
    expect(requests).toEqual([{
      recipientUserId: 'guest-1',
      templatedEmail: {
        templateId: 'notice.copy', audience: 'guest',
        payload: {
          copyKey: 'review.request.guest',
          copyParams: { experienceTitle: 'Seoul Night Walk' },
          ctaUrl: '/guest/trips?reviewBookingId=booking-1&reviewSource=email',
        },
      },
    }]);

    let sends = 0;
    await expect(deliverGuestReviewRequestEmailsForCompletedBookings({
      supabaseAdmin: createDeliveryClient(true) as never,
      notificationBookingIds: ['booking-1'],
      sendEmail: async () => { sends += 1; return { sent: true } as never; },
    })).resolves.toEqual({ processedCount: 0, failedCount: 0 });
    expect(sends).toBe(0);

    await expect(deliverGuestReviewRequestEmailsForCompletedBookings({
      supabaseAdmin: createDeliveryClient() as never,
      notificationBookingIds: ['booking-1'],
      sendEmail: async () => { throw new Error('provider unavailable'); },
    })).resolves.toEqual({ processedCount: 0, failedCount: 1 });
  });

  test('groups five historical bookings into three customer emails using the latest title', async () => {
    const bookings = [
      ['b1', 'u1', '2026-09-10', 'First'], ['b2', 'u1', '2026-09-12', 'Latest'],
      ['b3', 'u1', '2026-09-11', 'Middle'], ['b4', 'u2', '2026-09-13', 'Second'],
      ['b5', 'u3', '2026-09-14', 'Third'],
    ].map(([id, userId, date, experienceTitle]) => ({
      ...baseBooking, id, userId, date, experienceTitle,
    }));
    const plan = buildHistoricalReviewRequestBackfillPlan({
      bookings, reviewedBookingIds: new Set(), markedUserIds: new Set(),
    });
    expect(plan).toMatchObject({ eligibleBookingCount: 5, uniqueCustomerCount: 3 });
    expect(plan.representatives.find((booking) => booking.userId === 'u1')?.experienceTitle).toBe('Latest');

    const sent: string[] = [];
    const marked: string[] = [];
    await expect(executeHistoricalReviewRequestBackfill({
      plan, apply: true,
      isMarked: async () => false,
      hasReview: async () => false,
      sendEmail: async (booking) => { sent.push(booking.userId); return { sent: true }; },
      recordMarker: async (booking) => { marked.push(booking.userId); },
    })).resolves.toMatchObject({ attemptedCustomers: 3, sentCustomers: 3, failedCustomers: 0 });
    expect(sent.sort()).toEqual(['u1', 'u2', 'u3']);
    expect(marked.sort()).toEqual(['u1', 'u2', 'u3']);
  });

  test('skips reviewed and marked customers, and blocks an oversized apply', async () => {
    const plan = buildHistoricalReviewRequestBackfillPlan({
      bookings: [
        { ...baseBooking, id: 'reviewed', userId: 'u1', experienceTitle: 'Reviewed' },
        { ...baseBooking, id: 'marked', userId: 'u2', experienceTitle: 'Marked' },
      ],
      reviewedBookingIds: new Set(['reviewed']), markedUserIds: new Set(['u2']),
    });
    expect(plan).toMatchObject({
      eligibleBookingCount: 1, uniqueCustomerCount: 1,
      alreadyMarkedCustomerCount: 1, skippedReviewedCount: 1, representatives: [],
    });
    await expect(executeHistoricalReviewRequestBackfill({
      plan, apply: true,
      isMarked: async () => true, hasReview: async () => false,
      sendEmail: async () => { throw new Error('must not send'); },
      recordMarker: async () => { throw new Error('must not mark'); },
    })).resolves.toMatchObject({ sentCustomers: 0 });

    const changedAfterDryRun = buildHistoricalReviewRequestBackfillPlan({
      bookings: [{ ...baseBooking, id: 'newly-reviewed', userId: 'u3', experienceTitle: 'Recent' }],
      reviewedBookingIds: new Set(), markedUserIds: new Set(),
    });
    await expect(executeHistoricalReviewRequestBackfill({
      plan: changedAfterDryRun, apply: true,
      isMarked: async () => false, hasReview: async () => true,
      sendEmail: async () => { throw new Error('must not send'); },
      recordMarker: async () => { throw new Error('must not mark'); },
    })).resolves.toMatchObject({ skippedReviewed: 1, sentCustomers: 0 });

    let markerCalls = 0;
    await expect(executeHistoricalReviewRequestBackfill({
      plan: changedAfterDryRun, apply: true,
      isMarked: async () => false, hasReview: async () => false,
      sendEmail: async () => ({ sent: false }),
      recordMarker: async () => { markerCalls += 1; },
    })).resolves.toMatchObject({ failedCustomers: 1, sentCustomers: 0 });
    expect(markerCalls).toBe(0);

    const unsafePlan = buildHistoricalReviewRequestBackfillPlan({
      bookings: Array.from({ length: 6 }, (_, index) => ({
        ...baseBooking, id: `b${index}`, userId: `u${index % 3}`, experienceTitle: 'Experience',
      })),
      reviewedBookingIds: new Set(), markedUserIds: new Set(),
    });
    await expect(executeHistoricalReviewRequestBackfill({
      plan: unsafePlan, apply: true,
      isMarked: async () => false, hasReview: async () => false,
      sendEmail: async () => ({ sent: true }), recordMarker: async () => undefined,
    })).rejects.toThrow('approved safety bound');
  });
});
