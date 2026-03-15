import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdReviewIds: number[] = [];
const createdGuestReviewIds: number[] = [];

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

function getAdminClient() {
  if (adminClient) return adminClient;

  const env = loadEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.review.routes.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Review Route ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Profile was not created for auth user ${userId}.`);
}

async function createAuthUser(user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
    },
  });

  if (error || !data.user?.id) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  createdAuthUserIds.push(data.user.id);
  await waitForProfile(data.user.id);
  return data.user.id;
}

async function createApprovedHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1991-01-01',
      email: user.email,
      instagram: '@codex_host_reviews',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 리뷰 route 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '리뷰 route 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(String(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Host Review Routes ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 리뷰 route 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '리뷰 route 검증 코스입니다.' }],
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
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createBooking(params: {
  hostId: string;
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const bookingId = `HOST-REV-BOOKING-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 3);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
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

async function createReview(params: { guestId: string; experienceId: number; bookingId: string }) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      user_id: params.guestId,
      experience_id: params.experienceId,
      booking_id: params.bookingId,
      rating: 5,
      content: '호스트 답글 route 검증용 리뷰입니다.',
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

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const guestReviewId of createdGuestReviewIds) {
    await supabase.from('guest_reviews').delete().eq('id', guestReviewId);
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

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host review routes', () => {
  test('reject unauthenticated review write attempts', async ({ page }) => {
    const guestReviewResponse = await page.request.post('/api/host/guest-reviews', {
      data: { bookingId: 'missing', rating: 5, content: 'test' },
    });
    expect(guestReviewResponse.status()).toBe(401);

    const replyResponse = await page.request.post('/api/host/reviews/reply', {
      data: { reviewId: 1, reply: 'test' },
    });
    expect(replyResponse.status()).toBe(401);
  });

  test('forbid non-owner review writes', async ({ page }) => {
    test.setTimeout(90000);

    const owner = createUser('owner');
    const intruder = createUser('intruder');
    const guest = createUser('guest');

    const ownerId = await createAuthUser(owner);
    const intruderId = await createAuthUser(intruder);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(ownerId, owner);
    await createApprovedHostApplication(intruderId, intruder);

    const experienceId = await createExperienceFixture(ownerId);
    const bookingId = await createBooking({ hostId: ownerId, guestId, guest, experienceId });
    const reviewId = await createReview({ guestId, experienceId, bookingId });

    await login(page, intruder);

    const guestReviewResponse = await page.request.post('/api/host/guest-reviews', {
      data: { bookingId, rating: 5, content: '권한 없는 후기' },
    });
    expect(guestReviewResponse.status()).toBe(403);

    const replyResponse = await page.request.post('/api/host/reviews/reply', {
      data: { reviewId, reply: '권한 없는 답글' },
    });
    expect(replyResponse.status()).toBe(403);
  });

  test('allow owner guest review creation and review reply writes', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host');
    const guest = createUser('guest-owner');
    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const experienceId = await createExperienceFixture(hostId);
    const bookingId = await createBooking({ hostId, guestId, guest, experienceId });
    const reviewId = await createReview({ guestId, experienceId, bookingId });

    await login(page, host);

    const guestReviewResponse = await page.request.post('/api/host/guest-reviews', {
      data: { bookingId, rating: 4, content: '호스트가 남긴 게스트 후기입니다.' },
    });
    expect(guestReviewResponse.status()).toBe(200);
    await expect(guestReviewResponse.json()).resolves.toMatchObject({ success: true, guestId });

    const supabase = getAdminClient();
    const { data: guestReview, error: guestReviewError } = await supabase
      .from('guest_reviews')
      .select('id, booking_id, host_id, guest_id, rating, content')
      .eq('booking_id', bookingId)
      .eq('host_id', hostId)
      .maybeSingle();

    if (guestReviewError) throw guestReviewError;
    expect(guestReview).toMatchObject({
      booking_id: bookingId,
      host_id: hostId,
      guest_id: guestId,
      rating: 4,
      content: '호스트가 남긴 게스트 후기입니다.',
    });
    if (guestReview?.id) createdGuestReviewIds.push(Number(guestReview.id));

    const duplicateGuestReviewResponse = await page.request.post('/api/host/guest-reviews', {
      data: { bookingId, rating: 4, content: '중복 후기' },
    });
    expect(duplicateGuestReviewResponse.status()).toBe(409);

    const replyResponse = await page.request.post('/api/host/reviews/reply', {
      data: { reviewId, reply: '호스트 답글 route 검증용 답글입니다.' },
    });
    expect(replyResponse.status()).toBe(200);
    await expect(replyResponse.json()).resolves.toMatchObject({ success: true, recipientId: guestId });

    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('reply')
      .eq('id', reviewId)
      .maybeSingle();

    if (reviewError) throw reviewError;
    expect(review).toMatchObject({
      reply: '호스트 답글 route 검증용 답글입니다.',
    });
  });
});
