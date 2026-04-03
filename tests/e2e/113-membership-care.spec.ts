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
const createdApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];

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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.membership.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Membership ${prefix} ${timestamp}`,
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

async function seedGuestProfile(userId: string) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      nationality: 'KR',
      bio: '멤버십 프로필 소개',
      languages: ['Korean'],
      job: '디자이너',
    })
    .eq('id', userId);

  if (error) throw error;
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
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_membership',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '관계형 멤버십 테스트용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '멤버십 테스트',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Membership ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '카페/디저트',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '멤버십 경험 검증용 체험입니다.',
      itinerary: [{ title: '서울역 1번 출구', description: '테스트 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      meeting_point_i18n: {
        ko: '서울역 1번 출구',
        en: 'Seoul Station Exit 1',
      },
      location: '서울역 1번 출구',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
      is_active: true,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create membership experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createPaidBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
  offsetDays: number;
}) {
  const supabase = getAdminClient();
  const bookingId = `MEMBERSHIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + params.offsetDays);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: 'PAID',
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: new Date().toISOString(),
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

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  const results = await Promise.allSettled([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.getByText('Welcome back. You are now logged in.').waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(`Login did not complete for ${user.email}`);
  }
}

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdBookingIds.length > 0) {
    await supabase.from('bookings').delete().in('id', createdBookingIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('locally membership care experience', () => {
  test('first purchase customer sees Tier 1 across key guest pages', async ({ page }) => {
    test.slow();
    const host = createUser('host.member');
    const guest = createUser('guest.member');

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await seedGuestProfile(guestId);
    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);
    const bookingId = await createPaidBooking({
      guestId,
      guest,
      experienceId,
      offsetDays: 7,
    });

    await login(page, guest);

    await page.goto(`/experiences/${experienceId}/payment/complete?orderId=${bookingId}`, { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByText('이제 Tier 1입니다')).toBeVisible();

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByTestId('account-membership-card')).toHaveCount(0);
    await expect(page.getByTestId('account-profile-membership-badge-trigger')).toContainText('Tier 1', { timeout: 15000 });
    await page.getByTestId('account-profile-membership-badge-trigger').dispatchEvent('click');
    await expect(page.getByTestId('account-profile-membership-badge-panel')).toContainText('Tier 1');
    await expect(page.getByTestId('account-profile-membership-badge-panel')).toContainText('Tier 2');
    await expect(page.getByTestId('account-profile-membership-badge-panel')).toContainText('로컬리와 연결이 시작된 게스트예요.');
    await expect(page.getByTestId('account-profile-membership-badge-panel')).toContainText('다시 찾아온 게스트에게 열리는 단계예요.');
    await expect(page.locator('p').filter({ hasText: '대한민국 (South Korea)' }).first()).toBeVisible();
    await expect(page.getByText('"멤버십 프로필 소개"')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByTestId('account-membership-card')).toHaveCount(0);
    await expect(page.getByTestId('account-mobile-membership-badge-trigger')).toContainText('Tier 1');
    await page.getByTestId('account-mobile-membership-badge-trigger').dispatchEvent('click');
    await expect(page.getByTestId('account-mobile-membership-badge-panel')).toContainText('Tier 1');
    await expect(page.getByTestId('account-mobile-membership-badge-panel')).toContainText('Tier 2');
    await expect(page.getByTestId('account-mobile-membership-badge-panel')).toContainText('로컬리와 연결이 시작된 게스트예요.');
    await page.getByTestId('account-mobile-profile-card').dispatchEvent('click');
    await expect(page.getByTestId('mobile-profile-membership-badge-trigger')).toContainText('Tier 1');
    await page.getByTestId('mobile-profile-membership-badge-trigger').dispatchEvent('click');
    await expect(page.getByTestId('mobile-profile-membership-badge-panel')).toContainText('Tier 1');
    await expect(page.getByTestId('mobile-profile-membership-badge-panel')).toContainText('Tier 2');

    await page.goto('/guest/trips', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByTestId('guest-trips-membership-banner')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Locally Care로 문의하기' })).toHaveCount(0);
    await expect(page.getByTestId('guest-trips-membership-info-trigger')).toHaveCount(0);
    await expect(page.getByTestId('guest-trips-membership-badge-trigger')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '메시지함 보기' })).toHaveCount(0);

    await page.goto('/help', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByTestId('help-member-care-strip')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Locally Care로 문의하기' })).toBeVisible();

    await page.goto('/guest/inbox', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByTestId('guest-inbox-member-care-strip')).toHaveCount(0);
  });

  test('repeat customer sees Tier 2 in account and service completion', async ({ page }) => {
    test.slow();
    const host = createUser('host.circle');
    const guest = createUser('guest.circle');

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);
    const experienceId = await createExperienceFixture(hostId);
    await createPaidBooking({ guestId, guest, experienceId, offsetDays: 5 });
    await createPaidBooking({ guestId, guest, experienceId, offsetDays: 12 });

    await login(page, guest);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByTestId('account-membership-card')).toHaveCount(0);
    await expect(page.getByTestId('account-profile-membership-badge-trigger')).toContainText('Tier 2', { timeout: 15000 });

    await page.goto('/services/demo-request/payment/complete?orderId=MEMBERSHIP-CIRCLE', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByText('다시 오셨네요, 이제 Tier 2입니다')).toBeVisible();
  });
});
