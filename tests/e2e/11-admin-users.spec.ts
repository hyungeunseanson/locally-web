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
type UserSummaryRoleRow = {
  id: string;
  role?: string | null;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdReviewIds: string[] = [];
const createdGuestReviewIds: number[] = [];
const createdInquiryIds: string[] = [];
const createdInquiryMessageIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];
const createdHostApplicationIds: number[] = [];
let testUserCounter = 0;

function createUserToken() {
  testUserCounter += 1;
  return `${Date.now()}${testUserCounter}`;
}

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

function createAdminUser(): TestUser {
  const timestamp = createUserToken();
  return {
    email: `codex.users.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Users Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createCustomerUser(): TestUser {
  const timestamp = createUserToken();
  return {
    email: `codex.users.customer.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Users Customer ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createHostUser(): TestUser {
  const timestamp = createUserToken();
  return {
    email: `codex.users.host.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Users Host ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

async function createAuthUser(user: TestUser, isAdmin = false, role: 'host' | 'admin' | null = null) {
  const supabase = getAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
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

      if (role) {
        const { error: roleError } = await supabase
          .from('users')
          .upsert(
            {
              id: data.user.id,
              email: user.email,
              role,
            },
            { onConflict: 'id' }
          );

        if (roleError) throw roleError;
      }

      if (isAdmin) {
        const { error: whitelistError } = await supabase
          .from('admin_whitelist')
          .upsert({ email: user.email }, { onConflict: 'email' });

        if (whitelistError) throw whitelistError;
        createdWhitelistEmails.push(user.email);
      }

      return data.user.id;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await sleep(500 * (attempt + 1));
    }
  }

  throw new Error(`Failed to create auth user for ${user.email}`);
}

async function updateProfileAdminDetails(
  userId: string,
  details: {
    birth_date?: string | null;
    nationality?: string | null;
    kakao_id?: string | null;
    mbti?: string | null;
  }
) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update(details)
    .eq('id', userId);

  if (error) throw error;
}

async function createActiveExperience(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Users Experience ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'UsersTab E2E 테스트용 체험 설명입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 동선입니다.' }],
      spots: '홍대입구역',
      meeting_point: '홍대입구역 1번 출구',
      location: '서울 마포구 양화로 160',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'active',
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create active experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function createHostApplication(
  userId: string,
  user: TestUser,
  status: 'approved' | 'active' | 'pending' | 'revision' | 'rejected' = 'approved'
) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: '@codex_users_host',
      source: 'playwright',
      language_cert: 'TOPIK 6',
      profile_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512',
      self_intro: 'User Management 호스트 필터 계약 검증을 위한 충분한 길이의 호스트 소개문입니다.',
      id_card_file: null,
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: 'User Management 호스트 필터 계약 검증을 위한 테스트 지원 동기입니다.',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
  return Number(data.id);
}

async function createUserFixtures(params: {
  customerId: string;
  customer: TestUser;
  hostId: string;
  hostName: string;
  experienceId: number;
  experienceTitle: string;
}) {
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const bookingId = `USR-BOOK-${timestamp}`;
  const bookingCreatedAt = new Date();
  bookingCreatedAt.setMinutes(bookingCreatedAt.getMinutes() - 50);

  const serviceRequestCreatedAt = new Date();
  serviceRequestCreatedAt.setMinutes(serviceRequestCreatedAt.getMinutes() - 20);

  const inquiryCreatedAt = new Date();
  inquiryCreatedAt.setMinutes(inquiryCreatedAt.getMinutes() - 10);

  const inquiryResolvedAt = new Date();
  inquiryResolvedAt.setMinutes(inquiryResolvedAt.getMinutes() - 4);

  const replyCreatedAt = new Date();
  replyCreatedAt.setMinutes(replyCreatedAt.getMinutes() - 6);

  const experienceDate = new Date();
  experienceDate.setDate(experienceDate.getDate() + 7);

  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 12);

  const { error: bookingError } = await supabase
    .from('bookings')
    .insert({
      id: bookingId,
      order_id: bookingId,
      user_id: params.customerId,
      experience_id: params.experienceId,
      amount: 55000,
      total_price: 50000,
      status: 'completed',
      guests: 1,
      date: formatDate(experienceDate),
      time: '10:00',
      type: 'group',
      contact_name: params.customer.fullName,
      contact_phone: params.customer.phone,
      message: '',
      created_at: bookingCreatedAt.toISOString(),
      payment_method: 'card',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

  if (bookingError) throw bookingError;
  createdBookingIds.push(bookingId);

  const reviewCreatedAt = new Date();
  reviewCreatedAt.setMinutes(reviewCreatedAt.getMinutes() - 40);

  const guestReviewCreatedAt = new Date();
  guestReviewCreatedAt.setMinutes(guestReviewCreatedAt.getMinutes() - 35);

  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      user_id: params.customerId,
      experience_id: params.experienceId,
      booking_id: bookingId,
      rating: 5,
      content: 'UsersTab 타임라인 검증용 리뷰입니다.',
      photos: [],
      created_at: reviewCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (reviewError || !reviewData?.id) {
    throw reviewError || new Error('Failed to create review.');
  }
  createdReviewIds.push(reviewData.id);

  const { data: guestReviewData, error: guestReviewError } = await supabase
    .from('guest_reviews')
    .insert({
      booking_id: bookingId,
      host_id: params.hostId,
      guest_id: params.customerId,
      rating: 4,
      content: 'UsersTab 호스트 평가 수신 검증용 후기입니다.',
      created_at: guestReviewCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (guestReviewError || !guestReviewData?.id) {
    throw guestReviewError || new Error('Failed to create guest review.');
  }
  createdGuestReviewIds.push(Number(guestReviewData.id));

  const { data: inquiryData, error: inquiryError } = await supabase
    .from('inquiries')
    .insert({
      user_id: params.customerId,
      host_id: params.hostId,
      experience_id: params.experienceId,
      content: `UsersTab 문의 생성 ${timestamp}`,
      type: 'general',
      status: 'resolved',
      created_at: inquiryCreatedAt.toISOString(),
      updated_at: inquiryResolvedAt.toISOString(),
    })
    .select('id')
    .single();

  if (inquiryError || !inquiryData?.id) {
    throw inquiryError || new Error('Failed to create inquiry.');
  }
  createdInquiryIds.push(inquiryData.id);

  const { data: inquiryMessageData, error: inquiryMessageError } = await supabase
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiryData.id,
      sender_id: params.hostId,
      content: `UsersTab 문의 답변 ${timestamp}`,
      type: 'text',
      is_read: false,
      created_at: replyCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (inquiryMessageError || !inquiryMessageData?.id) {
    throw inquiryMessageError || new Error('Failed to create inquiry reply.');
  }
  createdInquiryMessageIds.push(inquiryMessageData.id);

  const { data: serviceRequest, error: serviceRequestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: `[Playwright] Users Service ${timestamp}`,
      description: 'UsersTab 타임라인 검증용 서비스 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(serviceDate),
      start_time: '11:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'open',
      created_at: serviceRequestCreatedAt.toISOString(),
      updated_at: serviceRequestCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (serviceRequestError || !serviceRequest?.id) {
    throw serviceRequestError || new Error('Failed to create service request.');
  }
  createdServiceRequestIds.push(serviceRequest.id);

  const { data: serviceApplication, error: serviceApplicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: serviceRequest.id,
      host_id: params.hostId,
      appeal_message: 'UsersTab 타임라인 검증용 지원입니다.',
      status: 'selected',
      created_at: serviceRequestCreatedAt.toISOString(),
      updated_at: serviceRequestCreatedAt.toISOString(),
    })
    .select('id')
    .single();

  if (serviceApplicationError || !serviceApplication?.id) {
    throw serviceApplicationError || new Error('Failed to create service application.');
  }
  createdServiceApplicationIds.push(serviceApplication.id);

  const serviceBookingId = `USR-SVC-${timestamp}`;
  const serviceBookingUpdatedAt = new Date();
  serviceBookingUpdatedAt.setMinutes(serviceBookingUpdatedAt.getMinutes() - 5);

  const { error: serviceBookingError } = await supabase
    .from('service_bookings')
    .insert({
      id: serviceBookingId,
      order_id: serviceBookingId,
      request_id: serviceRequest.id,
      application_id: serviceApplication.id,
      customer_id: params.customerId,
      host_id: params.hostId,
      amount: 150000,
      host_payout_amount: 100000,
      platform_revenue: 50000,
      status: 'completed',
      payout_status: 'pending',
      payment_method: 'card',
      created_at: serviceRequestCreatedAt.toISOString(),
      updated_at: serviceBookingUpdatedAt.toISOString(),
    });

  if (serviceBookingError) throw serviceBookingError;
  createdServiceBookingIds.push(serviceBookingId);

  return {
    bookingId,
    expectedTotalSpent: '₩205,000',
    expectedRequestCount: '예약 1 · 의뢰 1',
    experienceTitle: params.experienceTitle,
    hostReviewTimelineTitle: `호스트 평가 수신 · ${params.hostName}`,
    guestReviewHostName: params.hostName,
    guestReviewRating: '4.0',
    guestReviewContent: 'UsersTab 호스트 평가 수신 검증용 후기입니다.',
    guestReviewDate: new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(guestReviewCreatedAt),
    serviceTitle: `[Playwright] Users Service ${timestamp}`,
  };
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function cleanupFixtures() {
  const supabase = getAdminClient();

  for (const inquiryMessageId of createdInquiryMessageIds) {
    await supabase.from('inquiry_messages').delete().eq('id', inquiryMessageId);
  }

  for (const inquiryId of createdInquiryIds) {
    await supabase.from('inquiries').delete().eq('id', inquiryId);
  }

  for (const reviewId of createdReviewIds) {
    await supabase.from('reviews').delete().eq('id', reviewId);
  }

  for (const guestReviewId of createdGuestReviewIds) {
    await supabase.from('guest_reviews').delete().eq('id', guestReviewId);
  }

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const serviceBookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', serviceBookingId);
  }

  for (const serviceApplicationId of createdServiceApplicationIds) {
    await supabase.from('service_applications').delete().eq('id', serviceApplicationId);
  }

  for (const serviceRequestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', serviceRequestId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const hostApplicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', hostApplicationId);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const authUserId of createdAuthUserIds) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(authUserId);
      if (error && !error.message.toLowerCase().includes('user not found')) {
        console.warn('Ignoring auth cleanup delete error:', authUserId, error.message);
      }
    } catch (error) {
      console.warn('Ignoring auth cleanup delete exception:', authUserId, error);
    }
  }
}

test.describe('Admin UsersTab smoke', () => {
  test.afterAll(async () => {
    await cleanupFixtures();
  });

  test('resolves dashboard roles from admin roles and latest host approval status', async ({ page }) => {
    test.setTimeout(90000);

    const supabase = getAdminClient();
    const adminUser = createAdminUser();
    const approvedHostUser = createHostUser();
    const adminHostUser = createHostUser();
    const pendingHostUser = createHostUser();
    const legacyHostUser = createHostUser();

    await createAuthUser(adminUser, true);
    const approvedHostId = await createAuthUser(approvedHostUser);
    const adminHostId = await createAuthUser(adminHostUser);
    const pendingHostId = await createAuthUser(pendingHostUser);
    const legacyHostId = await createAuthUser(legacyHostUser, false, 'host');

    await createHostApplication(approvedHostId, approvedHostUser, 'approved');
    await createHostApplication(adminHostId, adminHostUser, 'approved');
    await createHostApplication(pendingHostId, pendingHostUser, 'pending');

    const { error: adminRoleError } = await supabase
      .from('users')
      .upsert(
        {
          id: adminHostId,
          email: adminHostUser.email,
          role: 'admin',
        },
        { onConflict: 'id' }
      );

    if (adminRoleError) throw adminRoleError;

    await login(page, adminUser);

    const summaryResponse = await page.request.get('/api/admin/users-summary');
    expect(summaryResponse.ok()).toBeTruthy();
    const summaryPayload = await summaryResponse.json();
    const summaryRows = (Array.isArray(summaryPayload?.data) ? summaryPayload.data : []) as UserSummaryRoleRow[];
    const rowsById = new Map<string, UserSummaryRoleRow>(
      summaryRows.map((row) => [row.id, row])
    );

    expect(rowsById.get(approvedHostId)?.role).toBe('host');
    expect(rowsById.get(adminHostId)?.role).toBe('admin');
    expect(rowsById.get(pendingHostId)?.role ?? null).toBeNull();
    expect(rowsById.get(legacyHostId)?.role).toBe('host');
  });

  test('renders user summary columns and activity timeline for a seeded member', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const customerUser = createCustomerUser();
    const hostUser = createHostUser();

    const adminId = await createAuthUser(adminUser, true);
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser, false, 'host');
    const customerProfileDetails = {
      birth_date: '1994-03-12',
      nationality: 'KR',
      kakao_id: 'codex-users-customer',
      mbti: 'INFJ',
    };

    await updateProfileAdminDetails(customerId, customerProfileDetails);

    expect(adminId).toBeTruthy();

    const experience = await createActiveExperience(hostId);
    const fixture = await createUserFixtures({
      customerId,
      customer: customerUser,
      hostId,
      hostName: hostUser.fullName,
      experienceId: experience.id,
      experienceTitle: experience.title,
    });

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=USERS', { waitUntil: 'networkidle' });

    const summaryResponse = await page.request.get('/api/admin/users-summary');
    expect(summaryResponse.ok()).toBeTruthy();
    const summaryPayload = await summaryResponse.json();
    const summaryUser = Array.isArray(summaryPayload?.data)
      ? summaryPayload.data.find((row: { id?: string }) => row.id === customerId)
      : null;

    expect(summaryUser).toBeTruthy();
    expect(summaryUser).not.toHaveProperty('birth_date');
    expect(summaryUser).not.toHaveProperty('nationality');
    expect(summaryUser).not.toHaveProperty('kakao_id');
    expect(summaryUser).not.toHaveProperty('mbti');

    const timelineResponse = await page.request.get(`/api/admin/users/${customerId}/timeline`);
    expect(timelineResponse.ok()).toBeTruthy();
    const timelinePayload = await timelineResponse.json();
    expect(timelinePayload?.data?.profile).toMatchObject(customerProfileDetails);

    await expect(page.getByRole('combobox', { name: '회원 정렬' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('전체 회원', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '온라인만' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Host', exact: true }).click();
    await expect(page.locator('tbody tr span').filter({ hasText: 'Host' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Guest', exact: true }).click();

    const searchInput = page.getByPlaceholder('이름/이메일 검색');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(customerUser.fullName);

    const customerRow = page.locator('tbody tr', { hasText: customerUser.fullName }).first();
    await expect(customerRow).toBeVisible();
    await expect(customerRow).toContainText(fixture.expectedTotalSpent);
    await expect(customerRow).toContainText(fixture.expectedRequestCount);
    await expect(customerRow).toContainText('Guest');
    await expect(customerRow).not.toContainText('집계 중...');

    await customerRow.click();

    const guestReviewsSection = page.getByTestId('admin-user-guest-reviews-section');

    await expect(page.getByText('기본 프로필')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guest' })).toBeVisible();
    await expect(guestReviewsSection).toBeVisible();
    await expect(guestReviewsSection.getByText('받은 호스트 평가', { exact: false })).toBeVisible();
    await expect(guestReviewsSection.getByText(fixture.guestReviewHostName, { exact: true })).toBeVisible();
    await expect(guestReviewsSection.getByText(fixture.guestReviewRating, { exact: true })).toBeVisible();
    await expect(guestReviewsSection).toContainText(fixture.guestReviewContent);
    await expect(guestReviewsSection.getByText(fixture.guestReviewDate, { exact: true })).toBeVisible();
    await expect(page.getByText(customerProfileDetails.birth_date, { exact: false })).toBeVisible();
    await expect(page.getByText(customerProfileDetails.kakao_id, { exact: true })).toBeVisible();
    await expect(page.getByText('회원 타임라인', { exact: false })).toBeVisible();
    await expect(page.getByText(`체험 예약 · ${fixture.experienceTitle}`)).toBeVisible();
    await expect(page.getByText(`리뷰 작성 · ${fixture.experienceTitle}`)).toBeVisible();
    await expect(page.getByText(fixture.hostReviewTimelineTitle)).toBeVisible();
    await expect(page.getByText(`문의 답변 도착 · ${fixture.experienceTitle}`)).toBeVisible();
    await expect(page.getByText(`맞춤 의뢰 결제 · ${fixture.serviceTitle}`)).toBeVisible();
    await expect(page.getByRole('button', { name: /이 회원 계정 영구 삭제/ })).toBeVisible();
  });

  test('rejects unsupported delete targets and cascades profile-owned inquiry/service records', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const customerUser = createCustomerUser();
    const hostUser = createHostUser();

    await createAuthUser(adminUser, true);
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser, false, 'host');

    const experience = await createActiveExperience(hostId);
    await createUserFixtures({
      customerId,
      customer: customerUser,
      hostId,
      hostName: hostUser.fullName,
      experienceId: experience.id,
      experienceTitle: experience.title,
    });

    await login(page, adminUser);

    const invalidDeleteResponse = await page.request.post('/api/admin/delete', {
      data: { table: 'notifications', id: customerId },
    });
    expect(invalidDeleteResponse.status()).toBe(400);

    const deleteResponse = await page.request.post('/api/admin/delete', {
      data: { table: 'profiles', id: customerId },
    });
    expect(deleteResponse.ok()).toBeTruthy();
    const deletedCustomerIndex = createdAuthUserIds.indexOf(customerId);
    if (deletedCustomerIndex >= 0) {
      createdAuthUserIds.splice(deletedCustomerIndex, 1);
    }

    const supabase = getAdminClient();

    const [
      profileRes,
      bookingRes,
      inquiryRes,
      inquiryMessageRes,
      serviceRequestRes,
      serviceApplicationRes,
      serviceBookingAsCustomerRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id').eq('id', customerId).maybeSingle(),
      supabase.from('bookings').select('id').eq('user_id', customerId),
      supabase.from('inquiries').select('id').eq('user_id', customerId),
      supabase.from('inquiry_messages').select('id').eq('sender_id', customerId),
      supabase.from('service_requests').select('id').eq('user_id', customerId),
      supabase.from('service_applications').select('id').eq('host_id', customerId),
      supabase.from('service_bookings').select('id').eq('customer_id', customerId),
    ]);

    expect(profileRes.error).toBeNull();
    expect(profileRes.data).toBeNull();
    expect(bookingRes.error).toBeNull();
    expect(bookingRes.data).toEqual([]);
    expect(inquiryRes.error).toBeNull();
    expect(inquiryRes.data).toEqual([]);
    expect(inquiryMessageRes.error).toBeNull();
    expect(inquiryMessageRes.data).toEqual([]);
    expect(serviceRequestRes.error).toBeNull();
    expect(serviceRequestRes.data).toEqual([]);
    expect(serviceApplicationRes.error).toBeNull();
    expect(serviceApplicationRes.data).toEqual([]);
    expect(serviceBookingAsCustomerRes.error).toBeNull();
    expect(serviceBookingAsCustomerRes.data).toEqual([]);
  });
});
