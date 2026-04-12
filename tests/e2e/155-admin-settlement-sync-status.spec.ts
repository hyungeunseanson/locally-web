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
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];
const createdJobRunIds: number[] = [];

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
      instagram: '@codex_settlement_sync',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '정산 완료 동기화 상태 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '정산 완료 동기화 상태 검증',
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
      title: `[Playwright] Settlement Sync Status ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '정산 완료 동기화 상태 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '상태 검증용 코스입니다.' }],
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
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `SETTLEMENT-SYNC-EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    date: formatDate(params.createdAt),
    time: '10:00',
    type: 'group',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    message: '',
    created_at: params.createdAt.toISOString(),
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
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const timestamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Settlement Sync Service ${timestamp}`,
      description: '정산 완료 동기화 상태 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(params.createdAt),
      start_time: '14:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'matched',
      selected_host_id: params.hostId,
      contact_name: params.host.fullName,
      contact_phone: params.host.phone,
      created_at: params.createdAt.toISOString(),
      updated_at: params.createdAt.toISOString(),
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
      appeal_message: '정산 완료 동기화 상태 검증용 지원입니다.',
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

  const bookingId = `SETTLEMENT-SYNC-SVC-${timestamp}`;
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
    created_at: params.createdAt.toISOString(),
    updated_at: params.createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);
  return bookingId;
}

async function insertJobRunFixture(params: {
  jobName: 'experience_completion_sync' | 'service_completion_sync';
  scope: 'experience' | 'service';
  status: 'running' | 'success' | 'failed' | 'abandoned';
  startedAt: string;
  finishedAt?: string;
  processedCount?: number;
  skippedCount?: number;
  errorMessage?: string;
  leaseExpiresAt?: string;
  lastHeartbeatAt?: string;
}) {
  const supabase = getTestAdminClient();
  const tableInsert = await supabase
    .from('admin_job_runs')
    .insert({
      job_name: params.jobName,
      trigger_source: 'cron',
      scope: params.scope,
      status: params.status,
      started_at: params.startedAt,
      finished_at: params.finishedAt || null,
      duration_ms: params.finishedAt
        ? Math.max(0, new Date(params.finishedAt).getTime() - new Date(params.startedAt).getTime())
        : null,
      initiated_by_admin_id: null,
      target_identifier: null,
      processed_count: params.processedCount || 0,
      skipped_count: params.skippedCount || 0,
      error_message: params.errorMessage || null,
      details: {},
      lease_token: crypto.randomUUID(),
      lease_expires_at:
        params.leaseExpiresAt || params.finishedAt || new Date(Date.now() + 60_000).toISOString(),
      last_heartbeat_at: params.lastHeartbeatAt || params.startedAt,
    })
    .select('id')
    .single();

  if (tableInsert.error || !tableInsert.data?.id) {
    throw tableInsert.error || new Error('Failed to create settlement sync job run fixture.');
  }

  createdJobRunIds.push(Number(tableInsert.data.id));
}

async function fetchStatus(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/admin/settlement-sync', {
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

  if (createdJobRunIds.length > 0) {
    await supabase.from('admin_job_runs').delete().in('id', createdJobRunIds);
  }

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

test.describe.serial('Admin settlement sync status visibility', () => {
  test('shows delayed and stale sync health in Sales tab and protects the admin API', async ({ page, request }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('settlement.sync.admin');
    const hostUser = createTestUser('settlement.sync.host');
    const customerUser = createTestUser('settlement.sync.customer');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, hostId, customerId);

    await createApprovedHostApplication(hostId, hostUser);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const experienceId = await createExperienceFixture(hostId);
    await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId,
      createdAt: pastDate,
    });
    await seedServiceBooking({
      customerId,
      hostId,
      host: hostUser,
      createdAt: pastDate,
    });

    const now = Date.now();
    await insertJobRunFixture({
      jobName: 'experience_completion_sync',
      scope: 'experience',
      status: 'success',
      startedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      finishedAt: new Date(now - 5 * 60 * 60 * 1000 + 10_000).toISOString(),
      processedCount: 2,
      skippedCount: 0,
    });
    await insertJobRunFixture({
      jobName: 'service_completion_sync',
      scope: 'service',
      status: 'failed',
      startedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      finishedAt: new Date(now - 4 * 60 * 60 * 1000 + 5_000).toISOString(),
      processedCount: 0,
      skippedCount: 1,
      errorMessage: '서비스 완료 동기화 실패 테스트',
    });
    await insertJobRunFixture({
      jobName: 'service_completion_sync',
      scope: 'service',
      status: 'running',
      startedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      leaseExpiresAt: new Date(now - 5 * 60 * 1000).toISOString(),
      lastHeartbeatAt: new Date(now - 10 * 60 * 1000).toISOString(),
    });

    const unauthorized = await request.get('/api/admin/settlement-sync');
    expect(unauthorized.status()).toBe(401);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('settlement-sync-panel')).toBeVisible();
    await expect(page.getByTestId('settlement-sync-state-experience')).toContainText('지연');
    await expect(page.getByTestId('settlement-sync-state-service')).toContainText('실행 중 멈춤');
    await expect(page.getByTestId('settlement-sync-due-count-experience')).not.toContainText('0건');
    await expect(page.getByTestId('settlement-sync-due-count-service')).not.toContainText('0건');
    await expect(page.getByTestId('settlement-sync-card-service')).toContainText('마지막 heartbeat');

    const status = await fetchStatus(page);
    expect(status.status).toBe(200);
    expect(status.body.success).toBeTruthy();

    const experienceJob = status.body.jobs.find(
      (job: { job_name: string }) => job.job_name === 'experience_completion_sync'
    );
    const serviceJob = status.body.jobs.find(
      (job: { job_name: string }) => job.job_name === 'service_completion_sync'
    );

    expect(experienceJob.health_state).toBe('delayed');
    expect(experienceJob.last_success_at).toBeTruthy();
    expect(experienceJob.due_candidate_count).toBeGreaterThan(0);
    expect(experienceJob.lag_minutes).toBeGreaterThan(120);

    expect(serviceJob.health_state).toBe('running_stale');
    expect(typeof serviceJob.last_failure_message).toBe('string');
    expect(serviceJob.last_failure_message?.length || 0).toBeGreaterThan(0);
    expect(serviceJob.stale_running).toBeTruthy();
    expect(serviceJob.last_heartbeat_at).toBeTruthy();
  });
});
