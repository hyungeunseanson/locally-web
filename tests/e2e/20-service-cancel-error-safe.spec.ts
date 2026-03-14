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

function createCustomerUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.cancel.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Cancel ${prefix} ${timestamp}`,
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

async function createPendingCancelFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 7);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 20);

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Cancel Pending ${timestamp}`,
      description: '서비스 취소 error-safe PENDING 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '09:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'pending_payment',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    })
    .select('id, total_customer_price')
    .single();

  if (requestError || !requestData?.id) {
    throw requestError || new Error('Failed to create pending cancel service request.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-CANCEL-PENDING-${timestamp}`;
  const orderId = `SVC-CANCEL-PENDING-ORD-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: orderId,
    request_id: requestData.id,
    application_id: null,
    customer_id: customerId,
    host_id: null,
    amount: requestData.total_customer_price,
    host_payout_amount: 80000,
    platform_revenue: Number(requestData.total_customer_price || 0) - 80000,
    status: 'PENDING',
    payment_method: 'bank',
    payout_status: 'pending',
    contact_name: customer.fullName,
    contact_phone: customer.phone,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    orderId,
    requestId: requestData.id,
    bookingId,
  };
}

async function createPaidOpenFixtureWithoutRefundTid(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 5);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 20);

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Cancel Paid ${timestamp}`,
      description: '서비스 취소 error-safe PAID 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '13:00',
      duration_hours: 4,
      languages: ['English'],
      guest_count: 1,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    })
    .select('id, total_customer_price')
    .single();

  if (requestError || !requestData?.id) {
    throw requestError || new Error('Failed to create paid cancel service request.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-CANCEL-PAID-${timestamp}`;
  const orderId = `SVC-CANCEL-PAID-ORD-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: orderId,
    request_id: requestData.id,
    application_id: null,
    customer_id: customerId,
    host_id: null,
    amount: requestData.total_customer_price,
    host_payout_amount: 80000,
    platform_revenue: Number(requestData.total_customer_price || 0) - 80000,
    status: 'PAID',
    payment_method: 'paypal',
    tid: null,
    payout_status: 'pending',
    contact_name: customer.fullName,
    contact_phone: customer.phone,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    orderId,
    requestId: requestData.id,
    bookingId,
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

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Service customer cancel error-safe flow', () => {
  test('keeps PAID open service booking unchanged when refund cannot start', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser('paid');
    const customerId = await createAuthUser(customerUser);
    const fixture = await createPaidOpenFixtureWithoutRefundTid(customerId, customerUser);

    await login(page, customerUser);

    const response = await page.request.post('/api/services/cancel', {
      data: {
        order_id: fixture.orderId,
        cancel_reason: 'Playwright paid cancel guard',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });

    const supabase = getAdminClient();
    const { data: booking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status, refund_amount')
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
    expect(booking?.refund_amount).toBeNull();
    expect(serviceRequest?.status).toBe('open');
  });

  test('still cancels PENDING service booking immediately', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser('pending');
    const customerId = await createAuthUser(customerUser);
    const fixture = await createPendingCancelFixture(customerId, customerUser);

    await login(page, customerUser);

    const response = await page.request.post('/api/services/cancel', {
      data: {
        order_id: fixture.orderId,
        cancel_reason: 'Playwright pending cancel flow',
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

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

    expect(booking?.status).toBe('cancelled');
    expect(serviceRequest?.status).toBe('cancelled');
  });
});
