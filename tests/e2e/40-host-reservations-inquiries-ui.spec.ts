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
const createdInquiryIds: number[] = [];

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
    email: `codex.host.dashboard.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Dashboard ${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
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
  return data.user.id;
}

async function seedGuestProfile(userId: string, user: TestUser, overrides?: Partial<{
  job: string;
  introduction: string;
  languages: string[];
  nationality: string;
}>) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
      job: overrides?.job || 'Product Designer',
      introduction: overrides?.introduction || '예약 카드에서 프로필 모달을 확인하기 위한 게스트 소개입니다.',
      languages: overrides?.languages || ['한국어', 'English'],
      nationality: overrides?.nationality || '대한민국',
    })
    .eq('id', userId);

  if (error) throw error;
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
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_host_dashboard',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 대시보드 예약/문의 탭 UI 보호막 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 운영 UI 보호막 검증',
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
  const title = `[Playwright] Host Dashboard ${Date.now()}`;

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: 'Seoul',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '호스트 대시보드 예약/문의 탭 UI 보호막 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '테스트 코스입니다.' }],
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
    .select('id,title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host dashboard experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function createBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
  status: 'PAID' | 'PENDING' | 'cancellation_requested';
  daysOffset: number;
  cancelReason?: string;
}) {
  const supabase = getAdminClient();
  const bookingId = `HOST-DASH-BOOKING-${params.status}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + params.daysOffset);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: params.status,
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: new Date().toISOString(),
    payment_method: 'bank',
    host_payout_amount: 24000,
    platform_revenue: 9000,
    payout_status: 'pending',
    cancel_reason: params.cancelReason || null,
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function findLatestInquiry(params: {
  userId: string;
  hostId: string;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, user_id, host_id, experience_id, type')
    .eq('user_id', params.userId)
    .eq('host_id', params.hostId)
    .eq('experience_id', String(params.experienceId))
    .eq('type', 'general')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data?.id && !createdInquiryIds.includes(Number(data.id))) {
    createdInquiryIds.push(Number(data.id));
  }
  return data;
}

async function findInquiryMessage(inquiryId: number, content: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inquiry_messages')
    .select('id, inquiry_id, sender_id, content')
    .eq('inquiry_id', inquiryId)
    .eq('content', content)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const inquiryId of createdInquiryIds) {
    await supabase.from('inquiry_messages').delete().eq('inquiry_id', inquiryId);
    await supabase.from('inquiries').delete().eq('id', inquiryId);
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

test.describe.serial('Host dashboard reservations and inquiries UI coverage', () => {
  test('shows the updated Japanese warning strip copy on reservations', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host-warning-ja');
    const guest = createUser('guest-warning-ja');

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ja');
      document.cookie = 'app_lang=ja; path=/';
    });

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);

    await createApprovedHostApplication(hostId, host);
    await seedGuestProfile(guestId, guest);

    const experience = await createExperienceFixture(hostId);
    await createBooking({
      guestId,
      guest,
      experienceId: experience.id,
      status: 'PAID',
      daysOffset: 6,
    });

    await login(page, host);
    await page.goto('/host/dashboard?tab=reservations', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await expect(
      page.getByText(
        'ゲストへの無返信・一方的なキャンセル・無断キャンセルは、精算やアカウント停止などに影響する可能性があります。今すぐ対応が必要な予約と問い合わせを優先的に確認してください。'
      )
    ).toBeVisible({ timeout: 15000 });
  });

  test('shows reservation cards, cancellation tab state, and guest profile modal', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host-reservations');
    const memberGuest = createUser('guest-member');
    const circleGuest = createUser('guest-circle');
    const pendingGuest = createUser('guest-pending');
    const cancellingGuest = createUser('guest-cancel');

    const hostId = await createAuthUser(host);
    const memberGuestId = await createAuthUser(memberGuest);
    const circleGuestId = await createAuthUser(circleGuest);
    const pendingGuestId = await createAuthUser(pendingGuest);
    const cancellingGuestId = await createAuthUser(cancellingGuest);

    await createApprovedHostApplication(hostId, host);
    await seedGuestProfile(memberGuestId, memberGuest, {
      job: 'Product Designer',
      introduction: 'Locally Member 예약 카드 프로필 모달 검증용 자기소개입니다.',
    });
    await seedGuestProfile(circleGuestId, circleGuest, {
      job: 'Photographer',
      introduction: 'Locally Circle 예약 카드 프로필 모달 검증용 자기소개입니다.',
    });
    await seedGuestProfile(pendingGuestId, pendingGuest, {
      job: 'Planner',
      introduction: '멤버십 배지가 없어야 하는 게스트 소개입니다.',
    });
    await seedGuestProfile(cancellingGuestId, cancellingGuest, {
      job: 'Marketer',
      introduction: '취소 요청 탭 검증용 게스트 소개입니다.',
    });

    const experience = await createExperienceFixture(hostId);
    const memberBookingId = await createBooking({
      guestId: memberGuestId,
      guest: memberGuest,
      experienceId: experience.id,
      status: 'PAID',
      daysOffset: 5,
    });
    await createBooking({
      guestId: circleGuestId,
      guest: circleGuest,
      experienceId: experience.id,
      status: 'PAID',
      daysOffset: -2,
    });
    const circleBookingId = await createBooking({
      guestId: circleGuestId,
      guest: circleGuest,
      experienceId: experience.id,
      status: 'PAID',
      daysOffset: 7,
    });
    const pendingBookingId = await createBooking({
      guestId: pendingGuestId,
      guest: pendingGuest,
      experienceId: experience.id,
      status: 'PENDING',
      daysOffset: 8,
    });
    const cancelBookingId = await createBooking({
      guestId: cancellingGuestId,
      guest: cancellingGuest,
      experienceId: experience.id,
      status: 'cancellation_requested',
      daysOffset: 4,
      cancelReason: '일정 조정이 필요합니다.',
    });

    await login(page, host);
    await page.goto('/host/dashboard?tab=reservations', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const memberCard = page.getByTestId(`reservation-card-${memberBookingId}`);
    const circleCard = page.getByTestId(`reservation-card-${circleBookingId}`);
    const pendingCard = page.getByTestId(`reservation-card-${pendingBookingId}`);

    await expect(memberCard).toBeVisible({ timeout: 15000 });
    await expect(circleCard).toBeVisible({ timeout: 15000 });
    await expect(pendingCard).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('₩24,000').last()).toBeVisible();
    await expect(memberCard.locator('[data-testid="host-reservation-membership-badge"]').first()).toContainText('Tier 1');
    await expect(circleCard.locator('[data-testid="host-reservation-membership-badge"]').first()).toContainText('Tier 2');
    await expect(pendingCard.locator('[data-testid="host-reservation-membership-badge"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /취소\/환불|Cancelled/ })).toBeVisible();

    await page.getByRole('button', { name: /취소\/환불|Cancelled/ }).click();
    await expect(page.getByRole('heading', { name: `#${cancelBookingId}` })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/취소 요청이 접수되었습니다.|Cancellation Request Received/)).toBeVisible();

    await page.getByRole('button', { name: /다가오는 일정|Upcoming/ }).click();
    await memberCard.getByRole('button', { name: new RegExp(`${memberGuest.fullName}.*(프로필|Profile)`) }).click();

    await expect(page.getByRole('heading', { name: memberGuest.fullName })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Product Designer')).toBeVisible();
    await expect(page.getByTestId('guest-profile-membership-badge')).toContainText('Tier 1');
    await expect(page.getByTestId('guest-profile-membership-desc')).toContainText(
      /처음 로컬리 여행을 시작한 게스트예요.|This guest is starting their first trip with Locally./
    );
    await expect(page.getByText('Locally Member 예약 카드 프로필 모달 검증용 자기소개입니다.')).toBeVisible();

    await page.mouse.click(10, 10);
    await expect(page.getByRole('heading', { name: memberGuest.fullName })).toHaveCount(0);

    await circleCard.getByRole('button', { name: new RegExp(`${circleGuest.fullName}.*(프로필|Profile)`) }).click();
    await expect(page.getByRole('heading', { name: circleGuest.fullName })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('guest-profile-membership-badge')).toContainText('Tier 2');
    await expect(page.getByTestId('guest-profile-membership-desc')).toContainText(
      /다시 찾아온 게스트예요.|This guest has come back to Locally./
    );

    await page.mouse.click(10, 10);
    await expect(page.getByRole('heading', { name: circleGuest.fullName })).toHaveCount(0);

    await pendingCard.getByRole('button', { name: new RegExp(`${pendingGuest.fullName}.*(프로필|Profile)`) }).click();
    await expect(page.getByRole('heading', { name: pendingGuest.fullName })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('guest-profile-membership-badge')).toHaveCount(0);
    await expect(page.getByTestId('guest-profile-membership-desc')).toHaveCount(0);
  });

  test('opens inquiry chat from a reservation card and sends a host reply', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host-inquiries');
    const guest = createUser('guest-inquiries');

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);

    await createApprovedHostApplication(hostId, host);
    await seedGuestProfile(guestId, guest, {
      introduction: '문의방 생성 검증용 게스트입니다.',
    });

    const experience = await createExperienceFixture(hostId);
    const bookingId = await createBooking({
      guestId,
      guest,
      experienceId: experience.id,
      status: 'PAID',
      daysOffset: 6,
    });
    const replyMessage = `Host dashboard reply ${Date.now()}`;

    await login(page, host);
    await page.goto('/host/dashboard?tab=reservations', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByRole('heading', { name: `#${bookingId}` })).toBeVisible({ timeout: 15000 });

    const startChatResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/host/start-chat') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 20000 }
    );

    await page.getByRole('button', { name: /메시지|Message/ }).click();
    await startChatResponsePromise;
    await page.waitForURL(/\/host\/dashboard\?tab=inquiries/, { timeout: 15000 });

    await expect
      .poll(async () => {
        const latest = await findLatestInquiry({
          userId: guestId,
          hostId,
          experienceId: experience.id,
        });

        return latest?.id ? Number(latest.id) : 0;
      }, {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      })
      .toBeGreaterThan(0);

    const inquiry = Number((await findLatestInquiry({
      userId: guestId,
      hostId,
      experienceId: experience.id,
    }))?.id || 0);

    await expect(page.getByText(guest.fullName).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(experience.title).first()).toBeVisible({ timeout: 15000 });

    const replyInput = page.locator('input[placeholder="답장 입력..."], input[placeholder="Type a reply..."]').first();
    await replyInput.fill(replyMessage);
    await replyInput.press('Enter');

    await expect(page.getByText(replyMessage).last()).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => {
        const message = await findInquiryMessage(inquiry, replyMessage);
        return message?.id ? Number(message.id) : 0;
      }, {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      })
      .toBeGreaterThan(0);
  });
});
