import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

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
const createdProxyRequestIds: string[] = [];
const createdInquiryIds: string[] = [];

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

async function waitForNotification(params: {
  userId: string;
  title: string;
  type?: string;
  linkIncludes?: string;
}) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let query = supabase
      .from('notifications')
      .select('id, user_id, type, title, message, link, created_at')
      .eq('user_id', params.userId)
      .eq('title', params.title)
      .order('created_at', { ascending: false })
      .limit(5);

    if (params.type) {
      query = query.eq('type', params.type);
    }

    const { data, error } = await query;
    if (error) throw error;

    const matched = (data || []).find((row) => {
      if (!params.linkIncludes) return true;
      return typeof row.link === 'string' && row.link.includes(params.linkIncludes);
    });

    if (matched) {
      return matched;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Notification not found for ${params.userId}: ${params.title}`);
}

function createTestUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `${prefix} ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

async function createAuthUser(user: TestUser, options?: { whitelistAdmin?: boolean }) {
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
    .update({ full_name: user.fullName, phone: user.phone, email: user.email })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  if (options?.whitelistAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
    createdWhitelistEmails.push(user.email);
  }

  return data.user.id;
}

async function setPreferredLocale(userId: string, locale: 'ko' | 'en' | 'ja' | 'zh') {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw error || new Error(`Failed to fetch auth user ${userId}.`);

  const metadata =
    data.user.user_metadata && typeof data.user.user_metadata === 'object'
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...metadata,
      preferred_locale: locale,
    },
  });

  if (updateError) throw updateError;
}

async function login(page: Page, user: TestUser, locale: 'ko' | 'en' | 'ja' | 'zh' = 'ko') {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((nextLocale) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('app_lang', nextLocale);
    document.cookie = `app_lang=${nextLocale}; path=/; samesite=lax`;
  }, locale);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

async function createIsolatedPage(browser: Browser, user: TestUser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdProxyRequestIds.length > 0) {
    await supabase.from('proxy_comments').delete().in('request_id', createdProxyRequestIds);
    await supabase.from('proxy_requests').delete().in('id', createdProxyRequestIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
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

test.describe.serial('Proxy booking team workspace flow', () => {
  test('routes from home service card and lets admin reply from TEAM phone reservation tab', async ({ browser }) => {
    test.setTimeout(120000);

    const adminUser = createTestUser('proxy.admin');
    const customerUser = createTestUser('proxy.customer');

    const adminUserId = await createAuthUser(adminUser, { whitelistAdmin: true });
    const customerUserId = await createAuthUser(customerUser);
    await setPreferredLocale(adminUserId, 'ko');
    await setPreferredLocale(customerUserId, 'ko');

    try {
      const customerSession = await createIsolatedPage(browser, customerUser);
      const customerPage = customerSession.page;

      const restaurantName = `테스트 스시 ${Date.now()}`;
      const today = new Date();
      const targetDay = Math.min(today.getDate() + 3, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
      const targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

      await customerPage.goto('/', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(customerPage);
      await customerPage.getByRole('button', { name: '서비스' }).first().click();
      await customerPage.getByRole('link', { name: /일본 전화 예약 · 문의 대행/ }).click();
      await customerPage.waitForURL(/\/proxy-bookings\/new/, { timeout: 15000 });
      await dismissAnnouncementIfVisible(customerPage);
      await expect(customerPage.getByRole('heading', { name: '일본인이 대신 전화 예약을 도와드립니다' })).toBeVisible({ timeout: 15000 });

      await customerPage.getByPlaceholder('예: 스시 지로').fill(restaurantName);
      await customerPage.getByTestId('preferred-slot-primary-trigger').click();
      await customerPage.getByTestId(`preferred-slot-primary-day-${targetDate}`).click();
      await customerPage.getByTestId('preferred-slot-primary-time-19:00').click();
      await customerPage.getByTestId('preferred-slot-primary-confirm').scrollIntoViewIfNeeded();
      await customerPage.getByTestId('preferred-slot-primary-confirm').click();

      await customerPage.getByTestId('preferred-slot-secondary-trigger').click();
      await customerPage.getByTestId(`preferred-slot-secondary-day-${targetDate}`).click();
      await customerPage.getByTestId('preferred-slot-secondary-time-19:30').click();
      await customerPage.getByTestId('preferred-slot-secondary-confirm').scrollIntoViewIfNeeded();
      await customerPage.getByTestId('preferred-slot-secondary-confirm').click();

      await customerPage.getByTestId('preferred-slot-tertiary-trigger').click();
      await customerPage.getByTestId(`preferred-slot-tertiary-day-${targetDate}`).click();
      await customerPage.getByTestId('preferred-slot-tertiary-time-20:00').click();
      await customerPage.getByTestId('preferred-slot-tertiary-confirm').scrollIntoViewIfNeeded();
      await customerPage.getByTestId('preferred-slot-tertiary-confirm').click();
      await customerPage.getByPlaceholder('예: 홍길동').first().fill(customerUser.fullName);
      await customerPage.locator('input[type="number"]').first().fill('2');
      await customerPage.getByPlaceholder('예: 01012345678').first().fill(customerUser.phone);
      await customerPage.getByPlaceholder('결제 시 입력한 구매자 성함을 입력해주세요.').fill(customerUser.fullName);
      await customerPage.locator('input[type="checkbox"]').nth(0).check();
      await customerPage.locator('input[type="checkbox"]').nth(1).check();
      await customerPage.getByRole('button', { name: '요청 제출하기' }).click();

      await customerPage.waitForURL(/\/guest\/inbox\?inquiryId=/, { timeout: 15000 });
      const inboxUrl = new URL(customerPage.url());
      const inquiryId = inboxUrl.searchParams.get('inquiryId');
      expect(inquiryId).toBeTruthy();
      createdInquiryIds.push(inquiryId!);

      const { data: createdRequest } = await getAdminClient()
        .from('proxy_requests')
        .select('id')
        .eq('user_id', customerUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(createdRequest?.id).toBeTruthy();
      createdProxyRequestIds.push(String(createdRequest!.id));

      const adminAlert = await waitForNotification({
        userId: adminUserId,
        type: 'admin_alert',
        title: '새 전화 예약 요청이 접수되었습니다',
        linkIncludes: `proxyRequestId=${createdRequest!.id}`,
      });
      expect(adminAlert.link).toContain('teamTab=proxy');
      expect(adminAlert.message).toContain('식당 예약 문의');

      const adminSession = await createIsolatedPage(browser, adminUser);
      const adminPage = adminSession.page;

      await adminPage.goto(`/admin/dashboard?tab=TEAM&teamTab=proxy&proxyRequestId=${createdRequest!.id}`, { waitUntil: 'networkidle' });
      await expect(adminPage.getByRole('heading', { name: '전화 예약', exact: true })).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByText('운영 빠른 안내')).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByText(/입금 확인 필요 \d+건/)).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByRole('heading', { name: restaurantName })).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByText('입금 확인 또는 결제 취소를 먼저 처리해야 실제 전화 진행을 시작할 수 있습니다.').first()).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByRole('button', { name: '진행 중', exact: true })).toBeDisabled();
      await expect(adminPage.getByRole('button', { name: '완료', exact: true })).toBeDisabled();

      await adminPage.getByRole('button', { name: '입금 확인', exact: true }).click();
      await expect(adminPage.getByText('현재 결제 상태:')).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByText('결제 완료').first()).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByText('결제는 끝난 상태입니다. 이제 진행 상태를 갱신하고, 댓글로 고객에게 예약 진행 상황을 남겨주는 것이 가장 중요합니다.')).toBeVisible({ timeout: 15000 });
      await expect(adminPage.getByRole('button', { name: '진행 중', exact: true })).toBeEnabled();

      await waitForNotification({
        userId: customerUserId,
        type: 'booking_confirmed',
        title: '전화 예약 결제가 확인되었습니다',
        linkIncludes: `inquiryId=${inquiryId}`,
      });

      await adminPage.getByRole('button', { name: '진행 중', exact: true }).click();
      await expect(adminPage.locator('div').filter({ hasText: /현재 상태:\s*진행 중/ }).first()).toBeVisible({ timeout: 15000 });

      const replyInput = adminPage.getByPlaceholder('고객에게 보낼 답글을 입력하세요.');
      await expect(replyInput).toBeVisible({ timeout: 15000 });

      const replyText = `예약이 완료되었습니다. 19:00로 확정되었습니다. ${Date.now()}`;
      await replyInput.fill(replyText);
      await adminPage.locator('form').filter({ has: replyInput }).getByRole('button').click();
      await expect(adminPage.getByText(replyText)).toBeVisible({ timeout: 15000 });
      await expect(customerPage.getByText(replyText)).toBeVisible({ timeout: 15000 });

    } finally {
    }
  });
});
