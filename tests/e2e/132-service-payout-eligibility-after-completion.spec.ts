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
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];

async function createApprovedHostApplication(userId: string, host: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1991-01-01',
      email: host.email,
      instagram: '@codex_service_payout',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '서비스 정산 eligibility 검증용 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: '서비스 정산 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createPendingServiceFixture(params: { customerId: string; hostId: string }) {
  const supabase = getTestAdminClient();
  const timestamp = Date.now();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Service Payout Guard ${timestamp}`,
      description: '서비스 완료 전 정산 차단 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(futureDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'paid',
      selected_host_id: params.hostId,
    })
    .select('id')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create payout eligibility request.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: params.hostId,
      appeal_message: '서비스 정산 eligibility 검증용 지원입니다.',
      status: 'selected',
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create payout eligibility application.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `SVC-PAYOUT-GUARD-${timestamp}`;
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
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return { requestId: requestRow.id, bookingId };
}

async function fetchPayoutQueue(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/admin/payout-queue');
    return {
      status: response.status,
      body: await response.json(),
    };
  });
}

async function markServicePayout(page: Page, bookingId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch('/api/admin/service-payouts/mark-paid', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bookingIds: [id] }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, bookingId);
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

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Service payout eligibility after completion', () => {
  test('keeps PAID services out of payout queue until completion and allows payout after cron', async ({ page, request }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('service.payout.admin');
    const customerUser = createTestUser('service.payout.customer');
    const hostUser = createTestUser('service.payout.host');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser);
    createdAuthUserIds.push(adminId, customerId, hostId);
    createdWhitelistEmails.push(adminUser.email);

    await createApprovedHostApplication(hostId, hostUser);
    const fixture = await createPendingServiceFixture({ customerId, hostId });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    const preCompletePayout = await markServicePayout(page, fixture.bookingId);
    expect(preCompletePayout.status).toBe(409);
    expect(preCompletePayout.body.error).toMatch(/정산 완료 처리할 수 없는 예약/);

    const preCompleteQueue = await fetchPayoutQueue(page);
    expect(preCompleteQueue.status).toBe(200);
    expect(preCompleteQueue.body.success).toBeTruthy();
    expect(
      (preCompleteQueue.body.combinedHostTotals || []).some((row: { host_id: string; domains?: { service?: { pending_entries?: Array<{ id: string }> } | null } }) =>
        row.host_id === hostId &&
        (row.domains?.service?.pending_entries || []).some((entry) => entry.id === fixture.bookingId)
      )
    ).toBeFalsy();

    const supabase = getTestAdminClient();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const { error: requestDateError } = await supabase
      .from('service_requests')
      .update({ service_date: formatDate(pastDate) })
      .eq('id', fixture.requestId);

    if (requestDateError) throw requestDateError;

    const env = loadTestEnv();
    const cronSecret = env.CRON_SECRET || 'codex-cron-secret';
    const cronResponse = await request.get('/api/cron/complete-services', {
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });

    expect(cronResponse.ok()).toBeTruthy();

    const postCompleteQueue = await fetchPayoutQueue(page);
    expect(postCompleteQueue.status).toBe(200);
    expect(postCompleteQueue.body.success).toBeTruthy();

    const hostRow = (postCompleteQueue.body.combinedHostTotals || []).find(
      (row: { host_id: string }) => row.host_id === hostId
    );
    expect(hostRow).toBeTruthy();
    expect(hostRow.settlement_state).toBe('eligible');
    expect(hostRow.domains.service.pending_entries.some((entry: { id: string }) => entry.id === fixture.bookingId)).toBeTruthy();

    const postCompletePayout = await markServicePayout(page, fixture.bookingId);
    expect(postCompletePayout.status).toBe(200);
    expect(postCompletePayout.body.success).toBeTruthy();

    const { data: bookingRow, error: bookingError } = await supabase
      .from('service_bookings')
      .select('*')
      .eq('id', fixture.bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;

    expect(bookingRow?.status).toBe('completed');
    expect(bookingRow?.payout_status).toBe('paid');
    expect(bookingRow?.payout_paid_at).toBeTruthy();
  });
});
