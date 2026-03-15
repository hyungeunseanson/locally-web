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
const createdHostApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceBookingIds: string[] = [];

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

function createUser(role: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.contract.${role}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Contract ${role} ${timestamp}`,
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
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: `@${user.fullName.replace(/\s+/g, '').toLowerCase()}`,
      source: 'E2E service contract test',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: '서비스 계약 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 계약 테스트용 지원서입니다.',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createActiveExperience(hostId: string, city: string, country: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country,
      city,
      title: `[Playwright] Service Contract Experience ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '서비스 계약 테스트용 체험입니다.',
      itinerary: [{ title: `${city} 테스트 동선`, description: '테스트 동선입니다.' }],
      spots: `${city}역`,
      meeting_point: `${city}역 1번 출구`,
      location: `${city} 테스트 위치`,
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
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
    throw error || new Error('Failed to create active experience.');
  }

  createdExperienceIds.push(data.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  for (const experienceId of createdExperienceIds) {
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

test.describe.serial('Service request contract alignment', () => {
  test('stores resolved Korea country when customer creates a Seoul request without explicit country', async ({ page }) => {
    const customerUser = createUser('customer');
    const customerId = await createAuthUser(customerUser);

    await login(page, customerUser);

    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() + 7);

    const response = await page.request.post('/api/services/requests', {
      data: {
        title: '서비스 국가 매핑 테스트',
        description: '서울 지역 맞춤 의뢰 국가 매핑 테스트입니다.',
        city: '서울',
        service_date: formatDate(serviceDate),
        start_time: '10:00',
        duration_hours: 5,
        guest_count: 2,
        languages: ['한국어'],
        contact_name: customerUser.fullName,
        contact_phone: customerUser.phone,
      },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBeTruthy();
    expect(typeof json.requestId).toBe('string');
    createdServiceRequestIds.push(json.requestId);

    const supabase = getAdminClient();
    const { data: requestRow, error } = await supabase
      .from('service_requests')
      .select('country, user_id')
      .eq('id', json.requestId)
      .maybeSingle();

    if (error) throw error;

    expect(requestRow?.country).toBe('Korea');
    expect(requestRow?.user_id).toBe(customerId);

    const { data: bookingRow, error: bookingError } = await supabase
      .from('service_bookings')
      .select('id')
      .eq('request_id', json.requestId)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (bookingRow?.id) {
      createdServiceBookingIds.push(bookingRow.id);
    }
  });

  test('cleans up the pending service request when booking pre-create fails', async ({ page }) => {
    const customerUser = createUser('cleanup-customer');
    const customerId = await createAuthUser(customerUser);

    await login(page, customerUser);

    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() + 7);
    const title = `서비스 생성 cleanup 테스트 ${Date.now()}`;

    const response = await page.request.post('/api/services/requests', {
      headers: {
        'x-locally-test-force-booking-create-fail': '1',
      },
      data: {
        title,
        description: 'booking pre-create 실패 cleanup 검증용 의뢰입니다.',
        city: '서울',
        service_date: formatDate(serviceDate),
        start_time: '10:00',
        duration_hours: 5,
        guest_count: 2,
        languages: ['한국어'],
        contact_name: customerUser.fullName,
        contact_phone: customerUser.phone,
      },
    });

    expect(response.status()).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });

    const supabase = getAdminClient();
    const { data: requestRows, error: requestError } = await supabase
      .from('service_requests')
      .select('id, status')
      .eq('user_id', customerId)
      .eq('title', title);

    if (requestError) throw requestError;
    expect(requestRows ?? []).toHaveLength(0);

    const { data: bookingRows, error: bookingError } = await supabase
      .from('service_bookings')
      .select('id')
      .eq('customer_id', customerId)
      .eq('contact_name', customerUser.fullName)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (bookingError) throw bookingError;
    expect((bookingRows ?? []).length).toBe(0);
  });

  test('shows persisted total_host_payout on the apply page instead of a hardcoded hourly fallback', async ({ page }) => {
    const hostUser = createUser('host');
    const customerUser = createUser('request-owner');
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);

    await createHostApplication(hostId, hostUser);
    await createActiveExperience(hostId, '서울', '대한민국');

    const supabase = getAdminClient();
    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() + 8);

    const { data: requestRow, error } = await supabase
      .from('service_requests')
      .insert({
        user_id: customerId,
        title: `[Playwright] Service Apply Payout ${Date.now()}`,
        description: '서비스 지원 페이지 예상 정산금 테스트용 의뢰입니다.',
        city: '서울',
        country: 'Korea',
        service_date: formatDate(serviceDate),
        start_time: '13:00',
        duration_hours: 5,
        hourly_rate_customer: 35000,
        hourly_rate_host: 23000,
        languages: ['한국어'],
        guest_count: 2,
        contact_name: customerUser.fullName,
        contact_phone: customerUser.phone,
        status: 'open',
      })
      .select('id, total_host_payout')
      .single();

    if (error || !requestRow?.id) {
      throw error || new Error('Failed to create service request for apply payout test.');
    }

    createdServiceRequestIds.push(requestRow.id);

    await login(page, hostUser);
    await page.goto(`/services/${requestRow.id}/apply`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(`₩${Number(requestRow.total_host_payout).toLocaleString()}`)).toBeVisible();
  });
});
