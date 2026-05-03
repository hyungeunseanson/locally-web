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
const REMINDER_DISMISS_KEY = 'locally_site_announcement_dismissed:host-create-experience-reminder-2026-05-03';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: string[] = [];
const createdExperienceIds: number[] = [];

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
    email: `codex.host.home.announcement.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Home Announcement ${prefix} ${timestamp}`,
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

async function createApprovedHostApplication(userId: string, user: TestUser, status: 'approved' | 'pending' = 'approved') {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Japan',
      languages: ['日本語'],
      language_levels: [{ language: '日本語', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990-01-01',
      email: user.email,
      instagram: '@codex_host_home_announcement',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'ホーム初回案内ポップアップ検証用ホストです。',
      id_card_file: '',
      bank_name: '테스트은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '홈 승인 호스트 체험 등록 안내 테스트입니다.',
      status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host application.');
  }

  createdApplicationIds.push(String(data.id));

  if (status === 'approved') {
    const { error: roleError } = await supabase
      .from('users')
      .update({ role: 'host' })
      .eq('id', userId);

    if (roleError) throw roleError;
  }
}

async function createHostExperience(hostId: string) {
  const { data, error } = await getAdminClient()
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '日本',
      city: 'Tokyo',
      title: `[Playwright] Host Home Reminder Existing ${Date.now()}`,
      category: '나이트라이프',
      languages: ['日本語'],
      language_levels: [{ language: '日本語', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: '既存体験があるホストにはホーム案内を出さないための検証用体験です。',
      itinerary: [{ title: '集合', description: '東京駅で集合します。' }],
      spots: 'Tokyo Station',
      meeting_point: 'Tokyo Station',
      location: 'Tokyo',
      photos: ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200'],
      price: 38000,
      inclusions: ['ガイド'],
      exclusions: ['食事'],
      supplies: '歩きやすい靴',
      rules: {
        age_limit: '18+',
        activity_level: 'easy',
      },
      status: 'approved',
      is_active: true,
      source_locale: 'ja',
      manual_locales: ['ja'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create host experience.');
  }

  createdExperienceIds.push(Number(data.id));
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

  await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), REMINDER_DISMISS_KEY);
  await page.waitForLoadState('networkidle');
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdExperienceIds.length > 0) {
    await supabase.from('experiences').delete().in('id', createdExperienceIds);
  }

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host home create-experience announcement', () => {
  test('shows a Japanese home popup to approved hosts with no experiences and opens create flow', async ({ page }) => {
    const user = createUser('zero-primary');
    const userId = await createAuthUser(user);
    await createApprovedHostApplication(userId, user);

    await login(page, user);
    await page.goto('/ja', { waitUntil: 'domcontentloaded' });

    const modal = page.getByTestId('global-site-announcement-modal');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).toContainText('お知らせ');
    await expect(modal).toContainText('ホスト承認が完了しました。次は体験登録です。');
    await expect(modal).toContainText('新しいLocallyではもう一度体験ページを作成する必要があります');

    await page.getByTestId('global-site-announcement-primary').click();
    await page.waitForURL(/\/host\/create/, { timeout: 15000 });
  });

  test('links the popup secondary action to company notices', async ({ page }) => {
    const user = createUser('zero-secondary');
    const userId = await createAuthUser(user);
    await createApprovedHostApplication(userId, user);

    await login(page, user);
    await page.goto('/ja', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('global-site-announcement-modal')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('global-site-announcement-secondary').click();
    await page.waitForURL(/\/company\/notices/, { timeout: 15000 });
  });

  test('does not show the popup to approved hosts who already have an experience', async ({ page }) => {
    const user = createUser('has-experience');
    const userId = await createAuthUser(user);
    await createApprovedHostApplication(userId, user);
    await createHostExperience(userId);

    await login(page, user);
    await page.goto('/ja', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('global-site-announcement-modal')).toHaveCount(0, { timeout: 5000 });
  });

  test('does not show the host popup to anonymous users or pending hosts', async ({ page }) => {
    await page.goto('/ja', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('global-site-announcement-modal')).toHaveCount(0);

    const user = createUser('pending');
    const userId = await createAuthUser(user);
    await createApprovedHostApplication(userId, user, 'pending');

    await login(page, user);
    await page.goto('/ja', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('global-site-announcement-modal')).toHaveCount(0, { timeout: 5000 });
  });
});
