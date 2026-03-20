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

function createRoleAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.role.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Role Admin ${timestamp}`,
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

  const { error: roleError } = await supabase
    .from('users')
    .upsert(
      {
        id: data.user.id,
        email: user.email,
        role: 'admin',
      },
      { onConflict: 'id' }
    );

  if (roleError) throw roleError;

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

async function waitForAdminAccessFetch(page: Page) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get('/api/admin/access', { failOnStatusCode: false });
        if (!response.ok()) return false;
        const result = await response.json();
        return result?.success === true && result?.isAdmin === true;
      },
      { timeout: 15000 }
    )
    .toBe(true);
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Admin role-only access', () => {
  test('users.role admin can access header, account, and admin dashboard without whitelist', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createRoleAdminUser();
    await createAuthUser(adminUser);

    await login(page, adminUser);
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAdminAccessFetch(page);

    const desktopMenuTrigger = page.locator('header div.select-none').first();
    await desktopMenuTrigger.click();
    await expect(page.getByRole('link', { name: 'Admin', exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await waitForAdminAccessFetch(page);
    await expect(page.getByText('Admin', { exact: true }).last()).toBeVisible({ timeout: 15000 });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole('button', { name: /Admin Alerts/i })).toBeVisible();
  });
});
