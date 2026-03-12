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

type CreatedServiceFixtures = {
  recentOrderId: string;
  oldOrderId: string;
};

type ServiceCsvResponseRow = {
  order_id: string | null;
  payout_status: string | null;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
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

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.billing.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Billing Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createCustomerUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.billing.customer.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Billing Customer ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createHostUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.billing.host.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Billing Host ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      source: 'E2E billing test',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: 'Billing E2E 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: 'Billing 탭 정산 CSV 검증용 지원서입니다.',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createServiceFixtures(customerId: string, hostId: string): Promise<CreatedServiceFixtures> {
  const supabase = getAdminClient();
  const timestamp = Date.now();

  const recentServiceDate = new Date();
  recentServiceDate.setDate(recentServiceDate.getDate() + 14);

  const oldServiceDate = new Date();
  oldServiceDate.setDate(oldServiceDate.getDate() - 120);

  const recentCreatedAt = new Date();
  recentCreatedAt.setMinutes(recentCreatedAt.getMinutes() - 5);

  const oldCreatedAt = new Date();
  oldCreatedAt.setDate(oldCreatedAt.getDate() - 120);

  const { data: recentRequest, error: recentRequestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Billing Recent ${timestamp}`,
      description: 'Billing 최근 서비스 정산 CSV 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(recentServiceDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 1,
      status: 'paid',
    })
    .select('id')
    .single();

  if (recentRequestError || !recentRequest?.id) {
    throw recentRequestError || new Error('Failed to create recent service request.');
  }

  createdServiceRequestIds.push(recentRequest.id);

  const { data: oldRequest, error: oldRequestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Billing Old ${timestamp}`,
      description: 'Billing 과거 서비스 정산 CSV 테스트용 의뢰입니다.',
      city: 'Busan',
      country: 'KR',
      service_date: formatDate(oldServiceDate),
      start_time: '11:00',
      duration_hours: 4,
      languages: ['English'],
      guest_count: 2,
      status: 'paid',
    })
    .select('id')
    .single();

  if (oldRequestError || !oldRequest?.id) {
    throw oldRequestError || new Error('Failed to create old service request.');
  }

  createdServiceRequestIds.push(oldRequest.id);

  const { data: recentApplication, error: recentApplicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: recentRequest.id,
      host_id: hostId,
      appeal_message: '최근 서비스 예약 테스트용 지원입니다.',
      status: 'selected',
      created_at: recentCreatedAt.toISOString(),
      updated_at: recentCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (recentApplicationError || !recentApplication?.id) {
    throw recentApplicationError || new Error('Failed to create recent service application.');
  }

  createdServiceApplicationIds.push(recentApplication.id);

  const { data: oldApplication, error: oldApplicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: oldRequest.id,
      host_id: hostId,
      appeal_message: '과거 서비스 예약 테스트용 지원입니다.',
      status: 'selected',
      created_at: oldCreatedAt.toISOString(),
      updated_at: oldCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (oldApplicationError || !oldApplication?.id) {
    throw oldApplicationError || new Error('Failed to create old service application.');
  }

  createdServiceApplicationIds.push(oldApplication.id);

  const recentOrderId = `SVC-BILLING-RECENT-${timestamp}`;
  const oldOrderId = `SVC-BILLING-OLD-${timestamp}`;

  const recentBookingPayload = {
    id: recentOrderId,
    order_id: recentOrderId,
    request_id: recentRequest.id,
    application_id: recentApplication.id,
    customer_id: customerId,
    host_id: hostId,
    amount: 140000,
    host_payout_amount: 80000,
    platform_revenue: 60000,
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'bank',
    created_at: recentCreatedAt.toISOString(),
    updated_at: recentCreatedAt.toISOString(),
  };

  const oldBookingPayload = {
    id: oldOrderId,
    order_id: oldOrderId,
    request_id: oldRequest.id,
    application_id: oldApplication.id,
    customer_id: customerId,
    host_id: hostId,
    amount: 140000,
    host_payout_amount: 80000,
    platform_revenue: 60000,
    status: 'PAID',
    payout_status: 'paid',
    payment_method: 'card',
    created_at: oldCreatedAt.toISOString(),
    updated_at: oldCreatedAt.toISOString(),
  };

  const { error: recentBookingError } = await supabase.from('service_bookings').insert(recentBookingPayload);
  if (recentBookingError) throw recentBookingError;
  createdServiceBookingIds.push(recentOrderId);

  const { error: oldBookingError } = await supabase.from('service_bookings').insert(oldBookingPayload);
  if (oldBookingError) throw oldBookingError;
  createdServiceBookingIds.push(oldOrderId);

  return { recentOrderId, oldOrderId };
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function openBilling(page: Page, adminUser: TestUser) {
  await login(page, adminUser);
  await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });
  await expect(page.getByText('매출 및 재무 현황')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('총 거래액 (GMV)')).toBeVisible();
  await expect(page.getByText('순매출 (Net Revenue)')).toBeVisible();
  await expect(page.getByText(/체험 정산 (예정금|가능액)/)).toBeVisible();
  await expect(page.getByText('객단가 (AOV)')).toBeVisible();
  await expect(page.getByRole('button', { name: /일괄 지급 준비중/ })).toBeDisabled();
}

async function downloadServiceCsvAndReadResponse(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/admin/service-bookings-csv') &&
      response.request().method() === 'GET',
    { timeout: 30000 }
  );

  await page.getByRole('button', { name: /맞춤 의뢰 명세서/ }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  return {
    requestUrl: response.url(),
    rows: (payload.data || []) as ServiceCsvResponseRow[],
  };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const applicationId of createdServiceApplicationIds) {
    await supabase.from('service_applications').delete().eq('id', applicationId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', requestId);
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

test.describe.serial('Admin billing smoke', () => {
  test('keeps billing KPI visible and aligns service CSV with active date range', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createAdminUser();
    const customerUser = createCustomerUser();
    const hostUser = createHostUser();

    await createAuthUser(adminUser, true);
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser);
    await createHostApplication(hostId, hostUser);
    const fixtures = await createServiceFixtures(customerId, hostId);

    await openBilling(page, adminUser);
    await expect(page.getByRole('button', { name: /맞춤 의뢰 명세서/ })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '30D' }).click();
    const rangeFiltered = await downloadServiceCsvAndReadResponse(page);
    expect(rangeFiltered.requestUrl).toContain('startAt=');
    expect(rangeFiltered.requestUrl).toContain('endAt=');
    expect(rangeFiltered.rows.some((row) => row.order_id === fixtures.recentOrderId && row.payout_status === 'pending')).toBeTruthy();
    expect(rangeFiltered.rows.some((row) => row.order_id === fixtures.oldOrderId)).toBeFalsy();
    await expect(page.getByText(/맞춤 의뢰 명세서 \d+건 다운로드 완료/)).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'ALL' }).click();
    const allRange = await downloadServiceCsvAndReadResponse(page);
    expect(allRange.rows.some((row) => row.order_id === fixtures.recentOrderId)).toBeTruthy();
    expect(allRange.rows.some((row) => row.order_id === fixtures.oldOrderId && row.payout_status === 'paid')).toBeTruthy();
  });
});
