import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdHostApplicationIds: number[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];

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
      dob: '1991-01-01',
      email: user.email,
      instagram: '@codex_host_service_earnings',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 서비스 수익 분리 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 서비스 수익 검증',
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
  hostId: string;
  host: E2ETestUser;
  customerId: string;
  status: 'PAID' | 'confirmed' | 'completed';
  payoutStatus: 'pending' | 'paid';
  payoutAmount: number;
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const timestamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const requestStatus = params.status === 'completed' ? 'completed' : 'matched';

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Host Service Earnings ${timestamp}`,
      description: '호스트 서비스 수익 분리 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(params.createdAt),
      start_time: '14:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: requestStatus,
      selected_host_id: params.hostId,
      contact_name: params.host.fullName,
      contact_phone: params.host.phone,
      created_at: params.createdAt.toISOString(),
      updated_at: params.createdAt.toISOString(),
    })
    .select('id, title')
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
      appeal_message: '호스트 서비스 수익 분리 검증용 지원입니다.',
      status: 'selected',
      created_at: params.createdAt.toISOString(),
      updated_at: params.createdAt.toISOString(),
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create service application.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `HOST-SERVICE-EARNING-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestRow.id,
    application_id: applicationRow.id,
    customer_id: params.customerId,
    host_id: params.hostId,
    amount: params.payoutAmount + 40000,
    host_payout_amount: params.payoutAmount,
    platform_revenue: 40000,
    status: params.status,
    payout_status: params.payoutStatus,
    payout_paid_at: params.payoutStatus === 'paid' ? params.createdAt.toISOString() : null,
    payment_method: 'card',
    created_at: params.createdAt.toISOString(),
    updated_at: params.createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    bookingId,
    requestId: requestRow.id,
    title: requestRow.title || `[Playwright] Host Service Earnings ${timestamp}`,
  };
}

async function fetchHostServiceEarnings(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/host/earnings/services', {
      method: 'GET',
      credentials: 'include',
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  });
}

async function fetchHostUnifiedEarnings(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/host/earnings/summary', {
      method: 'GET',
      credentials: 'include',
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  });
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

test.describe.serial('Host service earnings separation', () => {
  test('shows host-scoped service settlement data in unified earnings with a separate service drilldown', async ({ page, request }) => {
    test.setTimeout(120000);

    const hostAUser = createTestUser('host.service.earnings.a');
    const hostBUser = createTestUser('host.service.earnings.b');
    const customerAUser = createTestUser('host.service.earnings.customer.a');
    const customerBUser = createTestUser('host.service.earnings.customer.b');

    const hostAId = await createAuthUser(hostAUser);
    const hostBId = await createAuthUser(hostBUser);
    const customerAId = await createAuthUser(customerAUser);
    const customerBId = await createAuthUser(customerBUser);
    createdAuthUserIds.push(hostAId, hostBId, customerAId, customerBId);

    await createApprovedHostApplication(hostAId, hostAUser);
    await createApprovedHostApplication(hostBId, hostBUser);

    const inProgressFixture = await seedServiceBooking({
      hostId: hostAId,
      host: hostAUser,
      customerId: customerAId,
      status: 'PAID',
      payoutStatus: 'pending',
      payoutAmount: 70000,
      createdAt: new Date('2026-04-05T09:00:00.000Z'),
    });

    const pendingFixture = await seedServiceBooking({
      hostId: hostAId,
      host: hostAUser,
      customerId: customerAId,
      status: 'completed',
      payoutStatus: 'pending',
      payoutAmount: 90000,
      createdAt: new Date('2026-04-06T09:00:00.000Z'),
    });

    const paidFixture = await seedServiceBooking({
      hostId: hostAId,
      host: hostAUser,
      customerId: customerAId,
      status: 'completed',
      payoutStatus: 'paid',
      payoutAmount: 80000,
      createdAt: new Date('2026-04-07T09:00:00.000Z'),
    });

    const foreignFixture = await seedServiceBooking({
      hostId: hostBId,
      host: hostBUser,
      customerId: customerBId,
      status: 'completed',
      payoutStatus: 'pending',
      payoutAmount: 99000,
      createdAt: new Date('2026-04-08T09:00:00.000Z'),
    });

    const unauthorizedResponse = await request.get('/api/host/earnings/services');
    expect(unauthorizedResponse.status()).toBe(401);

    await login(page, hostAUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('host-earnings-summary-pending-payout')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-summary-in-progress')).toContainText('₩0');

    await page.getByTestId('host-earnings-tab-service').click();
    await expect(page.getByTestId('host-service-earnings-total-pending')).toContainText('₩90,000');
    await expect(page.getByTestId('host-service-earnings-in-progress')).toContainText('₩70,000');
    await expect(page.getByTestId('host-service-earnings-paid')).toContainText('₩80,000');

    const summaryResponse = await fetchHostUnifiedEarnings(page);
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.success).toBeTruthy();
    expect(summaryResponse.body.summary).toMatchObject({
      total_pending_payout_amount: 90000,
      total_in_progress_amount: 70000,
      total_paid_amount: 80000,
      service: {
        pending_payout_amount: 90000,
        in_progress_amount: 70000,
        paid_payout_amount: 80000,
        completed_service_count: 2,
        payout_item_count: 3,
      },
    });

    const routeResponse = await fetchHostServiceEarnings(page);
    expect(routeResponse.status).toBe(200);
    expect(routeResponse.body.success).toBeTruthy();
    expect(routeResponse.body.summary).toMatchObject({
      in_progress_amount: 70000,
      pending_payout_amount: 90000,
      paid_payout_amount: 80000,
      completed_service_count: 2,
      payout_item_count: 3,
    });

    const returnedIds = (routeResponse.body.items || []).map((item: { id: string }) => item.id);
    expect(returnedIds).toEqual(
      expect.arrayContaining([inProgressFixture.bookingId, pendingFixture.bookingId, paidFixture.bookingId])
    );
    expect(returnedIds).not.toContain(foreignFixture.bookingId);

    const stageMap = new Map(
      (routeResponse.body.items || []).map((item: { id: string; settlement_stage: string }) => [
        item.id,
        item.settlement_stage,
      ])
    );
    expect(stageMap.get(inProgressFixture.bookingId)).toBe('in_progress');
    expect(stageMap.get(pendingFixture.bookingId)).toBe('pending');
    expect(stageMap.get(paidFixture.bookingId)).toBe('paid');

    await page.getByTestId('host-earnings-tab-service').click();

    await expect(page.getByTestId('host-service-earnings-scope-note')).toContainText(
      /완료 후 정산 대기로 넘어간 금액|completed pending payouts|完了後の精算待ち金額|已完成后的待结算金额/
    );
    await expect(page.getByTestId('host-service-earnings-total-pending')).toContainText('₩90,000');
    await expect(page.getByTestId('host-service-earnings-in-progress')).toContainText('₩70,000');
    await expect(page.getByTestId('host-service-earnings-paid')).toContainText('₩80,000');
    await expect(page.getByTestId('host-service-earnings-completed-count')).toContainText(/2/);
    await expect(page.getByTestId('host-service-earnings-payout-items')).toContainText(/3/);

    await expect(page.getByTestId(`host-service-earnings-item-${inProgressFixture.bookingId}`)).toBeVisible();
    await expect(page.getByTestId(`host-service-earnings-item-${pendingFixture.bookingId}`)).toBeVisible();
    await expect(page.getByTestId(`host-service-earnings-item-${paidFixture.bookingId}`)).toBeVisible();
    await expect(page.getByTestId(`host-service-earnings-item-${foreignFixture.bookingId}`)).toHaveCount(0);

    await expect(page.getByTestId(`host-service-earnings-stage-${inProgressFixture.bookingId}`)).toContainText(
      /진행 중|In Progress|進行中|进行中/
    );
    await expect(page.getByTestId(`host-service-earnings-stage-${pendingFixture.bookingId}`)).toContainText(
      /정산 대기|Pending Payout|精算待ち|待结算/
    );
    await expect(page.getByTestId(`host-service-earnings-stage-${paidFixture.bookingId}`)).toContainText(
      /지급 완료|Paid|支払い完了|已完成支付/
    );
  });
});
