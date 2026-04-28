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
type ActiveExperienceOptions = {
  description?: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const LONG_SUMMARY_DESCRIPTION = [
  '홍대 골목에서 시작해 작은 로컬 카페와 숨은 식당을 천천히 둘러보는 체험입니다.',
  '처음 방문하는 분도 길을 헤매지 않도록 만나는 장소부터 이동 동선까지 차분하게 안내합니다.',
  '취향에 맞는 메뉴를 고르고 동네 이야기를 나누며 서울의 일상적인 분위기를 가까이 느낄 수 있습니다.',
  '사진을 찍기 좋은 골목, 조용히 쉬어갈 수 있는 공간, 현지인이 자주 가는 가게를 함께 연결합니다.',
  'SUMMARY_EXPANSION_SENTINEL 마지막 문장까지 상단 소개글 안에서 보여야 합니다.',
].join('\n');

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

function createUser(prefix: string, fullName?: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.experience.review.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: fullName || `Experience Review ${prefix} ${timestamp}`,
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
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function createHostApplication(userId: string, user: TestUser) {
  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1991-03-14',
      email: user.email,
      instagram: '@codex_experience_review',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '체험 상세 후기 렌더링 검증용 공개 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '체험 상세 후기 렌더링 검증',
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create public host application.');
  }

  createdApplicationIds.push(String(data.id));
}

async function createActiveExperience(hostId: string, options: ActiveExperienceOptions = {}) {
  const title = `[Playwright] Experience Review ${Date.now()}`;
  const description = options.description || '체험 상세 후기 렌더링 검증용 체험입니다.';
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
      description,
      itinerary: [{ title: '홍대입구역', description: '체험 상세 후기 렌더링 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['/images/logo.png'],
      price: 49000,
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
    description,
  };
}

async function getSummaryMetrics(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      height: element.getBoundingClientRect().height,
      lineClamp: style.getPropertyValue('-webkit-line-clamp'),
      scrollHeight: element.scrollHeight,
    };
  });
}

async function expectSummaryReadMoreExpandsInPlace(params: {
  page: Page;
  experienceId: number;
  title: string;
  viewport: { width: number; height: number };
  descriptionTestId: string;
  readMoreTestId: string;
  expectedCollapsedClamp: string;
}) {
  const {
    page,
    experienceId,
    title,
    viewport,
    descriptionTestId,
    readMoreTestId,
    expectedCollapsedClamp,
  } = params;

  await page.setViewportSize(viewport);
  await page.goto(`/experiences/${experienceId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 15000 });

  const description = page.getByTestId(descriptionTestId);
  const readMore = page.getByTestId(readMoreTestId);
  await expect(description).toBeVisible();
  await expect(readMore).toBeVisible();
  await expect(description).toContainText('SUMMARY_EXPANSION_SENTINEL');

  const before = await getSummaryMetrics(page, descriptionTestId);
  expect(before.lineClamp).toBe(expectedCollapsedClamp);
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

  const beforeScrollY = await page.evaluate(() => window.scrollY);
  await readMore.click();

  await expect(readMore).toHaveCount(0);
  const after = await getSummaryMetrics(page, descriptionTestId);
  const afterScrollY = await page.evaluate(() => window.scrollY);

  expect(after.lineClamp === 'none' || after.lineClamp === '').toBe(true);
  expect(after.height).toBeGreaterThan(before.height + 20);
  expect(after.scrollHeight - after.clientHeight).toBeLessThanOrEqual(2);
  expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThanOrEqual(2);
}

async function createCompletedBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const bookingId = `EXP-DETAIL-REVIEW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
}) {
  const { data, error } = await getAdminClient()
    .from('reviews')
    .insert({
      user_id: params.guestId,
      experience_id: params.experienceId,
      booking_id: params.bookingId,
      rating: 5,
      content: params.content,
      photos: ['/images/logo.png'],
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

test.describe.serial('Experience detail public reviews', () => {
  test('expands the summary read more in place on desktop and mobile', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('summary.host');
    const hostId = await createAuthUser(host);
    await createHostApplication(hostId, host);
    const experience = await createActiveExperience(hostId, {
      description: LONG_SUMMARY_DESCRIPTION,
    });

    await expectSummaryReadMoreExpandsInPlace({
      page,
      experienceId: experience.experienceId,
      title: experience.title,
      viewport: { width: 1440, height: 960 },
      descriptionTestId: 'experience-summary-description-desktop',
      readMoreTestId: 'experience-summary-read-more-desktop',
      expectedCollapsedClamp: '3',
    });

    await expectSummaryReadMoreExpandsInPlace({
      page,
      experienceId: experience.experienceId,
      title: experience.title,
      viewport: { width: 390, height: 844 },
      descriptionTestId: 'experience-summary-description-mobile',
      readMoreTestId: 'experience-summary-read-more-mobile',
      expectedCollapsedClamp: '2',
    });
  });

  test('renders masked reviewer identity without exposing review photos on detail and modal', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host');
    const hostId = await createAuthUser(host);
    await createHostApplication(hostId, host);
    const experience = await createActiveExperience(hostId);

    const guest = createUser('guest', '김성호');
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
    const reviewContent = `체험 상세 후기 본문 ${Date.now()}`;
    await createReview({
      guestId,
      experienceId: experience.experienceId,
      bookingId,
      content: reviewContent,
    });

    await expect
      .poll(
        async () => (await page.request.get(`/api/public/experiences/${experience.experienceId}/reviews?lang=ko`)).status(),
        { timeout: 15000 }
      )
      .toBe(200);
    const apiResponse = await page.request.get(`/api/public/experiences/${experience.experienceId}/reviews?lang=ko`);
    expect(apiResponse.status()).toBe(200);
    const apiPayload = await apiResponse.json();
    expect(apiPayload.success).toBe(true);
    expect(apiPayload.summary).toMatchObject({
      average_rating: 5,
      review_count: 1,
    });
    expect(apiPayload.data[0]).toMatchObject({
      content: reviewContent,
      reviewer: {
        display_name: '김성*',
        avatar_url: '/images/logo.png',
      },
    });
    expect(Object.prototype.hasOwnProperty.call(apiPayload.data[0], 'user_id')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(apiPayload.data[0], 'photos')).toBe(false);

    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: experience.title, exact: true })).toBeVisible({ timeout: 15000 });
    const reviewsSection = page.getByTestId('experience-public-reviews-section');
    await expect(reviewsSection).toBeVisible();
    await expect(reviewsSection.locator('[data-testid="public-review-preview-grid"]:visible').first()).toBeVisible();
    await expect(reviewsSection.getByTestId('public-review-cta')).toBeVisible();
    await expect(reviewsSection.locator('[data-testid="public-reviewer-name"]:visible').first()).toHaveText('김성*');
    await expect(reviewsSection.locator('[data-testid="public-reviewer-avatar"]:visible').first()).toBeVisible();
    await expect(reviewsSection.locator('[data-testid="public-review-photo"]')).toHaveCount(0);
    await expect(reviewsSection.locator('p:visible').filter({ hasText: reviewContent }).first()).toBeVisible();
    await expect(reviewsSection.getByRole('button', { name: /더보기|more|もっと|更多/i })).toHaveCount(0);

    const headerFontSize = await reviewsSection.locator('h3').evaluate((element) => getComputedStyle(element).fontSize);
    expect(parseFloat(headerFontSize)).toBeLessThanOrEqual(22);

    const previewAvatarWidth = await reviewsSection
      .locator('[data-testid="public-reviewer-avatar"]:visible')
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().width));
    expect(previewAvatarWidth).toBeLessThanOrEqual(32);

    await reviewsSection
      .getByRole('button', { name: /모든 후기 보기|Show all reviews|すべてのレビューを見る|查看全部评价/ })
      .click();

    const reviewModal = page.getByTestId('public-review-modal');
    await expect(reviewModal).toBeVisible();
    await expect(reviewModal.locator('[data-testid="public-reviewer-name"]:visible').first()).toHaveText('김성*');
    await expect(reviewModal.locator('[data-testid="public-reviewer-avatar"]:visible').first()).toBeVisible();
    await expect(reviewModal.locator('[data-testid="public-review-photo"]')).toHaveCount(0);
    await expect(reviewModal.locator('p:visible').filter({ hasText: reviewContent }).first()).toBeVisible();

    const modalBodyFontSize = await reviewModal
      .locator('p:visible')
      .filter({ hasText: reviewContent })
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize);
    expect(parseFloat(modalBodyFontSize)).toBeGreaterThanOrEqual(13);
  });

  test('returns 404 for public experience review feeds when the host is not public', async ({ page }) => {
    test.setTimeout(90000);

    const privateHost = createUser('private.host');
    const privateHostId = await createAuthUser(privateHost);
    const experience = await createActiveExperience(privateHostId);

    const response = await page.request.get(`/api/public/experiences/${experience.experienceId}/reviews?lang=ko`);
    expect(response.status()).toBe(404);
  });
});
