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
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
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
      instagram: '@codex_unified_payout_queue',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '통합 정산 큐 검증용 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: '통합 정산 큐 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(data.id);
}

async function createExperienceFixture(hostId: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Unified Payout Queue ${Date.now()}`,
      category: '도보 투어',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 6,
      description: '통합 정산 큐 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: '통합 정산 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울 중구 한강대로 405',
      photos: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200'],
      price: 50000,
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
    throw error || new Error('Failed to create unified payout experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createExperiencePayoutFixture(params: {
  hostId: string;
  guestId: string;
  guest: E2ETestUser;
  experienceId: number;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `EXP-UNIFIED-PAYOUT-${Date.now()}`;
  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - 4);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 55000,
    total_price: 50000,
    total_experience_price: 50000,
    status: 'completed',
    guests: 1,
    date: formatDate(completedAt),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: completedAt.toISOString(),
    payment_method: 'card',
    host_payout_amount: 40000,
    platform_revenue: 15000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function createCompletedServicePayoutFixture(params: {
  hostId: string;
  customerId: string;
  customer: E2ETestUser;
}) {
  const supabase = getTestAdminClient();
  const timestamp = Date.now();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 6);

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Unified Service ${timestamp}`,
      description: '통합 정산 큐 검증용 서비스 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(pastDate),
      start_time: '09:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'completed',
      selected_host_id: params.hostId,
      contact_name: params.customer.fullName,
    })
    .select('id')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create unified payout service request.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: params.hostId,
      appeal_message: '통합 정산 큐 검증용 서비스 지원입니다.',
      status: 'selected',
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create unified payout application.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `SVC-UNIFIED-PAYOUT-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestRow.id,
    application_id: applicationRow.id,
    customer_id: params.customerId,
    host_id: params.hostId,
    amount: 180000,
    host_payout_amount: 70000,
    platform_revenue: 110000,
    status: 'completed',
    payout_status: 'pending',
    payment_method: 'bank',
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);
  return bookingId;
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
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
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

test.describe.serial('Admin payout queue unified host rollup', () => {
  test('rolls up experience and service pending payouts for the same host', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('admin.unified.payout');
    const guestUser = createTestUser('guest.unified.payout');
    const hostUser = createTestUser('host.unified.payout');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const guestId = await createAuthUser(guestUser);
    const hostId = await createAuthUser(hostUser);
    createdAuthUserIds.push(adminId, guestId, hostId);
    createdWhitelistEmails.push(adminUser.email);

    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);
    const experienceBookingId = await createExperiencePayoutFixture({
      hostId,
      guestId,
      guest: guestUser,
      experienceId,
    });
    const serviceBookingId = await createCompletedServicePayoutFixture({
      hostId,
      customerId: guestId,
      customer: guestUser,
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    const queue = await fetchPayoutQueue(page);
    expect(queue.status).toBe(200);
    expect(queue.body.success).toBeTruthy();

    const hostRow = (queue.body.combinedHostTotals || []).find(
      (row: { host_id: string }) => row.host_id === hostId
    );

    expect(hostRow).toBeTruthy();
    expect(hostRow.pending_amount).toBe(110000);
    expect(hostRow.pending_count).toBe(2);
    expect(hostRow.settlement_state).toBe('eligible');
    expect(hostRow.domains.experience.pending_amount).toBe(40000);
    expect(hostRow.domains.service.pending_amount).toBe(70000);
    expect(hostRow.domains.experience.pending_entries.some((entry: { id: string }) => entry.id === experienceBookingId)).toBeTruthy();
    expect(hostRow.domains.service.pending_entries.some((entry: { id: string }) => entry.id === serviceBookingId)).toBeTruthy();
  });
});
