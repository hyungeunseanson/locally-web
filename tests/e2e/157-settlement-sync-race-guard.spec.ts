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
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
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
      dob: '1990-01-01',
      email: user.email,
      instagram: '@codex_settlement_race',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '정산 완료 race guard 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '정산 완료 race guard 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Settlement Sync Race ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '정산 완료 race guard 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'race guard 검증 코스입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 30000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'approved',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function seedExperienceBooking(params: {
  customerId: string;
  customer: E2ETestUser;
  experienceId: number;
  date: Date;
  time?: string;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `SETTLEMENT-RACE-EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.customerId,
    experience_id: params.experienceId,
    amount: 120000,
    total_price: 120000,
    total_experience_price: 120000,
    status: 'confirmed',
    guests: 1,
    date: formatDate(params.date),
    time: params.time || '10:00',
    type: 'group',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    message: '',
    created_at: params.date.toISOString(),
    payment_method: 'card',
    host_payout_amount: 90000,
    platform_revenue: 30000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
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
      title: `[Playwright] Settlement Race Service ${timestamp}`,
      description: '정산 완료 race guard 검증용 의뢰입니다.',
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
      appeal_message: '정산 완료 race guard 검증용 지원입니다.',
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

  const bookingId = `SETTLEMENT-RACE-SVC-${timestamp}`;
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
    requestId: requestRow.id,
  };
}

async function postAdminSync(page: Page, body: Record<string, unknown>, delayMs?: number) {
  return page.evaluate(
    async ({ payload, delay }) => {
      const response = await fetch('/api/admin/settlement-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(delay ? { 'x-locally-test-delay-settlement-sync-ms': String(delay) } : {}),
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    },
    { payload: body, delay: delayMs || 0 }
  );
}

async function fetchPayoutQueue(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/admin/payout-queue', {
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

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
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

test.describe.serial('Settlement sync race guard', () => {
  test('prevents duplicate completion across cron/manual and rejects overlapping batch runs', async ({ page, request }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('settlement.race.admin');
    const hostUser = createTestUser('settlement.race.host');
    const customerUser = createTestUser('settlement.race.customer');
    const batchCustomerUser = createTestUser('settlement.race.batch.customer');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    const batchCustomerId = await createAuthUser(batchCustomerUser);
    createdAuthUserIds.push(adminId, hostId, customerId, batchCustomerId);

    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    const experienceRaceBookingId = await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId,
      date: pastDate,
    });
    const experienceBatchBookingId = await seedExperienceBooking({
      customerId: batchCustomerId,
      customer: batchCustomerUser,
      experienceId,
      date: pastDate,
      time: '16:00',
    });
    const serviceFixture = await seedServiceBooking({
      customerId,
      hostId,
      host: hostUser,
      date: pastDate,
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    const env = loadTestEnv();
    const cronSecret = env.CRON_SECRET || 'codex-cron-secret';

    const cronExperiencePromise = request.get('/api/cron/complete-trips', {
      headers: {
        authorization: `Bearer ${cronSecret}`,
        'x-locally-test-delay-settlement-sync-ms': '700',
      },
    });
    await page.waitForTimeout(120);
    const manualExperiencePromise = postAdminSync(page, {
      mode: 'force_one',
      domain: 'experience',
      identifier: experienceRaceBookingId,
    });

    const [cronExperience, manualExperience] = await Promise.all([
      cronExperiencePromise,
      manualExperiencePromise,
    ]);

    expect(cronExperience.ok()).toBeTruthy();
    expect(manualExperience.status).toBe(200);
    expect(['completed', 'already_processed']).toContain(manualExperience.body.outcome);

    const supabase = getTestAdminClient();
    const [experienceRow, reviewRequestRows] = await Promise.all([
      supabase.from('bookings').select('status').eq('id', experienceRaceBookingId).maybeSingle(),
      supabase
        .from('notifications')
        .select('id')
        .eq('user_id', customerId)
        .eq('type', 'review_request'),
    ]);

    if (experienceRow.error) throw experienceRow.error;
    if (reviewRequestRows.error) throw reviewRequestRows.error;

    expect(experienceRow.data?.status).toBe('completed');
    expect(reviewRequestRows.data || []).toHaveLength(1);

    const cronServicePromise = request.get('/api/cron/complete-services', {
      headers: {
        authorization: `Bearer ${cronSecret}`,
        'x-locally-test-delay-settlement-sync-ms': '700',
      },
    });
    await page.waitForTimeout(120);
    const manualServicePromise = postAdminSync(page, {
      mode: 'force_one',
      domain: 'service',
      identifier: serviceFixture.orderId,
    });

    const [cronService, manualService] = await Promise.all([cronServicePromise, manualServicePromise]);

    expect(cronService.ok()).toBeTruthy();
    expect(manualService.status).toBe(200);
    expect(['completed', 'already_processed']).toContain(manualService.body.outcome);

    const [serviceBookingRow, serviceRequestRow] = await Promise.all([
      supabase.from('service_bookings').select('status').eq('id', serviceFixture.bookingId).maybeSingle(),
      supabase.from('service_requests').select('status').eq('id', serviceFixture.requestId).maybeSingle(),
    ]);

    if (serviceBookingRow.error) throw serviceBookingRow.error;
    if (serviceRequestRow.error) throw serviceRequestRow.error;

    expect(serviceBookingRow.data?.status).toBe('completed');
    expect(serviceRequestRow.data?.status).toBe('completed');

    const payoutQueue = await fetchPayoutQueue(page);
    expect(payoutQueue.status).toBe(200);
    expect(payoutQueue.body.success).toBeTruthy();

    const hostRow = (payoutQueue.body.combinedHostTotals || []).find(
      (row: { host_id: string }) => row.host_id === hostId
    );
    expect(hostRow).toBeTruthy();
    expect(
      (hostRow.domains?.service?.pending_entries || []).filter(
        (entry: { id: string }) => entry.id === serviceFixture.bookingId
      )
    ).toHaveLength(1);

    const firstBatchPromise = postAdminSync(
      page,
      {
        mode: 'run_due',
        domain: 'experience',
      },
      700
    );
    await page.waitForTimeout(120);
    const secondBatchPromise = postAdminSync(page, {
      mode: 'run_due',
      domain: 'experience',
    });

    const [firstBatch, secondBatch] = await Promise.all([firstBatchPromise, secondBatchPromise]);
    const batchStatuses = [firstBatch.status, secondBatch.status].sort((a, b) => a - b);
    expect(batchStatuses).toEqual([200, 409]);

    const batchBookingRow = await supabase
      .from('bookings')
      .select('status')
      .eq('id', experienceBatchBookingId)
      .maybeSingle();

    if (batchBookingRow.error) throw batchBookingRow.error;
    expect(batchBookingRow.data?.status).toBe('completed');
  });
});
