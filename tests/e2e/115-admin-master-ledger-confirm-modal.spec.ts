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
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: number[] = [];
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
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.admin.ledger.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Admin Ledger ${prefix} ${timestamp}`,
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

async function createAuthUser(user: TestUser, isAdmin = false) {
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

  if (isAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

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
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_admin_ledger_host',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: 'Admin master ledger confirm regression 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: 'Admin master ledger confirm regression 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function createExperience(hostId: string) {
  const supabase = getAdminClient();
  const title = `[Playwright] Admin Ledger Confirm ${Date.now()}`;
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
      description: 'Admin master ledger confirm regression test fixture.',
      itinerary: [{ title: '서울역', description: '테스트 코스' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울 중구 통일로 1',
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
    throw error || new Error('Failed to create admin master ledger experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createPendingBankBooking(params: {
  guestId: string;
  guest: TestUser;
  experienceId: number;
}) {
  const supabase = getAdminClient();
  const bookingId = `ADMIN-LEDGER-CONFIRM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 5);

  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.guestId,
    experience_id: params.experienceId,
    amount: 33000,
    total_price: 30000,
    total_experience_price: 30000,
    status: 'PENDING',
    guests: 1,
    date: bookingDate.toISOString().slice(0, 10),
    time: '10:00',
    type: 'group',
    contact_name: params.guest.fullName,
    contact_phone: params.guest.phone,
    message: '',
    created_at: new Date().toISOString(),
    payment_method: 'bank',
    host_payout_amount: null,
    platform_revenue: null,
    payout_status: null,
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
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdBookingIds.length > 0) {
    await supabase.from('bookings').delete().in('id', createdBookingIds);
  }

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdHostApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdHostApplicationIds);
  }

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
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

test.describe.serial('Admin master ledger desktop confirm modal regression', () => {
  test('opens the desktop confirm modal and confirms a pending bank booking', async ({ page }) => {
    test.setTimeout(120000);

    const adminUser = createUser('admin');
    const hostUser = createUser('host');
    const guestUser = createUser('guest');

    await createAuthUser(adminUser, true);
    const hostId = await createAuthUser(hostUser);
    const guestId = await createAuthUser(guestUser);
    await createApprovedHostApplication(hostId, hostUser);
    const experienceId = await createExperience(hostId);
    const bookingId = await createPendingBankBooking({
      guestId,
      guest: guestUser,
      experienceId,
    });

    await page.setViewportSize({ width: 1440, height: 960 });
    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=LEDGER', { waitUntil: 'networkidle' });

    const searchInput = page.getByPlaceholder('검색 (이름, 예약번호)');
    await searchInput.fill(bookingId);

    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();

    const actionButton = page.getByTestId('admin-master-ledger-confirm-payment-action');
    await expect(actionButton).toBeVisible({ timeout: 10000 });
    await actionButton.click();

    const confirmDialog = page.getByTestId('admin-master-ledger-confirm-dialog-desktop');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('입금 확인');
    await expect(confirmDialog).toContainText('입금이 확인되었습니까? 예약을 확정합니다.');

    const confirmResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/bookings/confirm-payment') &&
        response.request().method() === 'POST',
      { timeout: 30000 }
    );

    await page.getByTestId('admin-master-ledger-confirm-dialog-desktop-confirm').click();
    const response = await confirmResponse;
    expect(response.ok()).toBeTruthy();

    await expect(confirmDialog).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('입금 확인 완료!')).toBeVisible({ timeout: 15000 });

    await expect
      .poll(async () => {
        const { data, error } = await getAdminClient()
          .from('bookings')
          .select('status, price_at_booking, total_experience_price, host_payout_amount, platform_revenue, payout_status')
          .eq('id', bookingId)
          .maybeSingle();

        if (error) throw error;
        return data;
      })
      .toMatchObject({
        status: 'confirmed',
        total_experience_price: 30000,
        host_payout_amount: 24000,
        platform_revenue: 9000,
        payout_status: 'pending',
      });
  });
});
