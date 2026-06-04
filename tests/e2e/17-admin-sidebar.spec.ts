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
    email: `codex.sidebar.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Sidebar Admin ${timestamp}`,
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
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function installUnhandledRejectionTracker(page: Page) {
  await page.addInitScript(() => {
    const trackedWindow = window as Window & { __codexUnhandledRejections?: string[] };
    trackedWindow.__codexUnhandledRejections = [];
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      trackedWindow.__codexUnhandledRejections?.push(
        reason instanceof Error ? reason.message : String(reason)
      );
    });
  });
}

async function installAuthUserAbortPatch(page: Page) {
  await page.addInitScript(() => {
    const trackedWindow = window as Window & { __codexAbortedAuthUserRequests?: number };
    const originalFetch = window.fetch.bind(window);

    trackedWindow.__codexAbortedAuthUserRequests = 0;
    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input instanceof URL
              ? input.toString()
              : String(input);

      if (url.includes('/auth/v1/user')) {
        trackedWindow.__codexAbortedAuthUserRequests = (trackedWindow.__codexAbortedAuthUserRequests ?? 0) + 1;
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      return originalFetch(input, init);
    };
  });

  return () => page.evaluate(() => {
    const trackedWindow = window as Window & { __codexAbortedAuthUserRequests?: number };
    return trackedWindow.__codexAbortedAuthUserRequests ?? 0;
  });
}

async function getUnhandledRejections(page: Page) {
  return page.evaluate(() => {
    const trackedWindow = window as Window & { __codexUnhandledRejections?: string[] };
    return trackedWindow.__codexUnhandledRejections ?? [];
  });
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

test.describe.serial('Admin sidebar smoke', () => {
  test('keeps the Admin Alerts sidebar label plain even when unread alerts exist', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    const adminUserId = await createAuthUser(adminUser);

    await insertAdminAlert(adminUserId, '코덱스 사이드바 알림 A', '첫 번째 사이드바 알림');
    await insertAdminAlert(adminUserId, '코덱스 사이드바 알림 B', '두 번째 사이드바 알림');

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=APPROVALS', { waitUntil: 'domcontentloaded' });

    const alertsButton = page.getByRole('button', { name: /Admin Alerts/i });
    await expect(alertsButton).toHaveText('Admin Alerts', { timeout: 15000 });
  });

  test('normalizes legacy payout tab queries to the official SALES tab', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    await createAuthUser(adminUser);

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=SETTLEMENT', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => new URL(page.url()).searchParams.get('tab'))
      .toBe('SALES');

    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('admin_active_tab')))
      .toBe('SALES');

    await page.goto('/admin/dashboard?tab=PAYOUTS', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => new URL(page.url()).searchParams.get('tab'))
      .toBe('SALES');

    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('admin_active_tab')))
      .toBe('SALES');
  });

  test('keeps APPS and EXPS legacy aliases reachable as approvals compatibility views', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    await createAuthUser(adminUser);

    await login(page, adminUser);

    await page.goto('/admin/dashboard?tab=APPS', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('호스트 지원서')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '처리완료' })).toBeVisible();

    await page.goto('/admin/dashboard?tab=EXPS', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('등록된 체험')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '승인완료' })).toBeVisible();
  });

  test('handles aborted Admin Alerts auth bootstrap without browser regressions', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    await createAuthUser(adminUser);
    await login(page, adminUser);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    await installUnhandledRejectionTracker(page);
    const getAbortedRequestCount = await installAuthUserAbortPatch(page);

    await page.goto('/admin/dashboard?tab=ALERTS', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Admin Alerts' })).toBeVisible({ timeout: 15000 });
    await expect.poll(getAbortedRequestCount, { timeout: 15000 }).toBeGreaterThan(0);
    await expect(page.getByText('운영 알림이 여기에 쌓입니다.')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
    expect(await getUnhandledRejections(page)).toEqual([]);
  });

  test('handles aborted Master Ledger auth bootstrap without browser regressions', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    await createAuthUser(adminUser);
    await login(page, adminUser);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    await installUnhandledRejectionTracker(page);
    const getAbortedRequestCount = await installAuthUserAbortPatch(page);

    await page.goto('/admin/dashboard?tab=LEDGER', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Total Sales')).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder('검색 (이름, 예약번호)')).toBeVisible({ timeout: 15000 });
    await expect.poll(getAbortedRequestCount, { timeout: 15000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
    expect(await getUnhandledRejections(page)).toEqual([]);
  });
});
