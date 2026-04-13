import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  loadTestEnv,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdHostApplicationIds: number[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];
const CRON_SECRET = loadTestEnv().CRON_SECRET?.trim() || null;

async function createApprovedHostApplication(userId: string, user: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990-01-01',
      email: user.email,
      instagram: '@codex_settlement_fail_closed',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '정산 동기화 fail-closed 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '정산 동기화 fail-closed 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function seedServiceBooking(params: {
  customerId: string;
  hostId: string;
  host: E2ETestUser;
  date: Date;
}) {
  const supabase = getTestAdminClient();
  const timestamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Settlement Fail Closed ${timestamp}`,
      description: '정산 동기화 fail-closed 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(params.date),
      start_time: '14:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'matched',
      selected_host_id: params.hostId,
      contact_name: params.host.fullName,
      contact_phone: params.host.phone,
      created_at: params.date.toISOString(),
      updated_at: params.date.toISOString(),
    })
    .select('id')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create service request.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: params.hostId,
      appeal_message: '정산 동기화 fail-closed 검증용 지원입니다.',
      status: 'selected',
      created_at: params.date.toISOString(),
      updated_at: params.date.toISOString(),
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create service application.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `SETTLEMENT-FAIL-CLOSED-SVC-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestRow.id,
    application_id: applicationRow.id,
    customer_id: params.customerId,
    host_id: params.hostId,
    amount: 180000,
    host_payout_amount: 110000,
    platform_revenue: 70000,
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'card',
    created_at: params.date.toISOString(),
    updated_at: params.date.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    bookingId,
    orderId: bookingId,
  };
}

async function postAdminSync(
  page: Page,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
) {
  return page.evaluate(
    async ({ payload, headers }) => {
      const response = await fetch('/api/admin/settlement-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    },
    { payload: body, headers: extraHeaders || {} }
  );
}

async function fetchSettlementSyncHealth(page: Page, extraHeaders?: Record<string, string>) {
  return page.evaluate(
    async ({ headers }) => {
      const response = await fetch('/api/admin/settlement-sync', {
        headers: headers || {},
        credentials: 'include',
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    },
    { headers: extraHeaders || {} }
  );
}

async function openSettlementSyncPanel(page: Page) {
  await expect(page.getByTestId('settlement-sync-panel')).toBeVisible();

  const details = page.getByTestId('settlement-sync-details');
  if (!(await details.isVisible())) {
    await page.getByTestId('settlement-sync-toggle').click();
  }

  await expect(details).toBeVisible();
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

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

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Settlement sync fail-closed', () => {
  test('shows infra banner and returns 503 when admin_job_runs is unavailable', async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('settlement.failclosed.admin');
    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    createdAuthUserIds.push(adminId);

    await login(page, adminUser);
    const healthResponse = await fetchSettlementSyncHealth(page, {
      'x-locally-test-simulate-missing-admin-job-runs': '1',
    });

    expect(healthResponse.status).toBe(503);
    expect(String(healthResponse.body.error || '')).toContain('정산 동기화 인프라');

    await page.route('**/api/admin/settlement-sync', async (route) => {
      const headers = {
        ...route.request().headers(),
        'x-locally-test-simulate-missing-admin-job-runs': '1',
      };
      await route.continue({ headers });
    });

    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('settlement-sync-summary')).toContainText('점검판을 열어 확인하세요');
    await openSettlementSyncPanel(page);
    await expect(page.getByTestId('settlement-sync-infra-banner')).toBeVisible();
    await expect(page.getByTestId('settlement-sync-run-due-experience')).toBeDisabled();
    await expect(page.getByTestId('settlement-sync-force-submit')).toBeDisabled();

    if (CRON_SECRET) {
      const cronResponse = await request.get('/api/cron/complete-trips', {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
          'x-locally-test-simulate-missing-admin-job-runs': '1',
        },
      });

      expect(cronResponse.status()).toBe(503);

      const body = await cronResponse.json();
      expect(String(body.error || '')).toContain('정산 동기화 인프라');
    }
  });

  test('returns 503 when service completion RPC is unavailable', async ({ page, request }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('settlement.failclosed.admin2');
    const hostUser = createTestUser('settlement.failclosed.host');
    const customerUser = createTestUser('settlement.failclosed.customer');
    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, hostId, customerId);

    await createApprovedHostApplication(hostId, hostUser);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    const serviceFixture = await seedServiceBooking({
      customerId,
      hostId,
      host: hostUser,
      date: pastDate,
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    const postResponse = await postAdminSync(
      page,
      {
        mode: 'force_one',
        domain: 'service',
        identifier: serviceFixture.orderId,
      },
      {
        'x-locally-test-simulate-missing-service-completion-rpc': '1',
      }
    );

    expect(postResponse.status).toBe(503);
    expect(String(postResponse.body.error || '')).toContain('정산 동기화 인프라');

    if (CRON_SECRET) {
      const cronResponse = await request.get('/api/cron/complete-services', {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
          'x-locally-test-simulate-missing-service-completion-rpc': '1',
        },
      });

      expect(cronResponse.status()).toBe(503);
      const body = await cronResponse.json();
      expect(String(body.error || '')).toContain('정산 동기화 인프라');
    }
  });
});
