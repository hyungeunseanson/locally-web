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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.schedule.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Schedule ${prefix} ${timestamp}`,
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

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Host Schedule ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 일정 저장 route 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '일정 저장 검증 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 50000,
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
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function seedAvailability(experienceId: number, date: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('experience_availability').insert([
    { experience_id: experienceId, date, start_time: '10:00', is_booked: false },
    { experience_id: experienceId, date, start_time: '11:00', is_booked: false },
  ]);

  if (error) throw error;
}

async function seedConfirmedBooking(params: {
  customerId: string;
  customer: TestUser;
  experienceId: number;
  date: string;
}) {
  const supabase = getAdminClient();
  const bookingId = `HOST-SCHED-BOOKING-${Date.now()}`;
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.customerId,
    experience_id: params.experienceId,
    amount: 55000,
    total_price: 50000,
    status: 'confirmed',
    guests: 1,
    date: params.date,
    time: '10:00',
    type: 'group',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    message: '',
    payment_method: 'bank',
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

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host schedule availability save route', () => {
  test('rejects unauthenticated and non-owner availability save attempts', async ({ page }) => {
    test.setTimeout(90000);

    const hostUser = createUser('owner');
    const intruderUser = createUser('intruder');

    const [hostId] = await Promise.all([
      createAuthUser(hostUser),
      createAuthUser(intruderUser),
    ]);

    const experienceId = await createExperienceFixture(hostId);
    const experienceDate = formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    await seedAvailability(experienceId, experienceDate);

    const unauthenticatedResponse = await page.request.post(`/api/host/experiences/${experienceId}/availability`, {
      data: { availability: { [experienceDate]: ['12:00'] } },
    });
    expect(unauthenticatedResponse.status()).toBe(401);

    await login(page, intruderUser);
    const forbiddenResponse = await page.request.post(`/api/host/experiences/${experienceId}/availability`, {
      data: { availability: { [experienceDate]: ['12:00'] } },
    });
    expect(forbiddenResponse.status()).toBe(403);
  });

  test('preserves booked slots while applying allowed schedule changes for the owner', async ({ page }) => {
    test.setTimeout(90000);

    const hostUser = createUser('owner-save');
    const customerUser = createUser('customer');

    const [hostId, customerId] = await Promise.all([
      createAuthUser(hostUser),
      createAuthUser(customerUser),
    ]);

    const experienceId = await createExperienceFixture(hostId);
    const experienceDate = formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    await seedAvailability(experienceId, experienceDate);
    await seedConfirmedBooking({
      customerId,
      customer: customerUser,
      experienceId,
      date: experienceDate,
    });

    await login(page, hostUser);

    const saveResponse = await page.request.post(`/api/host/experiences/${experienceId}/availability`, {
      data: { availability: { [experienceDate]: ['12:00'] } },
    });
    expect(saveResponse.status()).toBe(200);
    await expect(saveResponse.json()).resolves.toMatchObject({
      success: true,
      insertedCount: 1,
      deletedCount: 1,
      skippedBookedDeletions: [{ date: experienceDate, time: '10:00' }],
    });

    const supabase = getAdminClient();
    const { data: slots, error: slotError } = await supabase
      .from('experience_availability')
      .select('date, start_time')
      .eq('experience_id', experienceId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (slotError) throw slotError;

    expect(slots).toEqual([
      { date: experienceDate, start_time: '10:00' },
      { date: experienceDate, start_time: '12:00' },
    ]);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('status, date, time')
      .eq('experience_id', experienceId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(booking).toMatchObject({
      status: 'confirmed',
      date: experienceDate,
      time: '10:00',
    });
  });
});
