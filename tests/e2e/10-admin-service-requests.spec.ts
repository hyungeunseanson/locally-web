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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createCustomerUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.customer.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Customer ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createHostUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.host.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Host ${timestamp}`,
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
      source: 'E2E service requests test',
      language_cert: 'TOPIK 6',
      profile_photo: null,
      self_intro: 'Service Requests E2E 테스트용 호스트 지원서입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 운영 탭 검증용 지원서입니다.',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createServiceFixtures(customerId: string, hostId: string) {
  const supabase = getAdminClient();
  const timestamp = Date.now();

  const requestDate = new Date();
  requestDate.setDate(requestDate.getDate() + 10);

  const cancelledDate = new Date();
  cancelledDate.setDate(cancelledDate.getDate() - 5);

  const recentCreatedAt = new Date();
  recentCreatedAt.setMinutes(recentCreatedAt.getMinutes() - 10);

  const cancelledCreatedAt = new Date();
  cancelledCreatedAt.setDate(cancelledCreatedAt.getDate() - 5);

  const { data: pendingRequest, error: pendingRequestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Pending ${timestamp}`,
      description: '서비스 의뢰 운영 탭 입금 확인/정산 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(requestDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'pending_payment',
      created_at: recentCreatedAt.toISOString(),
      updated_at: recentCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (pendingRequestError || !pendingRequest?.id) {
    throw pendingRequestError || new Error('Failed to create pending service request.');
  }
  createdServiceRequestIds.push(pendingRequest.id);

  const { data: pendingApplication, error: pendingApplicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: pendingRequest.id,
      host_id: hostId,
      appeal_message: '서비스 운영 탭 입금 확인 테스트용 지원입니다.',
      status: 'selected',
      created_at: recentCreatedAt.toISOString(),
      updated_at: recentCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (pendingApplicationError || !pendingApplication?.id) {
    throw pendingApplicationError || new Error('Failed to create pending service application.');
  }
  createdServiceApplicationIds.push(pendingApplication.id);

  const pendingOrderId = `SVC-REQ-PENDING-${timestamp}`;
  const { error: pendingBookingError } = await supabase.from('service_bookings').insert({
    id: pendingOrderId,
    order_id: pendingOrderId,
    request_id: pendingRequest.id,
    application_id: pendingApplication.id,
    customer_id: customerId,
    host_id: hostId,
    amount: 160000,
    host_payout_amount: 100000,
    platform_revenue: 60000,
    status: 'PENDING',
    payout_status: 'pending',
    payment_method: 'bank',
    created_at: recentCreatedAt.toISOString(),
    updated_at: recentCreatedAt.toISOString(),
  });

  if (pendingBookingError) throw pendingBookingError;
  createdServiceBookingIds.push(pendingOrderId);

  const { data: cancelledRequest, error: cancelledRequestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Cancelled ${timestamp}`,
      description: '서비스 의뢰 운영 탭 환불 목록 테스트용 의뢰입니다.',
      city: 'Busan',
      country: 'KR',
      service_date: formatDate(cancelledDate),
      start_time: '11:00',
      duration_hours: 4,
      languages: ['English'],
      guest_count: 1,
      status: 'cancelled',
      created_at: cancelledCreatedAt.toISOString(),
      updated_at: cancelledCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (cancelledRequestError || !cancelledRequest?.id) {
    throw cancelledRequestError || new Error('Failed to create cancelled service request.');
  }
  createdServiceRequestIds.push(cancelledRequest.id);

  const { data: cancelledApplication, error: cancelledApplicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: cancelledRequest.id,
      host_id: hostId,
      appeal_message: '서비스 운영 탭 환불 목록 테스트용 지원입니다.',
      status: 'selected',
      created_at: cancelledCreatedAt.toISOString(),
      updated_at: cancelledCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (cancelledApplicationError || !cancelledApplication?.id) {
    throw cancelledApplicationError || new Error('Failed to create cancelled service application.');
  }
  createdServiceApplicationIds.push(cancelledApplication.id);

  const cancelledOrderId = `SVC-REQ-CANCELLED-${timestamp}`;
  const { error: cancelledBookingError } = await supabase.from('service_bookings').insert({
    id: cancelledOrderId,
    order_id: cancelledOrderId,
    request_id: cancelledRequest.id,
    application_id: cancelledApplication.id,
    customer_id: customerId,
    host_id: hostId,
    amount: 120000,
    host_payout_amount: 80000,
    platform_revenue: 40000,
    status: 'cancelled',
    payout_status: 'pending',
    payment_method: 'card',
    refund_amount: 120000,
    cancel_reason: 'Playwright refund fixture',
    created_at: cancelledCreatedAt.toISOString(),
    updated_at: cancelledCreatedAt.toISOString(),
  });

  if (cancelledBookingError) throw cancelledBookingError;
  createdServiceBookingIds.push(cancelledOrderId);

  return {
    pendingOrderId,
    pendingRequestTitle: `[Playwright] Service Pending ${timestamp}`,
    hostName: `Service Host ${String(timestamp)}`,
    cancelledOrderId,
    cancelledRequestTitle: `[Playwright] Service Cancelled ${timestamp}`,
  };
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

test.describe.serial('Admin service requests smoke', () => {
  test('confirms bank payment, shows settlement account info, and lists refunds', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createAdminUser();
    const customerUser = createCustomerUser();
    const hostUser = createHostUser();

    await createAuthUser(adminUser, true);
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser);
    await createHostApplication(hostId, hostUser);
    const fixtures = await createServiceFixtures(customerId, hostId);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SERVICE_REQUESTS', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '맞춤 의뢰 관리' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '전체 의뢰' })).toBeVisible();
    await expect(page.getByRole('button', { name: '정산 대기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '취소·환불 내역' })).toBeVisible();

    await expect(page.getByText(fixtures.pendingRequestTitle)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /💰 입금 확인/ })).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /💰 입금 확인/ }).click();
    await expect(page.getByText('입금 확인 완료. 의뢰가 공개되었습니다.')).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '정산 대기' }).click();
    await expect(page.getByText('서비스 정산 대기')).toBeVisible();
    await expect(page.getByText('테스트은행 12345678901234').first()).toBeVisible({ timeout: 20000 });
    await page.locator('p.font-bold', { hasText: hostUser.fullName }).first().click();
    await expect(page.getByRole('button', { name: /이체 완료 처리/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /명세서 CSV/ })).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /이체 완료 처리/ }).click();
    await expect(page.getByText('정산 완료 처리되었습니다.')).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '취소·환불 내역' }).click();
    await expect(page.getByText(fixtures.cancelledRequestTitle)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Playwright refund fixture')).toBeVisible();
  });
});
