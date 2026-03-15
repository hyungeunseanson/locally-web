import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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
    email: `codex.service.visibility.${role}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Visibility ${role} ${timestamp}`,
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

async function createHostApplication(userId: string, user: TestUser, status: 'approved' | 'pending') {
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
      source: 'E2E service visibility test',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: '서비스 가시성 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 가시성 테스트용 지원서입니다.',
      status,
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
  const title = `[Playwright] Service Visibility Experience ${city} ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country,
      city,
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '서비스 가시성 테스트용 체험입니다.',
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

async function createOpenServiceRequest(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 9);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Visibility ${timestamp}`,
      description: '서비스 가시성 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'JP',
      service_date: formatDate(serviceDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
    })
    .select('id, contact_name, contact_phone')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service request.');
  }

  createdServiceRequestIds.push(data.id);
  return data;
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function getJson(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  return {
    response,
    json: await response.json(),
  };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

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

test.describe.serial('Service request visibility gating', () => {
  test.setTimeout(90000);

  test('limits board/detail exposure to eligible approved hosts and hides contact info', async ({ browser }) => {
    const customerUser = createUser('customer');
    const matchingHostUser = createUser('matching-host');
    const otherHostUser = createUser('other-host');
    const pendingHostUser = createUser('pending-host');

    const customerId = await createAuthUser(customerUser);
    const matchingHostId = await createAuthUser(matchingHostUser);
    const otherHostId = await createAuthUser(otherHostUser);
    const pendingHostId = await createAuthUser(pendingHostUser);

    await createHostApplication(matchingHostId, matchingHostUser, 'approved');
    await createHostApplication(otherHostId, otherHostUser, 'approved');
    await createHostApplication(pendingHostId, pendingHostUser, 'pending');

    await createActiveExperience(matchingHostId, '서울', '대한민국');
    await createActiveExperience(otherHostId, '도쿄', 'Japan');

    const requestFixture = await createOpenServiceRequest(customerId, customerUser);

    const customerPage = await browser.newPage();
    await login(customerPage, customerUser);

    const matchingHostPage = await browser.newPage();
    await login(matchingHostPage, matchingHostUser);

    const otherHostPage = await browser.newPage();
    await login(otherHostPage, otherHostUser);

    const pendingHostPage = await browser.newPage();
    await login(pendingHostPage, pendingHostUser);

    const customerDetail = await getJson(customerPage.request, `/api/services/requests?requestId=${requestFixture.id}`);
    expect(customerDetail.response.status()).toBe(200);
    expect(customerDetail.json.data.contact_name).toBe(customerUser.fullName);
    expect(customerDetail.json.data.contact_phone).toBe(customerUser.phone);

    const matchingBoard = await getJson(matchingHostPage.request, '/api/services/requests?mode=board');
    expect(matchingBoard.response.status()).toBe(200);
    expect(Array.isArray(matchingBoard.json.data)).toBeTruthy();
    expect(matchingBoard.json.data.some((item: { id: string }) => item.id === requestFixture.id)).toBeTruthy();

    const matchingDetail = await getJson(matchingHostPage.request, `/api/services/requests?requestId=${requestFixture.id}`);
    expect(matchingDetail.response.status()).toBe(200);
    expect(matchingDetail.json.data.contact_name).toBeNull();
    expect(matchingDetail.json.data.contact_phone).toBeNull();

    const otherBoard = await getJson(otherHostPage.request, '/api/services/requests?mode=board');
    expect(otherBoard.response.status()).toBe(200);
    expect(otherBoard.json.data.some((item: { id: string }) => item.id === requestFixture.id)).toBeFalsy();

    const otherDetail = await getJson(otherHostPage.request, `/api/services/requests?requestId=${requestFixture.id}`);
    expect(otherDetail.response.status()).toBe(404);

    const pendingBoard = await getJson(pendingHostPage.request, '/api/services/requests?mode=board');
    expect(pendingBoard.response.status()).toBe(403);
  });
});
