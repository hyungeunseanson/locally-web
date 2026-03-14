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
    email: `codex.team.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Team Admin ${timestamp}`,
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
    await supabase.from('admin_task_comments').delete().eq('author_id', userId);
    await supabase.from('admin_tasks').delete().eq('author_id', userId);
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

test.describe.serial('Admin team smoke', () => {
  test('creates, updates, and deletes a daily log through admin team routes', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const adminUserId = await createAuthUser(adminUser);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=TEAM', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Team Sync HQ/i })).toBeVisible({ timeout: 15000 });

    const taskContent = `코덱스 팀 일지 ${Date.now()}`;
    const noteContent = 'server route smoke';

    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/team/tasks') &&
      response.request().method() === 'POST'
    );

    await page.getByPlaceholder('오늘의 주요 업무').fill(taskContent);
    await page.getByPlaceholder('비고').fill(noteContent);
    await page.getByRole('button', { name: '기록' }).click();
    await createResponsePromise;

    const row = page.locator('tr').filter({ hasText: taskContent }).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    const patchResponsePromise = page.waitForResponse((response) =>
      /\/api\/admin\/team\/tasks\/.+/.test(response.url()) &&
      response.request().method() === 'PATCH'
    );

    await row.getByRole('button', { name: 'Progress', exact: true }).click();
    await patchResponsePromise;
    await expect(row.getByRole('button', { name: 'Done', exact: true })).toBeVisible({ timeout: 15000 });

    const deleteResponsePromise = page.waitForResponse((response) =>
      /\/api\/admin\/team\/tasks\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE'
    );

    page.once('dialog', (dialog) => dialog.accept());
    await row.hover();
    await row.locator('button').last().click({ force: true });
    await deleteResponsePromise;

    await expect.poll(async () => {
      const { data, error } = await getAdminClient()
        .from('admin_tasks')
        .select('id', { count: 'exact' })
        .eq('author_id', adminUserId)
        .eq('content', taskContent);

      if (error) throw error;
      return Array.isArray(data) ? data.length : 0;
    }, {
      timeout: 15000,
      intervals: [500, 1000, 1500],
    }).toBe(0);
  });
});
