import { expect, test } from '@playwright/test';

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
      instagram: '@codex_settlement_force',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '정산 완료 force-sync 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '정산 완료 force-sync 검증',
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
      title: `[Playwright] Settlement Sync Force ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '정산 완료 force-sync 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: 'force-sync 검증 코스입니다.' }],
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
  status?: 'confirmed' | 'PAID';
}) {
  const supabase = getTestAdminClient();
  const bookingId = `SETTLEMENT-FORCE-EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.customerId,
    experience_id: params.experienceId,
    amount: 120000,
    total_price: 120000,
    total_experience_price: 120000,
    status: params.status || 'confirmed',
    guests: 1,
    date: formatDate(params.date),
    time: '10:00',
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
      title: `[Playwright] Settlement Force Service ${timestamp}`,
      description: '정산 완료 force-sync 검증용 의뢰입니다.',
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
      appeal_message: '정산 완료 force-sync 검증용 지원입니다.',
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

  const bookingId = `SETTLEMENT-FORCE-SVC-${timestamp}`;
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

async function submitForceSyncForm(page: Page, domain: 'auto' | 'experience' | 'service', identifier: string) {
  await page.getByTestId('settlement-sync-force-domain').selectOption(domain);
  await page.getByTestId('settlement-sync-force-identifier').fill(identifier);
  await page.getByTestId('settlement-sync-force-submit').click();
  await expect(page.getByTestId('settlement-sync-result-banner')).toBeVisible();
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

test.describe.serial('Admin settlement sync manual trigger', () => {
  test('forces due completions safely and rejects future targets', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('settlement.force.admin');
    const hostUser = createTestUser('settlement.force.host');
    const customerUser = createTestUser('settlement.force.customer');
    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, hostId, customerId);

    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 4);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);

    const pastExperienceBookingId = await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId,
      date: pastDate,
    });
    const futureExperienceBookingId = await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId,
      date: futureDate,
    });
    const serviceFixture = await seedServiceBooking({
      customerId,
      hostId,
      host: hostUser,
      date: pastDate,
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });

    await submitForceSyncForm(page, 'auto', futureExperienceBookingId);
    await expect(page.getByTestId('settlement-sync-result-banner')).toContainText('아직 완료 시점 전');

    const supabase = getTestAdminClient();
    const futureRow = await supabase
      .from('bookings')
      .select('status')
      .eq('id', futureExperienceBookingId)
      .maybeSingle();
    if (futureRow.error) throw futureRow.error;
    expect(futureRow.data?.status).toBe('confirmed');

    await submitForceSyncForm(page, 'experience', pastExperienceBookingId);
    await expect(page.getByTestId('settlement-sync-result-banner')).toContainText('체험 완료 동기화를 1건 반영했습니다.');

    const pastRow = await supabase
      .from('bookings')
      .select('status')
      .eq('id', pastExperienceBookingId)
      .maybeSingle();
    if (pastRow.error) throw pastRow.error;
    expect(pastRow.data?.status).toBe('completed');

    await submitForceSyncForm(page, 'auto', serviceFixture.orderId);
    await expect(page.getByTestId('settlement-sync-result-banner')).toContainText('서비스 완료 동기화를 1건 반영했습니다.');

    const [serviceBookingRow, serviceRequestRow] = await Promise.all([
      supabase.from('service_bookings').select('status').eq('id', serviceFixture.bookingId).maybeSingle(),
      supabase.from('service_requests').select('status').eq('id', serviceFixture.requestId).maybeSingle(),
    ]);

    if (serviceBookingRow.error) throw serviceBookingRow.error;
    if (serviceRequestRow.error) throw serviceRequestRow.error;

    expect(serviceBookingRow.data?.status).toBe('completed');
    expect(serviceRequestRow.data?.status).toBe('completed');

    await submitForceSyncForm(page, 'auto', serviceFixture.orderId);
    await expect(page.getByTestId('settlement-sync-result-banner')).toContainText('이미 완료 처리된 건입니다.');
  });
});
