import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  login,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdReviewIds: number[] = [];
const createdNotificationIds: number[] = [];
const createdAdminAlertIds: number[] = [];
const createdAuditLogIds: string[] = [];

async function createExperienceFixture(hostId: string, suffix: string) {
  const { data, error } = await getTestAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title: `[Playwright] Review Contract ${suffix} ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '리뷰 계약 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '리뷰 계약 검증 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'approved',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
      rating: 0,
      review_count: 0,
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function createCompletedBooking(params: {
  guestId: string;
  guestName: string;
  guestPhone: string;
  experienceId: number;
  suffix: string;
}) {
  const bookingId = `REVIEW-CONTRACT-${params.suffix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 3);

  const { error } = await getTestAdminClient().from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: 'completed',
    guests: 1,
    date: formatDate(bookingDate),
    time: '10:00',
    type: 'group',
    contact_name: params.guestName,
    contact_phone: params.guestPhone,
    message: '',
    created_at: bookingDate.toISOString(),
    payment_method: 'card',
    host_payout_amount: 24000,
    platform_revenue: 9000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function createReviewFixture(params: {
  guestId: string;
  experienceId: number;
  bookingId: string;
  rating: number;
  content: string;
}) {
  const { data, error } = await getTestAdminClient()
    .from('reviews')
    .insert({
      user_id: params.guestId,
      experience_id: params.experienceId,
      booking_id: params.bookingId,
      rating: params.rating,
      content: params.content,
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

async function setProfileReviewAggregate(hostId: string, rating: number | null, reviewCount: number) {
  const { error } = await getTestAdminClient()
    .from('profiles')
    .update({
      average_rating: rating,
      total_review_count: reviewCount,
    })
    .eq('id', hostId);

  if (error) throw error;
}

async function createAdminUser(prefix: string) {
  const adminUser = createTestUser(`review.contract.admin.${prefix}`);
  const adminId = await createAuthUser(adminUser, { isAdmin: true });
  createdAuthUserIds.push(adminId);
  createdWhitelistEmails.push(adminUser.email);
  return { adminUser, adminId };
}

async function createRegularUser(prefix: string) {
  const user = createTestUser(`review.contract.${prefix}`);
  const userId = await createAuthUser(user);
  createdAuthUserIds.push(userId);
  return { user, userId };
}

async function postReviewFromBrowser(page: Page, payload: Record<string, unknown>) {
  return page.evaluate(async (requestPayload) => {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, payload);
}

async function postReviewConcurrentlyFromBrowser(page: Page, payload: Record<string, unknown>) {
  return page.evaluate(async (requestPayload) => {
    const execute = async () => {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    return Promise.all([execute(), execute()]);
  }, payload);
}

async function patchReviewFromBrowser(page: Page, reviewId: number, payload: Record<string, unknown>) {
  return page.evaluate(async ({ targetReviewId, requestPayload }) => {
    const response = await fetch(`/api/reviews/${targetReviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, { targetReviewId: reviewId, requestPayload: payload });
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdAdminAlertIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdAdminAlertIds);
  }

  if (createdAuditLogIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in('id', createdAuditLogIds);
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

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Review route contract', () => {
  test('creates review with booking truth, notification, admin alert, and synced aggregates', async ({ page }) => {
    test.setTimeout(90000);

    const { userId: hostId } = await createRegularUser('host.create');
    const { user: guest, userId: guestId } = await createRegularUser('guest.create');
    const experience = await createExperienceFixture(hostId, 'create');
    const bookingId = await createCompletedBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId: experience.id,
      suffix: 'create',
    });

    await login(page, guest);

    const reviewContent = `리뷰 생성 계약 검증 ${Date.now()}`;
    const responsePayload = await postReviewFromBrowser(page, {
      experienceId: experience.id,
      bookingId,
      rating: 5,
      content: reviewContent,
      photos: ['/images/ignored.png'],
    });

    expect(responsePayload.status).toBe(200);
    expect(responsePayload.body.success).toBe(true);

    await expect
      .poll(async () => {
        const [{ data: reviewRow, error: reviewError }, { data: experienceRow, error: experienceError }, { data: profileRow, error: profileError }] = await Promise.all([
          getTestAdminClient()
            .from('reviews')
            .select('id, experience_id, rating, content, photos')
            .eq('booking_id', bookingId)
            .eq('user_id', guestId)
            .maybeSingle(),
          getTestAdminClient()
            .from('experiences')
            .select('rating, review_count')
            .eq('id', experience.id)
            .maybeSingle(),
          getTestAdminClient()
            .from('profiles')
            .select('average_rating, total_review_count')
            .eq('id', hostId)
            .maybeSingle(),
        ]);

        if (reviewError) throw reviewError;
        if (experienceError) throw experienceError;
        if (profileError) throw profileError;

        return {
          reviewId: reviewRow?.id ?? null,
          experienceId: reviewRow?.experience_id ?? null,
          rating: reviewRow?.rating ?? null,
          content: reviewRow?.content ?? null,
          photos: reviewRow?.photos ?? null,
          experienceRating: experienceRow?.rating ?? null,
          experienceReviewCount: experienceRow?.review_count ?? null,
          hostAverageRating: profileRow?.average_rating ?? null,
          hostReviewCount: profileRow?.total_review_count ?? null,
        };
      }, { timeout: 15000 })
      .toEqual({
        reviewId: expect.any(Number),
        experienceId: experience.id,
        rating: 5,
        content: reviewContent,
        photos: [],
        experienceRating: 5,
        experienceReviewCount: 1,
        hostAverageRating: 5,
        hostReviewCount: 1,
      });

    const { data: reviewRow, error: reviewError } = await getTestAdminClient()
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('user_id', guestId)
      .maybeSingle();

    if (reviewError) throw reviewError;
    if (reviewRow?.id) createdReviewIds.push(Number(reviewRow.id));

    const { data: notificationRows, error: notificationError } = await getTestAdminClient()
      .from('notifications')
      .select('id, type, link, title, message')
      .eq('user_id', hostId)
      .eq('type', 'new_review')
      .eq('link', '/host/dashboard?tab=reviews')
      .order('created_at', { ascending: false })
      .limit(1);

    if (notificationError) throw notificationError;
    for (const row of notificationRows || []) {
      createdNotificationIds.push(Number(row.id));
    }

    expect(notificationRows?.[0]).toMatchObject({
      type: 'new_review',
      link: '/host/dashboard?tab=reviews',
      title: '새 후기가 등록되었습니다',
      message: `'${experience.title}'에 새 후기가 작성되었습니다.`,
    });

    const { data: adminAlertRows, error: adminAlertError } = await getTestAdminClient()
      .from('notifications')
      .select('id, type, title, message')
      .eq('type', 'admin_alert')
      .eq('title', '새 후기가 등록되었습니다')
      .eq('message', `'${experience.title}' 체험에 새 후기가 작성되었습니다.`);

    if (adminAlertError) throw adminAlertError;
    for (const row of adminAlertRows || []) {
      createdAdminAlertIds.push(Number(row.id));
    }

    expect(adminAlertRows?.[0]).toMatchObject({
      type: 'admin_alert',
      title: '새 후기가 등록되었습니다',
      message: `'${experience.title}' 체험에 새 후기가 작성되었습니다.`,
    });
  });

  test('allows only one concurrent review per booking and blocks later duplicate writes', async ({ page }) => {
    test.setTimeout(90000);

    const { userId: hostId } = await createRegularUser('host.concurrent');
    const { user: guest, userId: guestId } = await createRegularUser('guest.concurrent');
    const experience = await createExperienceFixture(hostId, 'concurrent');
    const bookingId = await createCompletedBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId: experience.id,
      suffix: 'concurrent',
    });

    await login(page, guest);

    const reviewContent = `동시 리뷰 생성 계약 검증 ${Date.now()}`;
    const responses = await postReviewConcurrentlyFromBrowser(page, {
      experienceId: experience.id,
      bookingId,
      rating: 5,
      content: reviewContent,
    });

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409)?.body).toMatchObject({
      error: '이미 후기를 작성하셨습니다.',
    });

    const sequentialDuplicateResponse = await postReviewFromBrowser(page, {
      experienceId: experience.id,
      bookingId,
      rating: 5,
      content: reviewContent,
    });
    expect(sequentialDuplicateResponse).toMatchObject({
      status: 409,
      body: { error: '이미 후기를 작성하셨습니다.' },
    });

    await expect
      .poll(async () => {
        const [reviewsResult, experienceResult, profileResult, notificationsResult] = await Promise.all([
          getTestAdminClient()
            .from('reviews')
            .select('id, rating, content')
            .eq('booking_id', bookingId)
            .eq('user_id', guestId),
          getTestAdminClient()
            .from('experiences')
            .select('rating, review_count')
            .eq('id', experience.id)
            .maybeSingle(),
          getTestAdminClient()
            .from('profiles')
            .select('average_rating, total_review_count')
            .eq('id', hostId)
            .maybeSingle(),
          getTestAdminClient()
            .from('notifications')
            .select('id')
            .eq('user_id', hostId)
            .eq('type', 'new_review')
            .eq('link', '/host/dashboard?tab=reviews'),
        ]);

        if (reviewsResult.error) throw reviewsResult.error;
        if (experienceResult.error) throw experienceResult.error;
        if (profileResult.error) throw profileResult.error;
        if (notificationsResult.error) throw notificationsResult.error;

        return {
          reviews: reviewsResult.data || [],
          experience: experienceResult.data,
          profile: profileResult.data,
          notificationIds: (notificationsResult.data || []).map((notification) => Number(notification.id)),
        };
      }, { timeout: 15000 })
      .toEqual({
        reviews: [{ id: expect.any(Number), rating: 5, content: reviewContent }],
        experience: { rating: 5, review_count: 1 },
        profile: { average_rating: 5, total_review_count: 1 },
        notificationIds: [expect.any(Number)],
      });

    const [reviewRowsResult, notificationRowsResult, adminAlertRowsResult] = await Promise.all([
      getTestAdminClient()
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId),
      getTestAdminClient()
        .from('notifications')
        .select('id')
        .eq('user_id', hostId)
        .eq('type', 'new_review')
        .eq('link', '/host/dashboard?tab=reviews'),
      getTestAdminClient()
        .from('notifications')
        .select('id')
        .eq('type', 'admin_alert')
        .eq('title', '새 후기가 등록되었습니다')
        .eq('message', `'${experience.title}' 체험에 새 후기가 작성되었습니다.`),
    ]);

    if (reviewRowsResult.error) throw reviewRowsResult.error;
    if (notificationRowsResult.error) throw notificationRowsResult.error;
    if (adminAlertRowsResult.error) throw adminAlertRowsResult.error;

    for (const row of reviewRowsResult.data || []) {
      createdReviewIds.push(Number(row.id));
    }
    for (const row of notificationRowsResult.data || []) {
      createdNotificationIds.push(Number(row.id));
    }
    for (const row of adminAlertRowsResult.data || []) {
      createdAdminAlertIds.push(Number(row.id));
    }
  });

  test('rejects mismatched experience, invalid content, and invalid rating on create', async ({ page }) => {
    test.setTimeout(90000);

    const { userId: hostId } = await createRegularUser('host.invalid');
    const { user: guest, userId: guestId } = await createRegularUser('guest.invalid');
    const experience = await createExperienceFixture(hostId, 'invalid-main');
    const foreignExperience = await createExperienceFixture(hostId, 'invalid-foreign');
    const bookingId = await createCompletedBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId: experience.id,
      suffix: 'invalid',
    });

    await login(page, guest);

    const mismatchResponse = await postReviewFromBrowser(page, {
      experienceId: foreignExperience.id,
      bookingId,
      rating: 5,
      content: `잘못된 체험 연결 검증 ${Date.now()}`,
    });
    expect(mismatchResponse.status).toBe(400);
    expect(mismatchResponse.body.error).toBe('예약 정보와 일치하지 않는 체험입니다.');

    const blankContentResponse = await postReviewFromBrowser(page, {
      experienceId: experience.id,
      bookingId,
      rating: 5,
      content: '          ',
    });
    expect(blankContentResponse.status).toBe(400);
    expect(blankContentResponse.body.error).toBe('후기는 10자 이상 작성해주세요.');

    const shortContentResponse = await postReviewFromBrowser(page, {
      experienceId: experience.id,
      bookingId,
      rating: 5,
      content: '짧아요',
    });
    expect(shortContentResponse.status).toBe(400);
    expect(shortContentResponse.body.error).toBe('후기는 10자 이상 작성해주세요.');

    for (const invalidRating of [0, 6, Number.NaN]) {
      const invalidRatingResponse = await postReviewFromBrowser(page, {
        experienceId: experience.id,
        bookingId,
        rating: invalidRating,
        content: `평점 범위 검증용 리뷰입니다 ${Date.now()}`,
      });
      expect(invalidRatingResponse.status).toBe(400);
      expect(invalidRatingResponse.body.error).toBe('평점은 1점부터 5점까지 입력해주세요.');
    }

    const { data: reviewRows, error: reviewError } = await getTestAdminClient()
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('user_id', guestId);

    if (reviewError) throw reviewError;
    expect(reviewRows || []).toHaveLength(0);
  });

  test('rejects out-of-range rating on patch without mutating the stored review', async ({ page }) => {
    test.setTimeout(90000);

    const { userId: hostId } = await createRegularUser('host.patch');
    const { user: guest, userId: guestId } = await createRegularUser('guest.patch');
    const experience = await createExperienceFixture(hostId, 'patch');
    const bookingId = await createCompletedBooking({
      guestId,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      experienceId: experience.id,
      suffix: 'patch',
    });
    const originalContent = `리뷰 수정 전 원본 내용 ${Date.now()}`;
    const reviewId = await createReviewFixture({
      guestId,
      experienceId: experience.id,
      bookingId,
      rating: 5,
      content: originalContent,
    });

    await login(page, guest);

    const patchResponse = await patchReviewFromBrowser(page, reviewId, {
      rating: 0,
      content: `변경 시도 내용 ${Date.now()}`,
    });

    expect(patchResponse.status).toBe(400);
    expect(patchResponse.body.error).toBe('평점은 1점부터 5점까지 입력해주세요.');

    const { data: reviewRow, error: reviewError } = await getTestAdminClient()
      .from('reviews')
      .select('rating, content')
      .eq('id', reviewId)
      .maybeSingle();

    if (reviewError) throw reviewError;
    expect(reviewRow).toMatchObject({
      rating: 5,
      content: originalContent,
    });
  });

  test('recalculates experience and host aggregates after admin review deletion', async ({ page }) => {
    test.setTimeout(90000);

    const { adminUser } = await createAdminUser('delete');
    const { userId: hostId } = await createRegularUser('host.delete');
    const { user: guestA, userId: guestAId } = await createRegularUser('guest.delete.a');
    const { user: guestB, userId: guestBId } = await createRegularUser('guest.delete.b');
    const experience = await createExperienceFixture(hostId, 'delete');
    const bookingIdA = await createCompletedBooking({
      guestId: guestAId,
      guestName: guestA.fullName,
      guestPhone: guestA.phone,
      experienceId: experience.id,
      suffix: 'delete-a',
    });
    const bookingIdB = await createCompletedBooking({
      guestId: guestBId,
      guestName: guestB.fullName,
      guestPhone: guestB.phone,
      experienceId: experience.id,
      suffix: 'delete-b',
    });

    const reviewIdA = await createReviewFixture({
      guestId: guestAId,
      experienceId: experience.id,
      bookingId: bookingIdA,
      rating: 5,
      content: `삭제 대상 리뷰입니다 ${Date.now()}`,
    });
    const reviewIdB = await createReviewFixture({
      guestId: guestBId,
      experienceId: experience.id,
      bookingId: bookingIdB,
      rating: 1,
      content: `삭제 후 남는 리뷰입니다 ${Date.now()}`,
    });

    const { error: experienceAggregateError } = await getTestAdminClient()
      .from('experiences')
      .update({ rating: 3, review_count: 2 })
      .eq('id', experience.id);

    if (experienceAggregateError) throw experienceAggregateError;
    await setProfileReviewAggregate(hostId, 3, 2);

    await login(page, adminUser);

    const deleteResponse = await page.request.delete(`/api/admin/reviews/${reviewIdA}`);
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({ success: true });

    await expect
      .poll(async () => {
        const [{ data: deletedReview, error: deletedReviewError }, { data: remainingReview, error: remainingReviewError }, { data: experienceRow, error: experienceError }, { data: profileRow, error: profileError }, { data: auditRows, error: auditError }] = await Promise.all([
          getTestAdminClient()
            .from('reviews')
            .select('id')
            .eq('id', reviewIdA)
            .maybeSingle(),
          getTestAdminClient()
            .from('reviews')
            .select('id, rating')
            .eq('id', reviewIdB)
            .maybeSingle(),
          getTestAdminClient()
            .from('experiences')
            .select('rating, review_count')
            .eq('id', experience.id)
            .maybeSingle(),
          getTestAdminClient()
            .from('profiles')
            .select('average_rating, total_review_count')
            .eq('id', hostId)
            .maybeSingle(),
          getTestAdminClient()
            .from('admin_audit_logs')
            .select('id, action_type, target_id')
            .eq('action_type', 'DELETE_REVIEW')
            .eq('target_id', String(reviewIdA))
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        if (deletedReviewError) throw deletedReviewError;
        if (remainingReviewError) throw remainingReviewError;
        if (experienceError) throw experienceError;
        if (profileError) throw profileError;
        if (auditError) throw auditError;

        return {
          deletedReviewId: deletedReview?.id ?? null,
          remainingReviewId: remainingReview?.id ?? null,
          remainingReviewRating: remainingReview?.rating ?? null,
          experienceRating: experienceRow?.rating ?? null,
          experienceReviewCount: experienceRow?.review_count ?? null,
          hostAverageRating: profileRow?.average_rating ?? null,
          hostReviewCount: profileRow?.total_review_count ?? null,
          auditRecorded: Boolean(auditRows?.[0]),
        };
      }, { timeout: 15000 })
      .toEqual({
        deletedReviewId: null,
        remainingReviewId: reviewIdB,
        remainingReviewRating: 1,
        experienceRating: 1,
        experienceReviewCount: 1,
        hostAverageRating: 1,
        hostReviewCount: 1,
        auditRecorded: true,
      });

    const { data: auditRows, error: auditError } = await getTestAdminClient()
      .from('admin_audit_logs')
      .select('id')
      .eq('action_type', 'DELETE_REVIEW')
      .eq('target_id', String(reviewIdA));

    if (auditError) throw auditError;
    for (const row of auditRows || []) {
      createdAuditLogIds.push(String(row.id));
    }
  });
});
