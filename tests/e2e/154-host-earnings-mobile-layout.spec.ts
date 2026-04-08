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
      dob: '1991-01-01',
      email: user.email,
      instagram: '@codex_host_mobile_earnings',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 모바일 통합 수익 레이아웃 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 모바일 통합 수익 레이아웃 검증',
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
      title: `[Playwright] Mobile Earnings ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 모바일 통합 수익 레이아웃 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '모바일 통합 수익 검증 코스입니다.' }],
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

async function seedExperiencePendingBooking(params: {
  hostId: string;
  host: E2ETestUser;
  experienceId: number;
  payoutAmount: number;
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `HOST-MOBILE-EARNING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.hostId,
    experience_id: params.experienceId,
    amount: Math.round(params.payoutAmount / 0.8),
    total_price: Math.round(params.payoutAmount / 0.8),
    total_experience_price: Math.round(params.payoutAmount / 0.8),
    status: 'completed',
    guests: 1,
    date: formatDate(params.createdAt),
    time: '10:00',
    type: 'group',
    contact_name: params.host.fullName,
    contact_phone: params.host.phone,
    message: '',
    created_at: params.createdAt.toISOString(),
    payment_method: 'card',
    host_payout_amount: params.payoutAmount,
    platform_revenue: Math.round(params.payoutAmount * 0.25),
    payout_status: 'pending',
    payout_paid_at: null,
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
}

async function seedServicePendingBooking(params: {
  hostId: string;
  host: E2ETestUser;
  customerId: string;
  payoutAmount: number;
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const timestamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Mobile Service Earnings ${timestamp}`,
      description: '호스트 모바일 통합 수익 레이아웃 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(params.createdAt),
      start_time: '14:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'completed',
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
      appeal_message: '호스트 모바일 통합 수익 레이아웃 검증용 지원입니다.',
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

  const bookingId = `HOST-MOBILE-SERVICE-${timestamp}`;
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
    status: 'completed',
    payout_status: 'pending',
    payout_paid_at: null,
    payment_method: 'card',
    created_at: params.createdAt.toISOString(),
    updated_at: params.createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);
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

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host earnings mobile layout', () => {
  test('keeps the unified top summary visible without scroll on mobile', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 390, height: 844 });

    const hostUser = createTestUser('host.mobile.earnings');
    const customerUser = createTestUser('host.mobile.earnings.customer');

    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(hostId, customerId);

    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);

    await seedExperiencePendingBooking({
      hostId,
      host: hostUser,
      experienceId,
      payoutAmount: 24000,
      createdAt: new Date('2026-06-05T09:00:00.000Z'),
    });
    await seedServicePendingBooking({
      hostId,
      host: hostUser,
      customerId,
      payoutAmount: 90000,
      createdAt: new Date('2026-06-06T09:00:00.000Z'),
    });

    await login(page, hostUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('host-earnings-unified-hero')).toBeVisible();
    await expect(page.getByTestId('host-earnings-unified-total')).toContainText('₩114,000');
    await expect(page.getByTestId('host-earnings-breakdown-card')).toBeVisible();
    await expect(page.getByTestId('host-earnings-breakdown-experience-pending')).toContainText('₩24,000');
    await expect(page.getByTestId('host-earnings-breakdown-service-pending')).toContainText('₩90,000');
    await expect(page.getByTestId('host-earnings-breakdown-note')).toContainText(
      /진행 중 금액은 상단 총액에 포함되지 않음|not included in the unified total|上部の合計に含まれません|不计入上方总额/
    );

    await expect(page.getByTestId('host-earnings-tabs')).toHaveCount(0);
    await expect(page.getByTestId('host-earnings-group-2026-06-05')).toHaveCount(0);
    await expect(page.getByTestId('host-service-earnings-item-list')).toHaveCount(0);

    const viewportHeight = page.viewportSize()?.height ?? 844;
    const breakdownBox = await page.getByTestId('host-earnings-breakdown-card').boundingBox();
    expect(breakdownBox).not.toBeNull();
    expect((breakdownBox?.y || 0) + (breakdownBox?.height || 0)).toBeLessThanOrEqual(viewportHeight);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBeFalsy();
  });
});
