import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

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
const createdServiceApplicationIds: string[] = [];

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
    email: `codex.service.guidance.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Guidance ${prefix} ${timestamp}`,
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
      email: user.email,
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
      host_nationality: 'Korea',
      languages: ['한국어', '日本語'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: '日本語', level: 4 },
      ],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: `@${user.fullName.replace(/\s+/g, '').toLowerCase()}`,
      source: 'E2E service host flow guidance test',
      language_cert: 'JLPT N1',
      profile_photo: null,
      self_intro: '서비스 호스트 지원 흐름 안내 테스트용 프로필입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 지원 흐름 안내 테스트용 지원서입니다.',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createActiveExperience(hostId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: 'Korea',
      city: '서울',
      title: `[Playwright] Service Guidance Experience ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어', '日本語'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: '日本語', level: 4 },
      ],
      duration: 2,
      max_guests: 4,
      description: '서비스 지원 흐름 안내 테스트용 체험입니다.',
      itinerary: [{ title: '테스트 동선', description: '테스트 동선 설명입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울 테스트 위치',
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

async function createOpenRequest(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 10);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Host Guidance ${Date.now()}`,
      description: '서비스 호스트 지원 흐름 안내 테스트용 의뢰입니다.',
      city: '서울',
      country: 'Korea',
      service_date: formatDate(serviceDate),
      start_time: '11:00',
      duration_hours: 4,
      languages: ['한국어', '日本語'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service request.');
  }

  createdServiceRequestIds.push(data.id);
  return data;
}

async function createApplication(requestId: string, hostId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestId,
      host_id: hostId,
      appeal_message: '서울 지역 병원·쇼핑 동행 경험이 많고 한국어와 일본어로 바로 응답 가능합니다.',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service application.');
  }

  createdServiceApplicationIds.push(data.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

async function createLoggedInPage(browser: Browser, user: TestUser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const applicationId of createdServiceApplicationIds) {
    await supabase.from('service_applications').delete().eq('id', applicationId);
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

test.describe.serial('service host flow guidance', () => {
  test('redirects legacy /services entry to the host dashboard open tab and keeps owner detail guidance', async ({ browser }) => {
    const customerUser = createUser('customer');
    const hostUser = createUser('host');
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser);

    await createApprovedHostApplication(hostId, hostUser);
    await createActiveExperience(hostId);
    const request = await createOpenRequest(customerId, customerUser);
    await createApplication(request.id, hostId);

    const hostSession = await createLoggedInPage(browser, hostUser);
    await hostSession.page.goto('/services', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(hostSession.page);
    await hostSession.page.waitForURL(/\/host\/dashboard\?tab=service-jobs&serviceTab=open/, { timeout: 15000 });
    await expect(hostSession.page.getByTestId('service-jobs-open-tab')).toHaveAttribute('aria-pressed', 'true');
    await expect(hostSession.page.getByTestId('service-jobs-applications-tab')).toHaveAttribute('aria-pressed', 'false');
    await expect(hostSession.page.getByText(request.title)).toBeVisible();
    await hostSession.context.close();

    const customerSession = await createLoggedInPage(browser, customerUser);
    await customerSession.page.goto(`/services/${request.id}`, { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(customerSession.page);
    const applicationsResponse = await customerSession.page.request.get(`/api/services/applications?requestId=${request.id}`);
    expect(applicationsResponse.ok()).toBeTruthy();
    const applicationsPayload = await applicationsResponse.json();
    expect(applicationsPayload).toMatchObject({
      success: true,
      isOwner: true,
    });
    expect(applicationsPayload.data?.[0]?.host_applications).toMatchObject({
      name: hostUser.fullName,
      self_intro: '서비스 호스트 지원 흐름 안내 테스트용 프로필입니다.',
      host_nationality: 'Korea',
    });
    expect(applicationsPayload.data?.[0]?.host_applications?.language_levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          language: '日本語',
          level: 4,
        }),
      ])
    );
    await expect(customerSession.page.getByText('Compare the appeal message, languages, reviews, and introduction to choose the best-fit host. After selection, you can coordinate details in the inbox right away.')).toBeVisible();
    await expect(customerSession.page.getByText(hostUser.fullName)).toBeVisible();
    await expect(customerSession.page.getByText('서비스 호스트 지원 흐름 안내 테스트용 프로필입니다.')).toBeVisible();
    await expect(customerSession.page.getByText('日本語', { exact: true })).toBeVisible();
    await customerSession.context.close();
  });

  test('defaults host dashboard service jobs to applications and syncs sub-tab URLs', async ({ browser }) => {
    const customerUser = createUser('customer-default');
    const hostUser = createUser('host-default');
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser);

    await createApprovedHostApplication(hostId, hostUser);
    await createActiveExperience(hostId);
    const request = await createOpenRequest(customerId, customerUser);
    await createApplication(request.id, hostId);

    const hostSession = await createLoggedInPage(browser, hostUser);
    await hostSession.page.goto('/host/dashboard?tab=service-jobs', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(hostSession.page);

    await expect(hostSession.page.locator('[data-testid^="service-jobs-"][data-testid$="-tab"]')).toHaveCount(2);
    await expect(hostSession.page.getByTestId('service-jobs-applications-tab')).toHaveAttribute('aria-pressed', 'true');
    await expect(hostSession.page.getByTestId('service-jobs-open-tab')).toHaveAttribute('aria-pressed', 'false');
    await expect(hostSession.page.getByText(request.title)).toBeVisible();

    await hostSession.page.getByTestId('service-jobs-open-tab').click();
    await hostSession.page.waitForURL(/\/host\/dashboard\?tab=service-jobs&serviceTab=open/, { timeout: 15000 });
    await expect(hostSession.page.getByTestId('service-jobs-open-tab')).toHaveAttribute('aria-pressed', 'true');
    await expect(hostSession.page.getByTestId('service-jobs-applications-tab')).toHaveAttribute('aria-pressed', 'false');
    await expect(hostSession.page.getByText(request.title)).toBeVisible();

    await hostSession.page.getByTestId('service-jobs-applications-tab').click();
    await hostSession.page.waitForURL(/\/host\/dashboard\?tab=service-jobs&serviceTab=applications/, { timeout: 15000 });
    await expect(hostSession.page.getByTestId('service-jobs-applications-tab')).toHaveAttribute('aria-pressed', 'true');
    await expect(hostSession.page.getByTestId('service-jobs-open-tab')).toHaveAttribute('aria-pressed', 'false');
    await hostSession.context.close();
  });
});
