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
const CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];

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
    email: `codex.team.mobile.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Team Mobile Admin ${timestamp}`,
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

  for (const userId of createdAuthUserIds) {
    await supabase.from('admin_task_comments').delete().eq('author_id', userId).eq('task_id', CHAT_ROOM_ID);
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

test.describe.serial('Admin team mobile smoke', () => {
  test('loads team workspace on mobile and switches across the current workspace tabs', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    await createAuthUser(adminUser);

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=TEAM', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder('오늘의 주요 업무')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Daily Log & Tasks' })).toBeVisible();
    await expect(page.getByRole('button', { name: /팀 메모장/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /전화 예약/ })).toBeVisible();

    await page.getByRole('button', { name: /팀 메모장/ }).click();
    await expect(page.getByRole('heading', { name: 'Team Knowledge Docs' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /새 메모 작성/ })).toBeVisible();

    await page.getByRole('button', { name: /전화 예약/ }).click();
    await expect(page.getByRole('heading', { name: '전화 예약', exact: true })).toBeVisible({ timeout: 15000 });
  });
});
