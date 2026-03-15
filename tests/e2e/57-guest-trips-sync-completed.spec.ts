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

async function createHostExperience(hostId: string) {
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
});
