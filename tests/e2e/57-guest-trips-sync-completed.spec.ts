import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import {
  formatBookingReviewMarker,
  formatHostUnavailableReviewMarker,
} from '@/app/utils/hostUnavailableReview';

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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.guest.trips.sync.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Guest Trips Sync ${prefix} ${timestamp}`,
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

async function createHostExperience(hostId: string, options?: { hostNotice?: string }) {
  const supabase = getAdminClient();
  const title = `[Playwright] Guest Trips Sync ${Date.now()}`;

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
      description: 'guest trips sync test',
      itinerary: [{ title: '서울역 1번 출구', description: 'sync test stop' }],
      spots: '서울역',
      meeting_point: 'Seoul Station Exit 1',
      meeting_point_i18n: {
        ko: '서울역 1번 출구',
        en: 'Seoul Station Exit 1',
      },
      location: 'Seoul Station Exit 1',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 40000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
        host_notice: options?.hostNotice || '',
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
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createLocalizedHostExperience(hostId: string) {
  const supabase = getAdminClient();
  const timestamp = Date.now();

  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '일본',
      city: '도쿄',
      title: `東京でキッズ向けグルメツアー ${timestamp}`,
      title_ko: `도쿄 어린이 맛집 투어 ${timestamp}`,
      title_ja: `東京でキッズ向けグルメツアー ${timestamp}`,
      category: '맛집 탐방',
      languages: ['일본어', '한국어'],
      language_levels: [{ language: '일본어', level: 5 }, { language: '한국어', level: 4 }],
      duration: 2,
      max_guests: 4,
      description: 'localized title verification',
      itinerary: [{ title: '시부야역', description: 'localized title stop' }],
      spots: '시부야',
      meeting_point: 'Shibuya Station',
      meeting_point_i18n: {
        ko: '시부야역',
        ja: '渋谷駅',
      },
      location: 'Shibuya Station',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 40000,
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
      source_locale: 'ja',
      manual_locales: ['ko', 'ja'],
      translation_version: 1,
      translation_meta: {
        ko: { mode: 'manual', status: 'ready', version: 1 },
        ja: { mode: 'manual', status: 'ready', version: 1 },
      },
    })
    .select('id,title_ko')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create localized experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    titleKo: String(data.title_ko),
  };
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
      instagram: '@codex_guest_trips_sync',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '게스트 trips sync 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '게스트 trips sync 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
}

async function createPastPaidBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const date = pastDate.toISOString().slice(0, 10);
  const bookingId = `GUEST-TRIPS-SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { error } = await supabase
    .from('bookings')
    .insert({
      id: bookingId,
      user_id: params.guestId,
      experience_id: params.experienceId,
      order_id: bookingId,
      date,
      time: '09:00',
      guests: 1,
      amount: 44000,
      total_price: 40000,
      total_experience_price: 40000,
      host_payout_amount: 32000,
      platform_revenue: 12000,
      status: 'PAID',
      payment_method: 'bank',
      type: 'group',
      contact_name: params.guest.fullName,
      contact_phone: params.guest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payout_status: 'pending',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    })

  if (error) {
    throw error || new Error('Failed to create past paid booking.');
  }

  createdBookingIds.push(bookingId);
  return bookingId;
}

async function createFuturePaidBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const date = futureDate.toISOString().slice(0, 10);
  const bookingId = `GUEST-TRIPS-LOCALIZED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { error } = await supabase
    .from('bookings')
    .insert({
      id: bookingId,
      user_id: params.guestId,
      experience_id: params.experienceId,
      order_id: bookingId,
      date,
      time: '18:00',
      guests: 2,
      amount: 88000,
      total_price: 80000,
      total_experience_price: 80000,
      host_payout_amount: 64000,
      platform_revenue: 24000,
      status: 'PAID',
      payment_method: 'card',
      type: 'group',
      contact_name: params.guest.fullName,
      contact_phone: params.guest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payout_status: 'pending',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

  if (error) {
    throw error || new Error('Failed to create future paid booking.');
  }

  createdBookingIds.push(bookingId);
  return bookingId;
}

async function createFuturePendingBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const date = futureDate.toISOString().slice(0, 10);
  const bookingId = `GUEST-TRIPS-PENDING-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { error } = await supabase
    .from('bookings')
    .insert({
      id: bookingId,
      user_id: params.guestId,
      experience_id: params.experienceId,
      order_id: bookingId,
      date,
      time: '07:00',
      guests: 2,
      amount: 88000,
      total_price: 80000,
      total_experience_price: 80000,
      host_payout_amount: 64000,
      platform_revenue: 24000,
      status: 'pending',
      payment_method: 'bank',
      type: 'group',
      contact_name: params.guest.fullName,
      contact_phone: params.guest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payout_status: 'pending',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

  if (error) {
    throw error || new Error('Failed to create future pending booking.');
  }

  createdBookingIds.push(bookingId);
  return bookingId;
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();

  const results = await Promise.allSettled([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.getByText('Welcome back. You are now logged in.').waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(`Login did not complete for ${user.email}`);
  }
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdBookingIds.length > 0) {
    await supabase.from('bookings').delete().in('id', createdBookingIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('guest trips completed sync route', () => {
  test('GET stays read-only while POST sync completes past active bookings', async ({ page }) => {
    const host = createUser('host');
    const guest = createUser('guest');
    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);
    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
        languages: ['한국어'],
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;
    const experienceId = await createHostExperience(hostId);
    const bookingId = await createPastPaidBooking({ guestId, guest, experienceId });

    await login(page, guest);

    const getResult = await page.evaluate(async () => {
      const response = await fetch('/api/guest/trips');
      return {
        status: response.status,
        body: await response.json(),
      };
    });

    expect(getResult.status).toBe(200);
    expect(getResult.body.syncCompletedNeeded).toBe(true);
    expect(getResult.body.trips[0].status).toBe('completed');

    const { data: beforeSync, error: beforeSyncError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();

    if (beforeSyncError) throw beforeSyncError;
    expect(beforeSync?.status).toBe('PAID');

    const syncResult = await page.evaluate(async () => {
      const response = await fetch('/api/guest/trips/sync-completed', {
        method: 'POST',
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    });

    expect(syncResult.status).toBe(200);
    expect(syncResult.body.success).toBe(true);
    expect(syncResult.body.updatedCount).toBe(1);

    const { data: afterSync, error: afterSyncError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();

    if (afterSyncError) throw afterSyncError;
    expect(afterSync?.status).toBe('completed');
  });

  test('renders localized Korean titles on guest trips and payment complete', async ({ page }) => {
    const host = createUser('host.localized');
    const guest = createUser('guest.localized');
    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });
    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
        languages: ['일본어', '한국어'],
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;

    const experience = await createLocalizedHostExperience(hostId);
    const bookingId = await createFuturePaidBooking({
      guestId,
      guest,
      experienceId: experience.id,
    });

    await login(page, guest);

    await page.goto('/guest/trips', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: experience.titleKo })).toBeVisible();

    await page.goto(`/experiences/${experience.id}/payment/complete?orderId=${bookingId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(experience.titleKo)).toBeVisible();
  });

  test('shows trip context meta and contact-host CTA in the cancellation modal', async ({ page }) => {
    const host = createUser('host.trip.meta');
    const guest = createUser('guest.trip.meta');

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;

    const experienceId = await createHostExperience(hostId);
    await supabase
      .from('experiences')
      .update({ meeting_point: '서울역 1번 출구', meeting_point_i18n: { ko: '서울역 1번 출구' } })
      .eq('id', experienceId);
    const bookingId = await createFuturePaidBooking({
      guestId,
      guest,
      experienceId,
    });

    await login(page, guest);
    await page.goto('/guest/trips', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(`guest-trip-menu-button-${bookingId}`).last()).toBeVisible();

    await page.getByTestId(`guest-trip-menu-button-${bookingId}`).last().click();
    await page.getByTestId(`guest-trip-cancel-button-${bookingId}`).click();

    const cancelModal = page.locator('div.fixed.inset-0.z-50').filter({
      hasText: /예약 취소 요청|취소 규정 요약/,
    });
    await expect(cancelModal).toBeVisible({ timeout: 10000 });
    await expect(cancelModal.getByTestId('guest-trip-cancel-followup')).toContainText('취소 후 결과는 여기서 확인하세요');
    await expect(cancelModal.getByTestId('guest-trip-cancel-followup')).toContainText('취소 요청과 환불 진행 상태는 예약 내역과 알림에서 다시 확인할 수 있어요.');
    await expect(cancelModal.getByRole('button', { name: '먼저 호스트에게 문의하기' })).toBeVisible();

    await cancelModal.getByRole('button', { name: '먼저 호스트에게 문의하기' }).click();
    await page.waitForURL((url) => url.pathname === '/guest/inbox' && url.searchParams.get('expId') === String(experienceId), { timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`hostId=${hostId}`));
  });

  test('keeps the desktop pending deposit card fully visible without clipping the receipt CTA', async ({ page }) => {
    const host = createUser('host.pending.desktop');
    const guest = createUser('guest.pending.desktop');
    const desktopViewport = { width: 1440, height: 1200 };

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });
    await page.setViewportSize(desktopViewport);

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;

    const experienceId = await createHostExperience(hostId);
    const bookingId = await createFuturePendingBooking({
      guestId,
      guest,
      experienceId,
    });

    await login(page, guest);
    await page.goto('/guest/trips', { waitUntil: 'domcontentloaded' });

    const tripCard = page
      .getByTestId('guest-trips-desktop-main')
      .getByTestId(`guest-trip-card-${bookingId}`);
    const pendingReceiptButton = tripCard.getByTestId('guest-trip-pending-receipt-button');
    await expect(tripCard).toBeVisible();
    await expect(tripCard).toContainText('입금을 기다리고 있습니다. 영수증에서 계좌 정보와 입금 마감 시간을 다시 확인해주세요.');
    await expect(pendingReceiptButton).toBeVisible();
    await pendingReceiptButton.scrollIntoViewIfNeeded();

    const cardBox = await tripCard.boundingBox();
    const buttonBox = await pendingReceiptButton.boundingBox();

    expect(cardBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    if (!cardBox || !buttonBox) throw new Error('Desktop pending trip layout bounding boxes were not available.');

    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
  });

  test('shows pending receipt follow-up guidance and support CTA', async ({ page }) => {
    const host = createUser('host.pending.receipt');
    const guest = createUser('guest.pending.receipt');
    const mobileViewport = { width: 390, height: 844 };

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });
    await page.setViewportSize(mobileViewport);

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;

    const experienceId = await createHostExperience(hostId);
    const bookingId = await createFuturePendingBooking({
      guestId,
      guest,
      experienceId,
    });

    await login(page, guest);
    await page.goto('/guest/trips', { waitUntil: 'domcontentloaded' });
    const pendingReceiptButton = page.locator('[data-testid="guest-trip-pending-receipt-button"]:visible').first();
    await expect(pendingReceiptButton).toBeVisible();
    await pendingReceiptButton.click();

    const receiptModal = page.getByTestId('guest-trip-receipt-modal');
    await expect(receiptModal).toBeVisible();
    const receiptModalBox = await receiptModal.boundingBox();
    expect(receiptModalBox).not.toBeNull();
    if (!receiptModalBox) throw new Error('Receipt modal bounding box was not available.');
    expect(receiptModalBox.y).toBeGreaterThanOrEqual(0);
    expect(receiptModalBox.y + receiptModalBox.height).toBeLessThanOrEqual(mobileViewport.height);
    await expect(page.getByTestId('guest-trip-receipt-close-button')).toBeVisible();

    const receiptFollowup = page.getByTestId('guest-trip-receipt-pending-followup');
    await expect(receiptFollowup).toBeVisible();
    await expect(receiptFollowup).toContainText('입금이 확인되면 예약 내역과 알림에서 상태가 바뀝니다. 계속 입금 대기 상태라면 고객센터에 문의해주세요.');
    await expect(receiptFollowup.getByRole('link', { name: '고객센터 문의하기' })).toHaveAttribute('href', '/help');
    const receiptSaveButton = page.getByTestId('guest-trip-receipt-save-button');
    await receiptSaveButton.scrollIntoViewIfNeeded();
    await expect(receiptSaveButton).toBeVisible();
    await expect(page.getByText(bookingId).first()).toBeVisible();
  });

  test('shows review pending guidance and support CTA for host-unavailable review requests', async ({ page }) => {
    const host = createUser('host.review.pending');
    const guest = createUser('guest.review.pending');

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;

    const experienceId = await createHostExperience(hostId);
    const bookingId = await createFuturePaidBooking({
      guestId,
      guest,
      experienceId,
    });

    const { error: reviewMarkerError } = await supabase
      .from('bookings')
      .update({
        cancel_reason: formatHostUnavailableReviewMarker('host cannot proceed'),
      })
      .eq('id', bookingId);

    if (reviewMarkerError) throw reviewMarkerError;

    await login(page, guest);
    await page.goto('/guest/trips', { waitUntil: 'networkidle' });
    await expect(page.getByText('호스트 진행 불가 사유를 운영팀이 검토 중입니다.').last()).toBeVisible();
    await expect(page.getByText('보통 영업일 기준 검토 후 알림으로 안내됩니다. 급한 경우 고객센터로 문의해주세요.').last()).toBeVisible();
    await expect(page.getByTestId('guest-trip-review-support-link').last()).toHaveAttribute('href', '/help');
  });

  test('shows host notice on experience detail and payment summary', async ({ page }) => {
    const host = createUser('host.notice');
    const guest = createUser('guest.notice');
    const hostId = await createAuthUser(host);
    await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const notice = '이 체험은 최소 2인부터 진행됩니다. 인원이 모이지 않으면 일정 조정 또는 취소가 있을 수 있습니다.';
    const experienceId = await createHostExperience(hostId, { hostNotice: notice });

    await login(page, guest);

    await page.goto(`/experiences/${experienceId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(/호스트 안내|Host note|ホストからの案内|主办方提醒/)).toBeVisible();
    await expect(page.getByText(notice)).toBeVisible();

    await page.goto(`/experiences/${experienceId}/payment?date=2099-12-31&time=18:00&guests=2`, { waitUntil: 'networkidle' });
    await expect(page.getByText(/예약 전 확인해주세요|Please read before booking|予約前にご確認ください|请在预订前确认/)).toBeVisible();
    await expect(page.getByText(notice)).toBeVisible();
  });

  test('shows review pending guidance for minimum-participants review requests', async ({ page }) => {
    const host = createUser('host.minimum.participants');
    const guest = createUser('guest.minimum.participants');

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const supabase = getAdminClient();
    const { error: hostProfileError } = await supabase
      .from('profiles')
      .update({
        full_name: host.fullName,
        avatar_url: '/images/logo.png',
      })
      .eq('id', hostId);

    if (hostProfileError) throw hostProfileError;

    const experienceId = await createHostExperience(hostId);
    const bookingId = await createFuturePaidBooking({
      guestId,
      guest,
      experienceId,
    });

    const { error: reviewMarkerError } = await supabase
      .from('bookings')
      .update({
        cancel_reason: formatBookingReviewMarker('minimum_participants_unmet', 'minimum 2 guests required'),
      })
      .eq('id', bookingId);

    if (reviewMarkerError) throw reviewMarkerError;

    await login(page, guest);
    await page.goto('/guest/trips', { waitUntil: 'networkidle' });
    await expect(page.getByText('최소 진행 인원 미달 사유를 운영팀이 검토 중입니다.').last()).toBeVisible();
    await expect(page.getByText('보통 영업일 기준 검토 후 알림으로 안내됩니다. 급한 경우 고객센터로 문의해주세요.').last()).toBeVisible();
    await expect(page.getByTestId('guest-trip-review-support-link').last()).toHaveAttribute('href', '/help');
  });

  test('renders payment complete copy in the selected locale', async ({ page }) => {
    const host = createUser('host.payment.locale');
    const guest = createUser('guest.payment.locale');
    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const experience = await createLocalizedHostExperience(hostId);
    const bookingId = await createFuturePaidBooking({
      guestId,
      guest,
      experienceId: experience.id,
    });

    await login(page, guest);

    const localeExpectations = [
      { locale: 'en', title: 'Your booking is confirmed!', cta: 'Go to Messages' },
      { locale: 'ja', title: '予約が確定しました！', cta: 'メッセージへ移動' },
      { locale: 'zh', title: '预订已确认！', cta: '前往消息' },
    ] as const;

    for (const expectation of localeExpectations) {
      await page.evaluate(({ locale }) => {
        window.localStorage.setItem('app_lang', locale);
        document.cookie = `app_lang=${locale}; path=/`;
      }, expectation);

      await page.goto(`/experiences/${experience.id}/payment/complete?orderId=${bookingId}`, { waitUntil: 'networkidle' });
      await expect(page.getByText(expectation.title)).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(expectation.cta) })).toBeVisible();
    }
  });
});
