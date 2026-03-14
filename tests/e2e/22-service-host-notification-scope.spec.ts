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
const createdWhitelistEmails: string[] = [];
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

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.scope.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Scope Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createCustomerUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.scope.customer.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Scope Customer ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createHostUser(city: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.scope.host.${city.toLowerCase()}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Scope Host ${city} ${timestamp}`,
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

async function createAuthUser(user: TestUser, isAdmin = false) {
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

  if (isAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

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
      source: 'E2E service host notification scope test',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: '서비스 호스트 알림 범위 테스트용 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 호스트 알림 범위 테스트용 지원서입니다.',
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
  const title = `[Playwright] Service Scope Experience ${city} ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city,
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '서비스 호스트 알림 범위 테스트용 체험입니다.',
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

async function createPendingBankFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 9);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 10);

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Scope ${timestamp}`,
      description: '서울 지역 서비스 호스트 범위 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'pending_payment',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    })
    .select('id')
    .single();

  if (requestError || !requestData?.id) {
    throw requestError || new Error('Failed to create service request.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-SCOPE-${timestamp}`;
  const orderId = `SVC-SCOPE-ORD-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: orderId,
    request_id: requestData.id,
    application_id: null,
    customer_id: customerId,
    host_id: null,
    amount: 160000,
    host_payout_amount: 100000,
    platform_revenue: 60000,
    status: 'PENDING',
    payout_status: 'pending',
    payment_method: 'bank',
    contact_name: customer.fullName,
    contact_phone: customer.phone,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    bookingId,
    orderId,
    requestId: requestData.id,
  };
}

async function waitForServiceRequestNotificationCount(userId: string, requestId: string, expectedCount: number) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'service_request_new')
      .eq('link', `/services/${requestId}`);

    if (error) throw error;
    if ((data?.length || 0) === expectedCount) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Notification count for ${userId} did not reach ${expectedCount}.`);
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

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('notifications').delete().eq('type', 'service_request_new').eq('link', `/services/${requestId}`);
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Service host notification scope', () => {
  test('bank confirmation notifies only hosts matching the request city scope', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createAdminUser();
    const customerUser = createCustomerUser();
    const seoulHostUser = createHostUser('Seoul');
    const busanHostUser = createHostUser('Busan');

    const adminId = await createAuthUser(adminUser, true);
    const customerId = await createAuthUser(customerUser);
    const seoulHostId = await createAuthUser(seoulHostUser);
    const busanHostId = await createAuthUser(busanHostUser);

    expect(adminId).toBeTruthy();

    await createHostApplication(seoulHostId, seoulHostUser);
    await createHostApplication(busanHostId, busanHostUser);
    await createActiveExperience(seoulHostId, 'Seoul');
    await createActiveExperience(busanHostId, 'Busan');

    const fixture = await createPendingBankFixture(customerId, customerUser);

    await login(page, adminUser);

    const response = await page.request.post('/api/admin/service-confirm-payment', {
      data: { orderId: fixture.orderId },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    await waitForServiceRequestNotificationCount(seoulHostId, fixture.requestId, 1);
    await waitForServiceRequestNotificationCount(busanHostId, fixture.requestId, 0);

    const supabase = getAdminClient();
    const { data: booking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const { data: serviceRequest, error: requestError } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(booking?.status).toBe('PAID');
    expect(serviceRequest?.status).toBe('open');
  });
});
