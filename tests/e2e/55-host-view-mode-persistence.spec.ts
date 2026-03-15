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
    email: `codex.host.view.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host View ${prefix} ${timestamp}`,
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
      instagram: '@codex_host_view_mode',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: '호스트 뷰 유지 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 모드 유지 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
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

  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/account/);
}

test.use({ viewport: { width: 390, height: 844 } });

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('host view mode persistence', () => {
  test('host mode persists across public pages until explicit guest switch', async ({ page }) => {
    test.setTimeout(60000);

    const host = createUser('mobile');
    const hostId = await createAuthUser(host);
    await createApprovedHostApplication(hostId, host);

    await login(page, host);

    const hostModeButton = page.getByRole('button', { name: '호스트 모드로 전환' });
    await expect(hostModeButton).toBeVisible({ timeout: 15000 });
    await expect(hostModeButton).toBeEnabled();
    await hostModeButton.click();
    await expect(page.getByText('호스트 모드로 전환 중')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/\/host\/menu/, { timeout: 15000, waitUntil: 'domcontentloaded' });

    await page.goto('/community', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '예약' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '더보기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '프로필' })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '예약' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '더보기' })).toBeVisible();

    await page.goto('/become-a-host', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '예약' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '더보기' })).toBeVisible();

    await page.goto('/help', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '예약' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '더보기' })).toBeVisible();

    await page.goto('/host/menu', { waitUntil: 'domcontentloaded' });
    const guestModeButton = page.getByRole('button', { name: /게스트 모드로 전환/ });
    await expect(guestModeButton).toBeVisible({ timeout: 15000 });
    await guestModeButton.click();
    await expect(page.getByText('게스트 모드로 전환 중')).toBeVisible({ timeout: 5000 });
    await page.waitForURL(/\/account/, { timeout: 15000, waitUntil: 'domcontentloaded' });

    await page.goto('/community', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '프로필' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '예약' })).toHaveCount(0);
  });
});
