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
  waitForAuditLog,
} from './helpers/releaseJourney';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
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
      instagram: '@codex_release_admin_review',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'release admin review moderation 검증용 공개 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: 'release admin review moderation 검증',
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
  const title = `[Playwright] Review Moderation ${Date.now()}`;
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
      description: 'release admin review moderation 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: 'admin review moderation 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울역 1번 출구',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 42000,
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
      rating: 0,
      review_count: 0,
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
  const bookingId = `REL-ADMIN-REVIEW-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 3);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 42000,
    total_price: 42000,
    total_experience_price: 42000,
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
    host_payout_amount: 32000,
    platform_revenue: 10000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function createReview(params: {
  guestId: string;
  experienceId: number;
  bookingId: string;
  rating: number;
  content: string;
  reply?: string;
}) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      user_id: params.guestId,
      experience_id: params.experienceId,
      booking_id: params.bookingId,
      rating: params.rating,
      content: params.content,
      reply: params.reply ?? null,
      reply_at: params.reply ? new Date().toISOString() : null,
      photos: [],
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create review fixture.');
  }

  createdReviewIds.push(Number(data.id));
  return Number(data.id);
}

async function setReviewAggregates(hostId: string, experienceId: number, average: number, count: number) {
  const supabase = getTestAdminClient();

  const [experienceResult, profileResult] = await Promise.all([
    supabase
      .from('experiences')
      .update({ rating: average, review_count: count })
      .eq('id', experienceId),
    supabase
      .from('profiles')
      .update({ average_rating: average, total_review_count: count })
      .eq('id', hostId),
  ]);

  if (experienceResult.error) throw experienceResult.error;
  if (profileResult.error) throw profileResult.error;
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  if (createdReviewIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in(
      'target_id',
      createdReviewIds.map((reviewId) => String(reviewId))
    );
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

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Release journey 194: admin review moderation', () => {
  test('deletes a public review through the admin review-quality UI and updates public aggregates', async ({
    browser,
  }) => {
    test.setTimeout(240000);

    const adminUser = createTestUser('release.admin.review.admin');
    const hostUser = createTestUser('release.admin.review.host');
    const guestAUser = createTestUser('release.admin.review.guest.a');
    const guestBUser = createTestUser('release.admin.review.guest.b');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const guestAId = await createAuthUser(guestAUser);
    const guestBId = await createAuthUser(guestBUser);
    createdAuthUserIds.push(adminId, hostId, guestAId, guestBId);
    createdWhitelistEmails.push(adminUser.email);

    await Promise.all([
      setPreferredLocale(adminId, 'ko'),
      setPreferredLocale(hostId, 'ko'),
      setPreferredLocale(guestAId, 'ko'),
      setPreferredLocale(guestBId, 'ko'),
    ]);

    const supabase = getTestAdminClient();
    const { error: guestProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: '김성호',
        avatar_url: '/images/logo.png',
      })
      .eq('id', guestAId);
    if (guestProfileError) throw guestProfileError;

    const { error: guestBProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: '박민지',
      })
      .eq('id', guestBId);
    if (guestBProfileError) throw guestBProfileError;

    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createActiveExperience(hostId);
    const bookingA = await createCompletedBooking({
      guestId: guestAId,
      guest: guestAUser,
      experienceId: experience.id,
    });
    const bookingB = await createCompletedBooking({
      guestId: guestBId,
      guest: guestBUser,
      experienceId: experience.id,
    });

    const targetReviewContent = `release admin moderation target ${Date.now()}`;
    const survivingReviewContent = `release admin moderation survivor ${Date.now()}`;

    const targetReviewId = await createReview({
      guestId: guestAId,
      experienceId: experience.id,
      bookingId: bookingA,
      rating: 5,
      content: targetReviewContent,
      reply: '호스트가 남긴 기존 답글입니다.',
    });
    await createReview({
      guestId: guestBId,
      experienceId: experience.id,
      bookingId: bookingB,
      rating: 1,
      content: survivingReviewContent,
    });

    await setReviewAggregates(hostId, experience.id, 3, 2);

    const adminSession = await createIsolatedPage(browser, adminUser, 'ko');

    try {
      const adminPage = adminSession.page;

      const initialPublicPayload = await adminPage.request.get(
        `/api/public/hosts/${hostId}/reviews?lang=ko`
      );
      expect(initialPublicPayload.ok()).toBeTruthy();
      await expect(initialPublicPayload.json()).resolves.toMatchObject({
        success: true,
        summary: {
          average_rating: 3,
          review_count: 2,
        },
      });

      await adminPage.goto('/admin/dashboard?tab=ANALYTICS', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(adminPage);
      await adminPage.getByRole('button', { name: 'Review Quality' }).click();
      await expect(adminPage.getByText('Review Quality는 리뷰 품질과 이상 징후를 보는 운영 구간입니다.')).toBeVisible({
        timeout: 20000,
      });

      const searchInput = adminPage.getByPlaceholder('게스트명, 체험명, 내용 검색...');
      await searchInput.fill(targetReviewContent);
      await expect(adminPage.getByText(targetReviewContent)).toBeVisible({ timeout: 20000 });
      await adminPage.getByTitle('후기 삭제').click();
      await expect(adminPage.getByRole('heading', { name: '후기 삭제' })).toBeVisible({
        timeout: 20000,
      });
      await adminPage.getByRole('button', { name: '삭제' }).last().click();

      await expect(adminPage.getByText(targetReviewContent)).toHaveCount(0);
      await waitForAuditLog({
        actionType: 'DELETE_REVIEW',
        targetType: 'reviews',
        targetId: String(targetReviewId),
      });

      await expect
        .poll(async () => {
          const [{ data: deletedReview }, { data: experienceAggregate }, { data: hostAggregate }] =
            await Promise.all([
              supabase.from('reviews').select('id').eq('id', targetReviewId).maybeSingle(),
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
            deletedReviewId: deletedReview?.id ?? null,
            experienceRating: experienceAggregate?.rating ?? null,
            experienceCount: experienceAggregate?.review_count ?? null,
            hostAverageRating: hostAggregate?.average_rating ?? null,
            hostReviewCount: hostAggregate?.total_review_count ?? null,
          };
        }, { timeout: 20000 })
        .toEqual({
          deletedReviewId: null,
          experienceRating: 1,
          experienceCount: 1,
          hostAverageRating: 1,
          hostReviewCount: 1,
        });

      const finalPublicResponse = await adminPage.request.get(
        `/api/public/hosts/${hostId}/reviews?lang=ko`
      );
      expect(finalPublicResponse.ok()).toBeTruthy();
      const finalPublicPayload = await finalPublicResponse.json();
      expect(finalPublicPayload.summary).toMatchObject({
        average_rating: 1,
        review_count: 1,
      });
      expect(finalPublicPayload.data).toHaveLength(1);
      expect(finalPublicPayload.data[0]).toMatchObject({
        content: survivingReviewContent,
      });

      await adminPage.goto(`/users/${hostId}`, { waitUntil: 'networkidle' });
      await expect(adminPage.getByTestId('public-host-reviews-section')).toBeVisible({
        timeout: 20000,
      });
      await expect(
        adminPage
          .locator('[data-testid="public-host-reviews-section"] p:visible')
          .filter({ hasText: targetReviewContent })
      ).toHaveCount(0);
      await expect(
        adminPage
          .locator('[data-testid="public-host-reviews-section"] p:visible')
          .filter({ hasText: survivingReviewContent })
          .first()
      ).toBeVisible();
    } finally {
      await adminSession.context.close();
    }
  });
});
