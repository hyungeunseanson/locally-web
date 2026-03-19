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
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdReviewIds: number[] = [];
const createdNotificationIds: number[] = [];
const createdAdminAlertIds: number[] = [];

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
    email: `codex.review.host.notification.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Review Host Notification ${prefix} ${timestamp}`,
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

async function createApprovedHostApplication(userId: string, user: TestUser) {
  const { data, error } = await getAdminClient()
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
      instagram: '@codex_review_notification',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '리뷰 알림 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '리뷰 알림 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(String(data.id));
}

async function createExperienceFixture(hostId: string) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title: `[Playwright] Review Host Notification ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '리뷰 알림 검증용 체험입니다.',
      itinerary: [{ title: '홍대입구역', description: '리뷰 알림 검증 코스입니다.' }],
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
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    experienceId: Number(data.id),
    title: String(data.title),
  };
}

async function createCompletedBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const bookingId = `REV-HOST-NOTI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() - 3);

  const { error } = await getAdminClient().from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: 'completed',
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: bookingDate.toISOString(),
    payment_method: 'card',
    host_payout_amount: 24000,
    platform_revenue: 9000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
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

  if (createdNotificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdNotificationIds);
  }

  if (createdAdminAlertIds.length > 0) {
    await supabase.from('notifications').delete().in('id', createdAdminAlertIds);
  }

  for (const reviewId of createdReviewIds) {
    await supabase.from('reviews').delete().eq('id', reviewId);
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

test.describe.serial('Review host notification runtime', () => {
  test('creates a host notification when a guest submits a review', async ({ page }) => {
    test.setTimeout(90000);

    const host = createUser('host');
    const guest = createUser('guest');
    const hostId = await createAuthUser(host);
    const guestId = await createAuthUser(guest);
    await createApprovedHostApplication(hostId, host);

    const experience = await createExperienceFixture(hostId);
    const bookingId = await createCompletedBooking({ guestId, guest, experienceId: experience.experienceId });

    await login(page, guest);

    const reviewContent = `리뷰 알림 검증 ${Date.now()}`;
    const reviewResult = await page.evaluate(
      async (payload) => {
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        experienceId: experience.experienceId,
        bookingId,
        rating: 5,
        content: reviewContent,
        photos: [],
      }
    );

    expect(reviewResult.status).toBe(200);
    expect(reviewResult.body.success).toBe(true);

    const supabase = getAdminClient();
    const { data: reviewRow, error: reviewError } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('user_id', guestId)
      .maybeSingle();

    if (reviewError) throw reviewError;
    if (reviewRow?.id) createdReviewIds.push(Number(reviewRow.id));

    const { data: notificationRow, error: notificationError } = await supabase
      .from('notifications')
      .select('id, type, link, title, message')
      .eq('user_id', hostId)
      .eq('type', 'new_review')
      .eq('link', '/host/dashboard?tab=reviews')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (notificationError) throw notificationError;

    expect(notificationRow?.type).toBe('new_review');
    expect(notificationRow?.link).toBe('/host/dashboard?tab=reviews');
    expect(notificationRow?.title).toBe('새 후기가 등록되었습니다');
    expect(notificationRow?.message).toContain(experience.title);

    if (notificationRow?.id) createdNotificationIds.push(Number(notificationRow.id));

    const { data: adminAlertRows, error: adminAlertError } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'admin_alert')
      .eq('title', '새 후기가 등록되었습니다')
      .eq('message', `'${experience.title}' 체험에 새 후기가 작성되었습니다.`);

    if (adminAlertError) throw adminAlertError;
    for (const row of adminAlertRows || []) {
      createdAdminAlertIds.push(Number(row.id));
    }
  });
});
