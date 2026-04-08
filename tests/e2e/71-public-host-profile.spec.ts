import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

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

function createHostUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.public.host.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Public Host ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createGuestUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.public.host.guest.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Public Guest ${timestamp}`,
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

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      bio: '공개 호스트 프로필 검증용 소개입니다.',
      introduction: 'public_host_applications 경유 프로필 노출 확인',
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function createHostApplication(
  userId: string,
  user: TestUser,
  status: 'approved' | 'active' = 'approved'
) {
  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어', 'English'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
      ],
      name: user.fullName,
      phone: user.phone,
      dob: '1991-03-14',
      email: user.email,
      instagram: '@codex_public_host',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '공개 호스트 프로필 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '공개 프로필 검증',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error(`Failed to create ${status} host application.`);
  }

  createdApplicationIds.push(String(data.id));
}

async function createActiveExperience(hostId: string) {
  const title = `[Playwright] Public Host Profile ${Date.now()}`;
  const { data, error } = await getAdminClient()
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
      description: '공개 호스트 프로필 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '공개 프로필 동선 검증' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 49000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
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
    experienceId: Number(data.id),
    title: String(data.title),
  };
}

async function createCompletedBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const bookingId = `PUBLIC-HOST-BOOKING-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 3);

  const { error } = await getAdminClient().from('bookings').insert({
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

async function createReview(params: {
  guestId: string;
  experienceId: number;
  bookingId: string;
  content: string;
  reply: string;
  photos?: string[];
}) {
  const { data, error } = await getAdminClient()
    .from('reviews')
    .insert({
      user_id: params.guestId,
      experience_id: params.experienceId,
      booking_id: params.bookingId,
      rating: 5,
      content: params.content,
      reply: params.reply,
      reply_at: new Date().toISOString(),
      photos: params.photos || [],
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create review fixture.');
  }

  createdReviewIds.push(Number(data.id));
}

test.afterAll(async () => {
  const supabase = getAdminClient();

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

test.describe.serial('Public host profile', () => {
  test('does not expose public review feeds for non-public users', async ({ page }) => {
    test.setTimeout(90000);

    const privateUser = createGuestUser();
    const privateUserId = await createAuthUser(privateUser);

    const response = await page.request.get(`/api/public/hosts/${privateUserId}/reviews`);
    expect(response.status()).toBe(404);
  });

  test('renders approved host profile and active experiences through the public projection path', async ({ page }) => {
    test.setTimeout(90000);

    const host = createHostUser();
    const hostId = await createAuthUser(host);
    await createHostApplication(hostId, host, 'approved');
    const experience = await createActiveExperience(hostId);
    const guest = createGuestUser();
    const guestId = await createAuthUser(guest);
    const supabase = getAdminClient();
    const { error: guestProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: '김성호',
        avatar_url: '/images/logo.png',
      })
      .eq('id', guestId);

    if (guestProfileError) throw guestProfileError;
    const bookingId = await createCompletedBooking({
      guestId,
      guest,
      experienceId: experience.experienceId,
    });
    const reviewContent = `공개 호스트 프로필 리뷰 본문 ${Date.now()}`;
    const replyContent = `공개 호스트 프로필 답글 ${Date.now()}`;
    await createReview({
      guestId,
      experienceId: experience.experienceId,
      bookingId,
      content: reviewContent,
      reply: replyContent,
      photos: ['/images/logo.png'],
    });

    const apiResponse = await page.request.get(`/api/public/hosts/${hostId}/reviews?lang=ko`);
    expect(apiResponse.status()).toBe(200);
    const apiPayload = await apiResponse.json();
    expect(apiPayload.success).toBe(true);
    expect(Array.isArray(apiPayload.data)).toBe(true);
    expect(apiPayload.data[0]).toMatchObject({
      rating: 5,
      content: reviewContent,
      reviewer: {
        display_name: '김성*',
        avatar_url: '/images/logo.png',
      },
    });
    expect(Object.prototype.hasOwnProperty.call(apiPayload.data[0], 'user_id')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(apiPayload.data[0], 'photos')).toBe(false);

    await page.goto(`/users/${hostId}`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: host.fullName, exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('공개 호스트 프로필 검증용 승인 호스트입니다.')).toBeVisible();
    await expect(page.getByTestId('public-host-experiences-section')).toBeVisible();
    await expect(page.getByTestId('public-host-reviews-section')).toBeVisible();
    await expect(page.getByTestId('public-host-languages')).toBeVisible();
    await expect(page.getByTestId('public-host-languages').getByText('English')).toBeVisible();
    await expect(page.getByText(experience.title)).toBeVisible();
    await expect(page.getByTestId('public-host-reviews-section').locator('[data-testid="public-reviewer-name"]:visible').first()).toHaveText('김성*');
    await expect(page.getByTestId('public-host-reviews-section').locator('[data-testid="public-reviewer-avatar"]:visible').first()).toBeVisible();
    await expect(page.getByTestId('public-host-reviews-section').locator('[data-testid="public-review-photo"]')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="public-host-reviews-section"] p:visible').filter({ hasText: reviewContent }).first()
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="public-host-reviews-section"] p:visible').filter({ hasText: replyContent }).first()
    ).toBeVisible();

    await page
      .getByTestId('public-host-reviews-section')
      .getByRole('button', { name: /모든 후기 보기|Show all reviews|すべてのレビューを見る|查看全部评价/ })
      .click();
    await expect(page.getByTestId('public-review-modal')).toBeVisible();
    await expect(page.getByTestId('public-review-modal').locator('[data-testid="public-reviewer-name"]:visible').first()).toHaveText('김성*');
    await expect(page.getByTestId('public-review-modal').locator('[data-testid="public-reviewer-avatar"]:visible').first()).toBeVisible();
    await expect(page.getByTestId('public-review-modal').locator('[data-testid="public-review-photo"]')).toHaveCount(0);
  });

  test('renders active host profiles through the same public projection path', async ({ page }) => {
    test.setTimeout(90000);

    const host = createHostUser();
    const hostId = await createAuthUser(host);
    await createHostApplication(hostId, host, 'active');
    const experience = await createActiveExperience(hostId);

    await page.goto(`/users/${hostId}`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: host.fullName, exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('public-host-experiences-section')).toBeVisible();
    await expect(page.getByTestId('public-host-languages')).toBeVisible();
    await expect(page.getByTestId('public-host-languages').getByText('English')).toBeVisible();
    await expect(page.getByText(experience.title)).toBeVisible();
  });
});
