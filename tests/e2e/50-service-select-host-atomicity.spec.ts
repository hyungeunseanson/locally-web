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
    email: `codex.service.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Service ${prefix} ${timestamp}`,
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

async function createOpenRequest(customerId: string, customer: TestUser) {
  const supabase = getAdminClient();
  const date = new Date();
  date.setDate(date.getDate() + 10);

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: customerId,
      title: `[Playwright] Select Host Atomic ${Date.now()}`,
      description: '서비스 호스트 선택 원자성 테스트용 의뢰입니다.',
      city: '서울',
      country: 'Korea',
      service_date: formatDate(date),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      contact_name: customer.fullName,
      contact_phone: customer.phone,
      status: 'open',
    })
    .select('id, total_customer_price, total_host_payout')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service request.');
  }

  createdServiceRequestIds.push(data.id);
  return data;
}

async function createApplication(requestId: string, hostId: string, label: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestId,
      host_id: hostId,
      appeal_message: `[Playwright] ${label} 지원입니다.`,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create service application.');
  }

  createdServiceApplicationIds.push(data.id);
  return data.id;
}

async function createEscrowBooking(
  requestId: string,
  customerId: string,
  amount: number,
  hostPayoutAmount: number
) {
  const supabase = getAdminClient();
  const bookingId = `SVC-SELECT-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const { error } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestId,
    customer_id: customerId,
    host_id: null,
    application_id: null,
    amount,
    host_payout_amount: hostPayoutAmount,
    platform_revenue: amount - hostPayoutAmount,
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'card',
  });

  if (error) throw error;
  createdServiceBookingIds.push(bookingId);
  return bookingId;
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

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Service select-host atomic hardening', () => {
  test.setTimeout(120000);

  test('keeps final state consistent when two host selections race', async ({ page }) => {
    const customerUser = createUser('select-customer');
    const hostA = createUser('select-host-a');
    const hostB = createUser('select-host-b');

    const customerId = await createAuthUser(customerUser);
    const hostAId = await createAuthUser(hostA);
    const hostBId = await createAuthUser(hostB);

    const requestRow = await createOpenRequest(customerId, customerUser);
    const applicationAId = await createApplication(requestRow.id, hostAId, 'host-a');
    const applicationBId = await createApplication(requestRow.id, hostBId, 'host-b');
    const bookingId = await createEscrowBooking(
      requestRow.id,
      customerId,
      Number(requestRow.total_customer_price),
      Number(requestRow.total_host_payout)
    );

    await login(page, customerUser);

    const [responseA, responseB] = await Promise.all([
      page.request.post('/api/services/select-host', {
        data: { request_id: requestRow.id, application_id: applicationAId },
      }),
      page.request.post('/api/services/select-host', {
        data: { request_id: requestRow.id, application_id: applicationBId },
      }),
    ]);

    const statuses = [responseA.status(), responseB.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const supabase = getAdminClient();
    const { data: finalRequest, error: requestError } = await supabase
      .from('service_requests')
      .select('status, selected_application_id, selected_host_id')
      .eq('id', requestRow.id)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(finalRequest?.status).toBe('matched');
    expect([applicationAId, applicationBId]).toContain(finalRequest?.selected_application_id);
    expect([hostAId, hostBId]).toContain(finalRequest?.selected_host_id);

    const { data: finalApplications, error: appError } = await supabase
      .from('service_applications')
      .select('id, host_id, status')
      .eq('request_id', requestRow.id)
      .order('id');

    if (appError) throw appError;

    expect(finalApplications?.filter((row) => row.status === 'selected')).toHaveLength(1);
    expect(finalApplications?.filter((row) => row.status === 'rejected')).toHaveLength(1);

    const selectedApplication = finalApplications?.find((row) => row.status === 'selected');
    expect(selectedApplication?.id).toBe(finalRequest?.selected_application_id);
    expect(selectedApplication?.host_id).toBe(finalRequest?.selected_host_id);

    const { data: finalBooking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('host_id, application_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(finalBooking?.host_id).toBe(finalRequest?.selected_host_id);
    expect(finalBooking?.application_id).toBe(finalRequest?.selected_application_id);
  });

  test('rejects host selection when escrow booking is missing without mutating request/application state', async ({ page }) => {
    const customerUser = createUser('missing-booking-customer');
    const hostA = createUser('missing-booking-host-a');
    const hostB = createUser('missing-booking-host-b');

    const customerId = await createAuthUser(customerUser);
    const hostAId = await createAuthUser(hostA);
    const hostBId = await createAuthUser(hostB);

    const requestRow = await createOpenRequest(customerId, customerUser);
    const applicationAId = await createApplication(requestRow.id, hostAId, 'missing-booking-a');
    const applicationBId = await createApplication(requestRow.id, hostBId, 'missing-booking-b');

    await login(page, customerUser);

    const response = await page.request.post('/api/services/select-host', {
      data: { request_id: requestRow.id, application_id: applicationAId },
    });
    const json = await response.json();

    expect(response.status()).toBe(409);
    expect(json.success).toBeFalsy();

    const supabase = getAdminClient();
    const { data: finalRequest, error: requestError } = await supabase
      .from('service_requests')
      .select('status, selected_application_id, selected_host_id')
      .eq('id', requestRow.id)
      .maybeSingle();

    if (requestError) throw requestError;

    expect(finalRequest?.status).toBe('open');
    expect(finalRequest?.selected_application_id).toBeNull();
    expect(finalRequest?.selected_host_id).toBeNull();

    const { data: finalApplications, error: appError } = await supabase
      .from('service_applications')
      .select('id, status')
      .eq('request_id', requestRow.id)
      .order('id');

    if (appError) throw appError;

    expect(finalApplications?.map((row) => row.status)).toEqual(['pending', 'pending']);
    expect(finalApplications?.map((row) => row.id).sort()).toEqual([applicationAId, applicationBId].sort());
  });
});
