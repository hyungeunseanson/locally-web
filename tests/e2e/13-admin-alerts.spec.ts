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
const createdNotificationIds: number[] = [];

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
  const timestamp = Date.now();
  return {
    email: `codex.alerts.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Alerts Admin ${timestamp}`,
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

  const { error: whitelistError } = await supabase
    .from('admin_whitelist')
    .upsert({ email: user.email }, { onConflict: 'email' });

  if (whitelistError) throw whitelistError;
  createdWhitelistEmails.push(user.email);

  return data.user.id;
}

async function insertAdminAlert(userId: string, title: string, message: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'admin_alert',
      title,
      message,
      link: '/admin/dashboard?tab=ALERTS',
      is_read: false,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to seed admin alert');
  }

  createdNotificationIds.push(data.id);
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

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Admin alerts smoke', () => {
  test('loads alerts and marks them read through admin routes', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const adminUserId = await createAuthUser(adminUser);

    await insertAdminAlert(adminUserId, '코덱스 관리자 알림 A', '첫 번째 관리자 알림입니다.');
    await insertAdminAlert(adminUserId, '코덱스 관리자 알림 B', '두 번째 관리자 알림입니다.');

    const alertsResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/alerts') && response.request().method() === 'GET'
    );

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=ALERTS', { waitUntil: 'networkidle' });
    await alertsResponsePromise;

    await expect(page.getByRole('heading', { name: 'Admin Alerts' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('코덱스 관리자 알림 A')).toBeVisible();
    await expect(page.getByText('코덱스 관리자 알림 B')).toBeVisible();

    await page.getByRole('button', { name: /Mark all read/i }).click();
    await page.getByRole('button', { name: 'Unread', exact: true }).click();
    await expect(page.getByText('읽지 않은 운영 알림이 없습니다.')).toBeVisible();
    await page.getByRole('button', { name: 'All', exact: true }).click();

    await page.getByText('코덱스 관리자 알림 A').click();
    await expect(page.getByText('첫 번째 관리자 알림입니다.')).toBeVisible();
  });
});
