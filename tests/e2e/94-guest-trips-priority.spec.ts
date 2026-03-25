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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return adminClient;
}

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.guest.trips.priority.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Guest Trips Priority ${prefix} ${timestamp}`,
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

test.use({ viewport: { width: 390, height: 844 } });

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('guest trips UX priority', () => {
  test('opens the login modal when an unauthenticated user taps the trips tab', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByTestId('mobile-tab-guest-trips').click();

    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('shows upcoming trips before the custom-request helper section', async ({ page }) => {
    const guest = createUser('guest');
    await createAuthUser(guest);

    await page.addInitScript(() => {
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });

    await login(page, guest);
    await page.goto('/guest/trips', { waitUntil: 'networkidle' });

    const upcomingSection = page.locator('[data-testid="guest-trips-upcoming-section"]:visible').first();
    const serviceEmpty = page.getByTestId('guest-trips-service-empty').first();

    await expect(upcomingSection).toBeVisible();
    await expect(serviceEmpty).toBeVisible();
    await expect(serviceEmpty.getByText('맞춤 의뢰 등록하기')).toBeVisible();

    const upcomingBox = await upcomingSection.boundingBox();
    const serviceBox = await serviceEmpty.boundingBox();

    expect(upcomingBox?.y ?? 0).toBeLessThan(serviceBox?.y ?? 0);
  });
});
