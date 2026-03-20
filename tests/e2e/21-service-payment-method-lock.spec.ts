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

function createCustomerUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.service.methodlock.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service Method Lock ${timestamp}`,
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

async function createBankLockedPendingFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 8);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 20);

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Bank Locked ${timestamp}`,
      description: '서비스 결제수단 lock 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '15:00',
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
    throw requestError || new Error('Failed to create service request.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-BANK-LOCK-${timestamp}`;
  const orderId = `SVC-BANK-LOCK-ORD-${timestamp}`;
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
    bookingId,
    orderId,
    requestId: requestData.id,
  };
}

async function createPendingUnselectedFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 9);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 15);

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Card To Bank ${timestamp}`,
      description: '서비스 카드 기본값에서 무통장 전환 회귀 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '11:00',
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
    throw requestError || new Error('Failed to create switchable service request.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-CARD-SWITCH-${timestamp}`;
  const orderId = `SVC-CARD-SWITCH-ORD-${timestamp}`;
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
    payment_method: null,
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
    bookingId,
    orderId,
    requestId: requestData.id,
  };
}

async function createLegacyUntouchedCardFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 10);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 10);
  const untouchedAt = createdAt.toISOString();

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service Legacy Card ${timestamp}`,
      description: 'legacy untouched card placeholder에서 무통장 전환 가능한지 검증합니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '16:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'pending_payment',
      created_at: untouchedAt,
      updated_at: untouchedAt,
    })
    .select('id, total_customer_price')
    .single();

  if (requestError || !requestData?.id) {
    throw requestError || new Error('Failed to create legacy card service request.');
  }
  createdServiceRequestIds.push(requestData.id);

  const bookingId = `SVC-LEGACY-CARD-${timestamp}`;
  const orderId = `SVC-LEGACY-CARD-ORD-${timestamp}`;
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
    payment_method: 'card',
    tid: null,
    payout_status: 'pending',
    contact_name: customer.fullName,
    contact_phone: customer.phone,
    created_at: untouchedAt,
    updated_at: untouchedAt,
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    bookingId,
    orderId,
    requestId: requestData.id,
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

test.describe.serial('Service payment method lock', () => {
  test('allows a pending unselected service booking to switch to bank', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const fixture = await createPendingUnselectedFixture(customerId, customerUser);

    await login(page, customerUser);

    const markBankResponse = await page.request.post('/api/services/payment/mark-bank', {
      data: { orderId: fixture.orderId },
    });
    expect(markBankResponse.status()).toBe(200);
    await expect(markBankResponse.json()).resolves.toMatchObject({
      success: true,
    });

    const cardCallbackResponse = await page.request.post('/api/services/payment/nicepay-callback', {
      data: {
        imp_uid: 'imp_card_to_bank_switch',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
      },
    });
    expect(cardCallbackResponse.status()).toBe(409);

    const supabase = getAdminClient();
    const { data: booking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status, payment_method, tid')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const { data: serviceRequest, error: requestError } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(booking?.status).toBe('PENDING');
    expect(booking?.payment_method).toBe('bank');
    expect(booking?.tid).toBeNull();
    expect(serviceRequest?.status).toBe('pending_payment');
  });

  test('blocks bank conversion after card start is marked, then allows it again after release', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const fixture = await createPendingUnselectedFixture(customerId, customerUser);

    await login(page, customerUser);

    const markCardResponse = await page.request.post('/api/services/payment/mark-card', {
      data: { orderId: fixture.orderId },
    });
    expect(markCardResponse.status()).toBe(200);
    await expect(markCardResponse.json()).resolves.toMatchObject({
      success: true,
    });

    const repeatedMarkCardResponse = await page.request.post('/api/services/payment/mark-card', {
      data: { orderId: fixture.orderId },
    });
    expect(repeatedMarkCardResponse.status()).toBe(200);
    await expect(repeatedMarkCardResponse.json()).resolves.toMatchObject({
      success: true,
      alreadyMarked: true,
    });

    const markBankWhileCardResponse = await page.request.post('/api/services/payment/mark-bank', {
      data: { orderId: fixture.orderId },
    });
    expect(markBankWhileCardResponse.status()).toBe(409);

    const releaseCardResponse = await page.request.post('/api/services/payment/release-card', {
      data: { orderId: fixture.orderId },
    });
    expect(releaseCardResponse.status()).toBe(200);
    await expect(releaseCardResponse.json()).resolves.toMatchObject({
      success: true,
    });

    const repeatedReleaseCardResponse = await page.request.post('/api/services/payment/release-card', {
      data: { orderId: fixture.orderId },
    });
    expect(repeatedReleaseCardResponse.status()).toBe(200);
    await expect(repeatedReleaseCardResponse.json()).resolves.toMatchObject({
      success: true,
      alreadyReleased: true,
    });

    const markBankAfterReleaseResponse = await page.request.post('/api/services/payment/mark-bank', {
      data: { orderId: fixture.orderId },
    });
    expect(markBankAfterReleaseResponse.status()).toBe(200);

    const supabase = getAdminClient();
    const { data: booking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status, payment_method, tid')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(booking?.status).toBe('PENDING');
    expect(booking?.payment_method).toBe('bank');
    expect(booking?.tid).toBeNull();
  });

  test('keeps bank-marked pending booking locked to bank across UI and payment routes', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const fixture = await createBankLockedPendingFixture(customerId, customerUser);

    await login(page, customerUser);
    await page.goto(`/services/${fixture.requestId}/payment`, { waitUntil: 'networkidle' });

    await expect(
      page.getByText('이미 무통장 입금 대기 상태로 전환된 의뢰입니다. 결제수단을 변경할 수 없습니다.')
    ).toBeVisible();

    const markBankResponse = await page.request.post('/api/services/payment/mark-bank', {
      data: { orderId: fixture.orderId },
    });
    expect(markBankResponse.status()).toBe(200);
    await expect(markBankResponse.json()).resolves.toMatchObject({
      success: true,
      alreadyMarked: true,
    });

    const paypalCreateResponse = await page.request.post('/api/services/payment/paypal/create-order', {
      data: { bookingId: fixture.bookingId },
    });
    expect(paypalCreateResponse.status()).toBe(400);

    const paypalCaptureResponse = await page.request.post('/api/services/payment/paypal/capture-order', {
      data: {
        bookingId: fixture.bookingId,
        paypalOrderId: 'PAYPAL-BANK-LOCK-TEST',
      },
    });
    expect(paypalCaptureResponse.status()).toBe(409);

    const cardCallbackResponse = await page.request.post('/api/services/payment/nicepay-callback', {
      data: {
        imp_uid: 'imp_bank_locked_test',
        merchant_uid: fixture.orderId,
        orderId: fixture.orderId,
      },
    });
    expect(cardCallbackResponse.status()).toBe(409);

    const supabase = getAdminClient();
    const { data: booking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('status, payment_method')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    const { data: serviceRequest, error: requestError } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', fixture.requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(booking?.status).toBe('PENDING');
    expect(booking?.payment_method).toBe('bank');
    expect(serviceRequest?.status).toBe('pending_payment');
  });

  test('allows a legacy untouched card placeholder to fall back to bank', async ({ page }) => {
    test.setTimeout(90000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const fixture = await createLegacyUntouchedCardFixture(customerId, customerUser);

    await login(page, customerUser);

    const response = await page.request.post('/api/services/payment/mark-bank', {
      data: { orderId: fixture.orderId },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });

    const supabase = getAdminClient();
    const { data: booking, error } = await supabase
      .from('service_bookings')
      .select('status, payment_method, tid')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (error) throw error;

    expect(booking?.status).toBe('PENDING');
    expect(booking?.payment_method).toBe('bank');
    expect(booking?.tid).toBeNull();
  });
});
