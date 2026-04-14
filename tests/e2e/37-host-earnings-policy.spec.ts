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
const createdApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
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

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.earnings.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Earnings ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

async function createApprovedHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
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
      instagram: '@codex_host_earnings',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 수익 탭 정책 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 수익 정책 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title: `[Playwright] Host Earnings ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 수익 탭 정책 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '수익 정책 검증 코스입니다.' }],
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
    throw error || new Error('Failed to create host earnings fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function seedCompletedBooking(params: {
  hostId: string;
  host: TestUser;
  experienceId: number;
  bookingDate?: string;
  createdAt?: Date;
}) {
  const supabase = getAdminClient();
  const bookingId = `HOST-EARNINGS-BOOKING-${Date.now()}`;
  const createdAt = params.createdAt ?? new Date();
  if (!params.createdAt) {
    createdAt.setDate(createdAt.getDate() - 3);
  }
  const bookingDate = params.bookingDate ?? formatDateKey(createdAt);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.hostId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: 'completed',
    guests: 1,
    date: bookingDate,
    time: '10:00',
    type: 'group',
    contact_name: params.host.fullName,
    contact_phone: params.host.phone,
    message: '',
    created_at: createdAt.toISOString(),
    payment_method: 'card',
    host_payout_amount: 24000,
    platform_revenue: 9000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
}

async function seedCancelledPenaltyBooking(params: {
  hostId: string;
  host: TestUser;
  experienceId: number;
  payoutAmount: number;
}) {
  const supabase = getAdminClient();
  const bookingId = `HOST-EARNINGS-CANCELLED-${Date.now()}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 2);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.hostId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: 'cancelled',
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '11:00',
    type: 'group',
    contact_name: params.host.fullName,
    contact_phone: params.host.phone,
    message: '',
    created_at: bookingDate.toISOString(),
    payment_method: 'card',
    host_payout_amount: params.payoutAmount,
    platform_revenue: 12000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
}

async function seedServiceBooking(params: {
  hostId: string;
  host: TestUser;
  customerId: string;
  status: 'PAID' | 'confirmed' | 'completed';
  payoutStatus: 'pending' | 'paid';
  payoutAmount: number;
}) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 4);

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Host Service Earnings ${timestamp}`,
      description: '호스트 서비스 수익 분리 회귀 검증용 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDateKey(serviceDate),
      start_time: '13:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: params.status === 'completed' ? 'completed' : 'matched',
      selected_host_id: params.hostId,
      contact_name: params.host.fullName,
      contact_phone: params.host.phone,
    })
    .select('id')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create host service earnings request fixture.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: params.hostId,
      appeal_message: '호스트 서비스 수익 분리 회귀 검증용 지원입니다.',
      status: 'selected',
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create host service earnings application fixture.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `HOST-SERVICE-EARNINGS-${timestamp}`;
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
    payment_method: 'card',
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);
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

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host earnings payout-focused policy', () => {
  test('shows only host payout numbers, not guest-paid totals or fee rows', async ({ page }) => {
    test.setTimeout(90000);

    const hostUser = createUser('policy');
    const hostId = await createAuthUser(hostUser);
    const customerUser = createUser('service-customer');
    const customerId = await createAuthUser(customerUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);
    await seedCompletedBooking({ hostId, host: hostUser, experienceId });
    await seedServiceBooking({
      hostId,
      host: hostUser,
      customerId,
      status: 'completed',
      payoutStatus: 'pending',
      payoutAmount: 80000,
    });

    await login(page, hostUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /호스팅 수입|Hosting Income|ホスティング収入|住宿收入/ })).toBeVisible();
    await expect(page.getByTestId('host-earnings-experience-pending')).toContainText('₩24,000');
    await expect(page.getByText(/완료된 예약 건수|Completed Bookings|完了した予約件数|已完成预订数/)).toBeVisible();
    await expect(page.getByText(/1\s*건|1 bookings|1件|1个/).first()).toBeVisible();
    await expect(page.getByTestId('host-earnings-summary-payout-items')).toContainText(/1/);
    await expect(page.getByTestId('host-earnings-summary-pending-payout')).toContainText('₩24,000');
    await expect(page.getByTestId('host-earnings-summary-in-progress')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-summary-paid-payout')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-summary-last-paid')).toContainText(
      /아직 지급 완료 내역이 없어요|No completed payout yet|まだ支払い完了履歴がありません|暂时还没有已完成结算/
    );
    await expect(page.getByTestId('host-earnings-summary-net-payout')).toContainText('₩24,000');
    await expect(page.getByText(/최종 지급액 \(Net\)|Net Payout|最終支払額 \(Net\)|最终支付额 \(Net\)/)).toBeVisible();
    await expect(page.getByTestId('host-earnings-today-marker-note')).toContainText(
      /빨간 점은 오늘 날짜 표시입니다\.|The red dot marks today\.|赤い点は今日の日付を示します。|红点表示今天。/
    );

    await expect(page.getByText(/총 매출 \(게스트 결제액\)|Total Revenue \(Guest Paid\)|総売上（ゲスト決済額）|总收入 \(房客付款\)/)).toHaveCount(0);
    await expect(page.getByText(/서비스 수수료|Service Fee|サービス手数料|服务费/)).toHaveCount(0);
    await expect(page.getByText(/결제망 이용료|Payment Gateway Fee|決済網利用料|支付网关手续费/)).toHaveCount(0);

    await page.getByTestId('host-earnings-tab-service').click();
    await expect(page.getByTestId('host-service-earnings-total-pending')).toContainText('₩80,000');
    await expect(page.getByTestId('host-service-earnings-in-progress')).toContainText('₩0');
    await expect(page.getByTestId('host-service-earnings-paid')).toContainText('₩0');
  });

  test('keeps cancelled penalty payouts in totals but excludes them from completed booking counts', async ({ page }) => {
    test.setTimeout(90000);

    const hostUser = createUser('cancelled-penalty');
    const hostId = await createAuthUser(hostUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);
    await seedCompletedBooking({ hostId, host: hostUser, experienceId });
    await seedCancelledPenaltyBooking({ hostId, host: hostUser, experienceId, payoutAmount: 12000 });

    await login(page, hostUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('host-earnings-experience-pending')).toContainText('₩36,000');
    await expect(page.getByTestId('host-earnings-summary-last-paid-inline')).toContainText(
      /아직 지급 완료 내역이 없어요|No completed payout yet|まだ支払い完了履歴がありません|暂时还没有已完成结算/
    );
    await expect(page.getByTestId('host-earnings-summary-completed-count')).toContainText(/1/);
    await expect(page.getByTestId('host-earnings-summary-payout-items')).toContainText(/2/);
    await expect(page.getByTestId('host-earnings-summary-pending-payout')).toContainText('₩36,000');
    await expect(page.getByTestId('host-earnings-summary-in-progress')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-summary-paid-payout')).toContainText('₩0');
    await expect(page.getByTestId('host-earnings-summary-net-payout')).toContainText('₩36,000');
  });

  test('charts earnings by booking date instead of payment creation date', async ({ page }) => {
    test.setTimeout(90000);

    const hostUser = createUser('chart-date');
    const hostId = await createAuthUser(hostUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperienceFixture(hostId);

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - 3);
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 2);
    const bookingDateKey = formatDateKey(bookingDate);

    await seedCompletedBooking({
      hostId,
      host: hostUser,
      experienceId,
      createdAt,
      bookingDate: bookingDateKey,
    });

    await login(page, hostUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await page.getByTestId('host-earnings-tab-experience').click();
    await page.getByTestId(`host-earnings-group-${bookingDateKey}`).hover();
    await expect(page.getByTestId(`host-earnings-tooltip-${bookingDateKey}`)).toBeVisible();
    await expect(page.getByTestId(`host-earnings-tooltip-${bookingDateKey}`)).toContainText('₩24,000');
    await expect(page.getByTestId(`host-earnings-tooltip-${bookingDateKey}`)).toContainText(
      /이 날짜에 결제된 총금액|Total amount paid on this date|この日に決済された合計金額|这一天支付的总金额/
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId(`host-earnings-group-${bookingDateKey}`).click();
    await expect(page.getByTestId(`host-earnings-tooltip-${bookingDateKey}`)).toBeVisible();
    await expect(page.getByTestId(`host-earnings-tooltip-${bookingDateKey}`)).toContainText('₩24,000');
  });
});
