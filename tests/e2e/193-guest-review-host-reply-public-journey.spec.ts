import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  type E2ETestUser,
} from './helpers/testSupabase';
import {
  createIsolatedPage,
  dismissAnnouncementIfVisible,
  setPreferredLocale,
  waitForNotification,
} from './helpers/releaseJourney';

const createdAuthUserIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdHostApplicationIds: number[] = [];
const createdBookingIds: string[] = [];
const createdReviewIds: number[] = [];

async function createApprovedHostApplication(userId: string, host: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어', 'English'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
      ],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-01-01',
      email: host.email,
      instagram: '@codex_release_review',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'release review journey 검증용 공개 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: 'release review journey 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function createActiveExperience(hostId: string) {
  const supabase = getTestAdminClient();
  const title = `[Playwright] Release Review Journey ${Date.now()}`;
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'release full journey 리뷰 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: '리뷰 journey 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      meeting_point_i18n: {
        ko: '서울역 1번 출구',
        en: 'Seoul Station Exit 1',
      },
      location: '서울역 1번 출구',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 48000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko', 'en'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create active experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function createCompletedBooking(params: {
  guestId: string;
  guest: E2ETestUser;
  experienceId: number;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `REL-REVIEW-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 3);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 48000,
    total_price: 48000,
    total_experience_price: 48000,
    status: 'completed',
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: bookingDate.toISOString(),
    payment_method: 'card',
    host_payout_amount: 36000,
    platform_revenue: 12000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  for (const reviewId of createdReviewIds) {
    await supabase.from('reviews').delete().eq('id', reviewId);
  }

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const hostApplicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', hostApplicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Release journey 193: guest review -> host reply -> public projection', () => {
  test('propagates review creation and host reply through guest, host, and public surfaces', async ({
    browser,
  }) => {
    test.setTimeout(240000);

    const hostUser = createTestUser('release.review.host');
    const guestUser = createTestUser('release.review.guest');

    const hostId = await createAuthUser(hostUser);
    const guestId = await createAuthUser(guestUser);
    createdAuthUserIds.push(hostId, guestId);

    await Promise.all([
      setPreferredLocale(hostId, 'ko'),
      setPreferredLocale(guestId, 'ko'),
    ]);

    const supabase = getTestAdminClient();
    const { error: guestProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: '김성호',
        avatar_url: '/images/logo.png',
      })
      .eq('id', guestId);

    if (guestProfileError) throw guestProfileError;

    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createActiveExperience(hostId);
    const bookingId = await createCompletedBooking({
      guestId,
      guest: guestUser,
      experienceId: experience.id,
    });

    const guestSession = await createIsolatedPage(browser, guestUser, 'ko');
    const hostSession = await createIsolatedPage(browser, hostUser, 'ko');

    const reviewContent = `release guest review journey ${Date.now()}`;
    const replyContent = `release host review reply ${Date.now()}`;

    try {
      const guestPage = guestSession.page;
      const hostPage = hostSession.page;

      await guestPage.goto('/guest/trips', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(guestPage);

      const guestTripCard = guestPage
        .locator('div[role="button"]:visible')
        .filter({ hasText: experience.title })
        .first();
      await expect(guestTripCard).toBeVisible({ timeout: 20000 });

      await guestTripCard.getByRole('button', { name: '후기 작성하기' }).click();
      await expect(
        guestPage.getByPlaceholder('솔직한 후기를 남겨주세요. (최소 10자 이상)')
      ).toBeVisible({
        timeout: 20000,
      });

      await guestPage.locator('button:has(svg.lucide-star)').nth(4).click();
      await guestPage.getByPlaceholder('솔직한 후기를 남겨주세요. (최소 10자 이상)').fill(reviewContent);
      await guestPage.getByRole('button', { name: '후기 등록하기' }).click();

      await expect
        .poll(async () => {
          const [{ data: review }, { data: experienceAggregate }, { data: profileAggregate }] =
            await Promise.all([
              supabase
                .from('reviews')
                .select('id, rating, content, reply')
                .eq('booking_id', bookingId)
                .eq('user_id', guestId)
                .maybeSingle(),
              supabase
                .from('experiences')
                .select('rating, review_count')
                .eq('id', experience.id)
                .maybeSingle(),
              supabase
                .from('profiles')
                .select('average_rating, total_review_count')
                .eq('id', hostId)
                .maybeSingle(),
            ]);

          return {
            id: review?.id ?? null,
            rating: review?.rating ?? null,
            content: review?.content ?? null,
            reply: review?.reply ?? null,
            experienceRating: experienceAggregate?.rating ?? null,
            experienceCount: experienceAggregate?.review_count ?? null,
            hostAverageRating: profileAggregate?.average_rating ?? null,
            hostReviewCount: profileAggregate?.total_review_count ?? null,
          };
        }, { timeout: 20000 })
        .toEqual({
          id: expect.any(Number),
          rating: 5,
          content: reviewContent,
          reply: null,
          experienceRating: 5,
          experienceCount: 1,
          hostAverageRating: 5,
          hostReviewCount: 1,
        });

      const { data: createdReviewRow, error: createdReviewLookupError } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('user_id', guestId)
        .maybeSingle();

      if (createdReviewLookupError || !createdReviewRow?.id) {
        throw createdReviewLookupError || new Error('Failed to look up the created review row.');
      }

      const createdReviewId = Number(createdReviewRow.id);
      createdReviewIds.push(createdReviewId);

      await waitForNotification({
        userId: hostId,
        type: 'new_review',
        title: '새 후기가 등록되었습니다',
        linkIncludes: 'tab=reviews',
      });

      await hostPage.goto('/host/dashboard?tab=reviews', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(hostPage);
      await expect(hostPage.getByText(reviewContent)).toBeVisible({ timeout: 20000 });

      await hostPage.getByRole('button', { name: '답글 달기' }).click();
      await hostPage.getByPlaceholder('게스트에게 감사의 인사를 전해보세요.').fill(replyContent);
      await hostPage.getByRole('button', { name: '답글 등록' }).click();

      await expect(hostPage.getByText(replyContent)).toBeVisible({ timeout: 20000 });
      await waitForNotification({
        userId: guestId,
        type: 'review_reply',
        linkIncludes: '/guest/trips',
      });

      await expect
        .poll(async () => {
          const { data } = await supabase
            .from('reviews')
            .select('reply, reply_at')
            .eq('id', createdReviewId)
            .maybeSingle();

          return {
            reply: data?.reply ?? null,
            hasReplyAt: Boolean(data?.reply_at),
          };
        }, { timeout: 20000 })
        .toEqual({
          reply: replyContent,
          hasReplyAt: true,
        });

      await guestPage.reload({ waitUntil: 'networkidle' });
      const reviewedTripCard = guestPage
        .locator('div[role="button"]:visible')
        .filter({ hasText: experience.title })
        .first();
      await expect(reviewedTripCard.getByText('후기 작성 완료')).toBeVisible({ timeout: 20000 });

      const publicReviewsResponse = await guestPage.request.get(
        `/api/public/hosts/${hostId}/reviews?lang=ko`
      );
      expect(publicReviewsResponse.ok()).toBeTruthy();
      const publicReviewsPayload = await publicReviewsResponse.json();
      expect(publicReviewsPayload.summary).toMatchObject({
        average_rating: 5,
        review_count: 1,
      });
      expect(publicReviewsPayload.data[0]).toMatchObject({
        rating: 5,
        content: reviewContent,
        reply: replyContent,
        reviewer: {
          display_name: '김성*',
          avatar_url: '/images/logo.png',
        },
      });

      await guestPage.goto(`/users/${hostId}`, { waitUntil: 'networkidle' });
      await expect(
        guestPage.getByTestId('public-host-reviews-section')
      ).toBeVisible({ timeout: 20000 });
      await expect(
        guestPage
          .getByTestId('public-host-reviews-section')
          .locator('[data-testid="public-reviewer-name"]:visible')
          .first()
      ).toHaveText('김성*');
      await expect(
        guestPage
          .locator('[data-testid="public-host-reviews-section"] p:visible')
          .filter({ hasText: reviewContent })
          .first()
      ).toBeVisible();
      await expect(
        guestPage
          .locator('[data-testid="public-host-reviews-section"] p:visible')
          .filter({ hasText: replyContent })
          .first()
      ).toBeVisible();
    } finally {
      await Promise.all([guestSession.context.close(), hostSession.context.close()]);
    }
  });
});
