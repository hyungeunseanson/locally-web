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
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdHostApplicationIds: string[] = [];
const createdNotificationIds: number[] = [];

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
    email: `codex.service.locale.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Locale ${prefix} ${timestamp}`,
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

async function setPreferredLocale(userId: string, locale: 'ko' | 'en' | 'ja' | 'zh') {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw error || new Error(`Failed to fetch auth user ${userId}.`);

  const metadata =
    data.user.user_metadata && typeof data.user.user_metadata === 'object'
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      preferred_locale: locale,
    },
  });

  if (updateError) throw updateError;
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
      source: 'E2E service notification localization',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: '서비스 알림 다국어 테스트용 승인 호스트입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 알림 다국어 테스트',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createActiveExperience(hostId: string, city: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: 'KR',
      city,
      title: `[Playwright] Service Locale Experience ${city} ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '서비스 알림 다국어 테스트용 체험입니다.',
      itinerary: [{ title: `${city} 테스트 동선`, description: '테스트 동선입니다.' }],
      spots: `${city} Station`,
      meeting_point: `${city} Station Exit 1`,
      location: `${city} Test Location`,
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
      inclusions: ['Guide'],
      exclusions: ['Personal expenses'],
      supplies: 'Comfortable clothes',
      rules: {
        age_limit: '19+',
        activity_level: 'normal',
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
    throw error || new Error('Failed to create active experience.');
  }

  createdExperienceIds.push(Number(data.id));
}

async function createPaidOpenRequest(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const date = new Date();
  date.setDate(date.getDate() + 10);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Locale Request ${Date.now()}`,
      description: '서비스 알림 다국어 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(date),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
    })
    .select('id, title, total_customer_price, total_host_payout')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service request.');
  }

  createdServiceRequestIds.push(data.id);

  const bookingId = `SVC-LOCALE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: data.id,
    customer_id: customerId,
    host_id: null,
    application_id: null,
    amount: Number(data.total_customer_price),
    host_payout_amount: Number(data.total_host_payout),
    platform_revenue: Number(data.total_customer_price) - Number(data.total_host_payout),
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'card',
    contact_name: customer.fullName,
    contact_phone: customer.phone,
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    requestId: data.id,
    requestTitle: String(data.title),
  };
}

async function login(page: Page, user: TestUser) {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

async function waitForNotification(params: {
  userId: string;
  type: string;
  link: string;
}) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, link, type')
      .eq('user_id', params.userId)
      .eq('type', params.type)
      .eq('link', params.link)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) {
      createdNotificationIds.push(Number(data.id));
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Notification not found for ${params.userId} / ${params.type} / ${params.link}.`);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const applicationId of createdServiceApplicationIds) {
    await supabase.from('service_applications').delete().eq('id', applicationId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_applications').delete().eq('request_id', requestId);
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Service notification localization', () => {
  test('localizes service application notifications by recipient locale', async ({ page }) => {
    test.setTimeout(120000);

    const customer = createUser('customer');
    const host = createUser('host');

    const customerId = await createAuthUser(customer);
    const hostId = await createAuthUser(host);

    await setPreferredLocale(customerId, 'en');
    await setPreferredLocale(hostId, 'ja');

    await createHostApplication(hostId, host);
    await createActiveExperience(hostId, 'Seoul');

    const requestFixture = await createPaidOpenRequest(customerId, customer);

    await login(page, host);
    const applyResponse = await page.request.post('/api/services/applications', {
      data: {
        request_id: requestFixture.requestId,
        appeal_message: 'Localized host application',
      },
    });
    expect(applyResponse.status()).toBe(200);

    const applicationNewNotification = await waitForNotification({
      userId: customerId,
      type: 'service_application_new',
      link: `/services/${requestFixture.requestId}`,
    });
    expect(applicationNewNotification.title).toBe('📩 A new host has applied');
    expect(applicationNewNotification.message).toContain(requestFixture.requestTitle);
  });
});
