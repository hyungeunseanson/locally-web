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
const MOCK_PAYPAL_ORDER_ID = 'PAYPAL-SVC-ORDER-TEST';
const MOCK_PAYPAL_CAPTURE_ID = 'PAYPAL-SVC-CAPTURE-TEST';
const MOCK_PAYPAL_SDK = `
  window.paypal = {
    Buttons: function Buttons(options) {
      return {
        render: async function render(container) {
          container.innerHTML = '';
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Mock PayPal Approve';
          button.setAttribute('data-testid', 'mock-paypal-approve');
          button.addEventListener('click', async () => {
            try {
              const orderId = await options.createOrder({});
              await options.onApprove({ orderID: orderId });
            } catch (error) {
              if (options.onError) options.onError(error);
            }
          });
          container.appendChild(button);
        }
      };
    }
  };
`;

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
    email: `codex.service.paypal.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service PayPal Customer ${timestamp}`,
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

async function createServicePaymentFixture(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const requestDate = new Date();
  requestDate.setDate(requestDate.getDate() + 7);
  const createdAt = new Date();
  createdAt.setMinutes(createdAt.getMinutes() - 15);

  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Service PayPal ${timestamp}`,
      description: '서비스 PayPal 결제 스모크 테스트용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(requestDate),
      start_time: '14:00',
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

  const bookingId = `SVC-PAYPAL-${timestamp}`;
  const orderId = `SVC-PAYPAL-ORD-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: orderId,
    request_id: requestData.id,
    customer_id: customerId,
    host_id: null,
    application_id: null,
    amount: requestData.total_customer_price,
    host_payout_amount: 80000,
    platform_revenue: Number(requestData.total_customer_price || 0) - 80000,
    status: 'PENDING',
    payment_method: 'card',
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
    title: `[Playwright] Service PayPal ${timestamp}`,
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

test.describe.serial('Service PayPal payment smoke', () => {
  test('completes mocked PayPal approval flow when PayPal is enabled', async ({ page }) => {
    test.setTimeout(120000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const fixture = await createServicePaymentFixture(customerId, customerUser);

    let createOrderSeen = false;
    let captureSeen = false;

    await page.route('https://www.paypal.com/sdk/js**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: MOCK_PAYPAL_SDK,
      });
    });

    await page.route('**/api/services/payment/paypal/create-order', async (route) => {
      const payload = route.request().postDataJSON() as { bookingId?: string };
      expect(payload.bookingId).toBe(fixture.bookingId);
      createOrderSeen = true;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paypalOrderId: MOCK_PAYPAL_ORDER_ID,
        }),
      });
    });

    await page.route('**/api/services/payment/paypal/capture-order', async (route) => {
      const payload = route.request().postDataJSON() as {
        bookingId?: string;
        paypalOrderId?: string;
      };
      expect(payload.bookingId).toBe(fixture.bookingId);
      expect(payload.paypalOrderId).toBe(MOCK_PAYPAL_ORDER_ID);
      captureSeen = true;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          captureId: MOCK_PAYPAL_CAPTURE_ID,
          paypalOrderId: MOCK_PAYPAL_ORDER_ID,
        }),
      });
    });

    await login(page, customerUser);
    await page.goto(`/services/${fixture.requestId}/payment`, { waitUntil: 'networkidle' });

    const paypalOption = page.getByRole('button', { name: /PayPal/ }).first();
    if (!(await paypalOption.isVisible().catch(() => false))) {
      test.skip(true, 'PayPal is not enabled in the current runtime.');
    }

    await page.locator('input:not([type="checkbox"])').nth(0).fill(customerUser.fullName);
    await page.locator('input:not([type="checkbox"])').nth(1).fill(customerUser.phone);
    await page.locator('input[type="checkbox"]').check();

    await paypalOption.click();
    await expect(page.getByText('PayPal 승인 후 결제가 완료되며, 기존 카드/무통장 결제 흐름에는 영향을 주지 않습니다.')).toBeVisible();
    await expect(page.getByTestId('mock-paypal-approve')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('mock-paypal-approve').click();

    await page.waitForURL(
      new RegExp(`/services/${fixture.requestId}/payment/complete\\?orderId=${fixture.orderId}&method=paypal`),
      { timeout: 15000 }
    );

    expect(createOrderSeen).toBe(true);
    expect(captureSeen).toBe(true);
    await expect(page.getByRole('heading', { name: '결제 완료!' })).toBeVisible();
    await expect(page.getByText(fixture.orderId)).toBeVisible();
  });
});
