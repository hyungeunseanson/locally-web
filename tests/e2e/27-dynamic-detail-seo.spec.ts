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

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.dynamic.seo.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Dynamic SEO ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
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

  return { id: data.user.id, ...user };
}

async function createCustomerUser() {
  return createAuthUser(createUser('customer'));
}

async function createVisibleHostUser() {
  const host = await createAuthUser(createUser('host'));

  const { data, error } = await getAdminClient()
    .from('host_applications')
    .insert({
      user_id: host.id,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-03-14',
      email: host.email,
      instagram: '@codex_dynamic_seo_host',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '동적 SEO 회귀 테스트용 공개 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: '동적 SEO 회귀 테스트',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create visible host application.');
  }

  createdApplicationIds.push(String(data.id));
  return host.id;
}

async function createExperienceFixture(hostId: string, status: 'active' | 'inactive') {
  const supabase = getAdminClient();
  const title = `[Playwright] SEO Experience ${status} ${Date.now()}`;

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
      description: `${status} SEO metadata verification experience`,
      itinerary: [{ title: 'SEO 테스트 코스', description: '검색엔진 메타 검증용 코스입니다.' }],
      spots: 'SEO TEST SPOT',
      meeting_point: 'SEO TEST STATION',
      location: 'Seoul SEO Test Location',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status,
      is_active: status === 'active',
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
    throw error || new Error(`Failed to create ${status} experience.`);
  }

  createdExperienceIds.push(data.id);

  return { id: Number(data.id), title };
}

async function createOpenServiceRequestFixture(customer: { id: string; fullName: string; phone: string }) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 10);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: customer.id,
      title: `[Playwright] SEO Service Request ${timestamp}`,
      description: '검색엔진 noindex 검증용 오픈 서비스 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: serviceDate.toISOString().slice(0, 10),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create open service request.');
  }

  createdServiceRequestIds.push(data.id);

  return { id: data.id };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds.reverse()) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe('Dynamic detail SEO boundaries', () => {
  test('keeps active experiences indexable and marks private-like detail pages as noindex', async ({ page }) => {
    const customer = await createCustomerUser();
    const visibleHostId = await createVisibleHostUser();
    const activeExperience = await createExperienceFixture(visibleHostId, 'active');
    const inactiveExperience = await createExperienceFixture(visibleHostId, 'inactive');
    const serviceRequest = await createOpenServiceRequestFixture(customer);

    await page.goto(`/experiences/${activeExperience.id}`, { waitUntil: 'domcontentloaded' });

    const activeCanonical = page.locator('link[rel="canonical"]');
    await expect(activeCanonical).toHaveAttribute('href', new RegExp(`/experiences/${activeExperience.id}$`));
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await page.goto(`/experiences/${inactiveExperience.id}`, { waitUntil: 'domcontentloaded' });

    const inactiveRobots = page.locator('meta[name="robots"]');
    await expect(inactiveRobots).toHaveAttribute('content', /noindex/i);

    await page.goto(`/services/${serviceRequest.id}`, { waitUntil: 'domcontentloaded' });

    const serviceRobots = page.locator('meta[name="robots"]');
    await expect(serviceRobots).toHaveAttribute('content', /noindex/i);
  });
});
