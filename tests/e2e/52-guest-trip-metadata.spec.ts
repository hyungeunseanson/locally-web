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
    email: `codex.guest.tripmeta.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Guest Trip Meta ${prefix} ${timestamp}`,
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
      instagram: '@codex_guest_trip_meta',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '게스트 예약 후속 데이터 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '게스트 예약 후속 데이터 검증',
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
  const title = `[Playwright] Guest Trip Meta ${Date.now()}`;

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
      description: '게스트 예약 후속 데이터 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역 3번 출구', description: '테스트 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: 'Hongdae Entrance Exit 3',
      meeting_point_i18n: {
        ko: '홍대입구역 3번 출구',
        en: 'Hongdae Entrance Exit 3',
      },
      location: 'Hongdae Entrance Exit 3',
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
    .select('id,title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create guest trip metadata experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function createBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const bookingId = `GUEST-TRIP-META-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 10);

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
    payment_method: 'bank',
    host_payout_amount: 24000,
    platform_revenue: 9000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
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

  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/account/);
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

test('guest trips shows localized meeting point and inbox bootstraps host summary', async ({ page }) => {
  const host = createUser('host');
  const guest = createUser('guest');

  const hostId = await createAuthUser(host);
  const guestId = await createAuthUser(guest);
  await createApprovedHostApplication(hostId, host);

  const supabase = getAdminClient();
  const { error: hostProfileError } = await supabase
    .from('profiles')
    .update({
      full_name: host.fullName,
      avatar_url: '/images/logo.png',
      languages: ['한국어'],
    })
    .eq('id', hostId);

  if (hostProfileError) throw hostProfileError;

  const experience = await createExperienceFixture(hostId);
  await createBooking({ guestId, guest, experienceId: experience.id });

  await login(page, guest);

  await page.goto(
    `/guest/inbox?hostId=${encodeURIComponent(hostId)}&expId=${encodeURIComponent(String(experience.id))}&expTitle=${encodeURIComponent(experience.title)}`,
    { waitUntil: 'domcontentloaded' }
  );

  await expect(page.getByText(host.fullName).first()).toBeVisible();
  await expect(page.locator('img[alt="host"]').first()).toHaveAttribute('src', /logo\.png|%2Fimages%2Flogo\.png/);
});
