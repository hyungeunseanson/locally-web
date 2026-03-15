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

type BookableExperience = {
  experienceId: number;
  title: string;
  date: string;
  time: string;
};

type AvailabilityKey = {
  experienceId: number;
  date: string;
  time: string;
};

const TEST_PASSWORD = 'LocallyTest!2026';
const HOST_USER_ID = 'cc84b331-7e78-4818-b9ba-f1a960017473';
const MOCK_PAYPAL_ORDER_ID = 'PAYPAL-EXP-ORDER-TEST';
const MOCK_PAYPAL_CAPTURE_ID = 'PAYPAL-EXP-CAPTURE-TEST';
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
const createdAvailabilityKeys: AvailabilityKey[] = [];

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
    email: `codex.exp.paypal.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Experience PayPal Customer ${timestamp}`,
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

async function prepareBookableExperience(): Promise<BookableExperience> {
  const supabase = getAdminClient();
  const { data: experience, error: experienceError } = await supabase
    .from('experiences')
    .select('id, title, status, host_id')
    .eq('host_id', HOST_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (experienceError) throw experienceError;
  if (!experience) {
    throw new Error('No host experience found for the approved test host.');
  }

  if (experience.status !== 'approved' && experience.status !== 'active') {
    const { error: updateError } = await supabase
      .from('experiences')
      .update({ status: 'approved' })
      .eq('id', experience.id);

    if (updateError) throw updateError;
  }

  let date = '';
  const time = '10:00';

  for (let offset = 14; offset <= 45; offset += 1) {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + offset);
    const candidate = formatDate(candidateDate);

    const { count, error: bookingCountError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('experience_id', experience.id)
      .eq('date', candidate)
      .eq('time', time)
      .in('status', ['PENDING', 'PAID', 'confirmed', 'pending', 'paid']);

    if (bookingCountError) throw bookingCountError;

    if (!count || count === 0) {
      date = candidate;
      break;
    }
  }

  if (!date) {
    throw new Error('Could not find an empty future booking slot for the test experience.');
  }

  const { data: existingSlots, error: slotFetchError } = await supabase
    .from('experience_availability')
    .select('experience_id')
    .eq('experience_id', experience.id)
    .eq('date', date)
    .eq('start_time', time)
    .limit(1);

  if (slotFetchError) throw slotFetchError;

  if (!existingSlots || existingSlots.length === 0) {
    const { error: slotInsertError } = await supabase
      .from('experience_availability')
      .insert({
        experience_id: experience.id,
        date,
        start_time: time,
        is_booked: false,
      });

    if (slotInsertError) throw slotInsertError;
    createdAvailabilityKeys.push({ experienceId: Number(experience.id), date, time });
  }

  return {
    experienceId: Number(experience.id),
    title: String(experience.title || 'Locally 체험'),
    date,
    time,
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

  for (const userId of createdAuthUserIds) {
    await supabase.from('bookings').delete().eq('user_id', userId);
  }

  for (const slot of createdAvailabilityKeys) {
    await supabase
      .from('experience_availability')
      .delete()
      .eq('experience_id', slot.experienceId)
      .eq('date', slot.date)
      .eq('start_time', slot.time);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Experience PayPal payment smoke', () => {
  test('completes mocked PayPal approval flow for an experience booking', async ({ page }) => {
    test.setTimeout(120000);

    const customerUser = createCustomerUser();
    const customerId = await createAuthUser(customerUser);
    const experience = await prepareBookableExperience();

    let createOrderSeen = false;
    let captureSeen = false;
    let observedBookingId = '';

    await page.route('https://www.paypal.com/sdk/js**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: MOCK_PAYPAL_SDK,
      });
    });

    await page.route('**/api/payment/paypal/create-order', async (route) => {
      const payload = route.request().postDataJSON() as { bookingId?: string };
      observedBookingId = String(payload.bookingId || '');
      expect(observedBookingId).toBeTruthy();
      createOrderSeen = true;

      const { data: booking, error: bookingError } = await getAdminClient()
        .from('bookings')
        .select('status, payment_method, user_id')
        .eq('id', observedBookingId)
        .maybeSingle();

      if (bookingError) throw bookingError;

      expect(booking).toMatchObject({
        status: 'PENDING',
        payment_method: 'paypal',
        user_id: customerId,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paypalOrderId: MOCK_PAYPAL_ORDER_ID,
        }),
      });
    });

    await page.route('**/api/payment/paypal/capture-order', async (route) => {
      const payload = route.request().postDataJSON() as {
        bookingId?: string;
        paypalOrderId?: string;
      };
      expect(payload.bookingId).toBe(observedBookingId);
      expect(payload.paypalOrderId).toBe(MOCK_PAYPAL_ORDER_ID);
      captureSeen = true;

      const { error: updateError } = await getAdminClient()
        .from('bookings')
        .update({
          status: 'PAID',
          payment_method: 'paypal',
          tid: MOCK_PAYPAL_CAPTURE_ID,
        })
        .eq('id', observedBookingId);

      if (updateError) throw updateError;

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
    await page.goto(
      `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
      { waitUntil: 'networkidle' }
    );

    const paypalOption = page.getByRole('button', { name: /PayPal/ }).first();
    if (!(await paypalOption.isVisible().catch(() => false))) {
      test.skip(true, 'PayPal is not enabled in the current runtime.');
    }

    await page.locator('input[type="text"]').fill(customerUser.fullName);
    await page.locator('input[type="tel"]').fill(customerUser.phone);
    await page.getByText('호스트와의 직접 연락 및 플랫폼 외부 결제는 금지').click();
    await page.getByText('플랫폼 내 게스트 안전 가이드라인을 숙지하였으며').click();
    await page.getByText('구매 조건, 취소/환불 규정을 모두 확인하였으며').click();

    await paypalOption.click();
    await expect(
      page.getByText('PayPal 승인 후 결제가 완료되며, 기존 카드/무통장 결제 흐름에는 영향을 주지 않습니다.')
    ).toBeVisible();
    await expect(page.getByTestId('mock-paypal-approve')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('mock-paypal-approve').click();

    await expect
      .poll(async () => {
        const { data, error } = await getAdminClient()
          .from('bookings')
          .select('status, payment_method, tid')
          .eq('id', observedBookingId)
          .maybeSingle();

        if (error) throw error;
        return data;
      })
      .toMatchObject({
        status: 'PAID',
        payment_method: 'paypal',
        tid: MOCK_PAYPAL_CAPTURE_ID,
      });

    await page.waitForURL(
      new RegExp(`/experiences/${experience.experienceId}/payment/complete\\?orderId=${observedBookingId}`),
      { timeout: 15000 }
    );

    expect(createOrderSeen).toBe(true);
    expect(captureSeen).toBe(true);
    await expect(page.getByRole('heading', { name: /예약이 확정되었습니다!|Payment Complete!/ })).toBeVisible();
    await expect(page.getByText(observedBookingId)).toBeVisible();
    await expect(page.getByText(experience.title)).toBeVisible();
  });
});
