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
    email: `codex.analytics.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Analytics Admin ${timestamp}`,
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

async function closeAnalyticsModal(page: Page) {
  const overlay = page.locator('div.fixed.inset-0.z-50');
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await overlay.click({ position: { x: 10, y: 10 } });
  await expect(overlay).toBeHidden({ timeout: 10000 });
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Admin analytics smoke', () => {
  test('shows platform-wide KPI copy and experience-only section copy correctly', async ({ page }) => {
    test.setTimeout(90000);

    const adminUser = createAdminUser();
    await createAuthUser(adminUser);

    const analyticsHostSummaryPromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/analytics-host-summary') && response.request().method() === 'GET'
    );

    await login(page, adminUser);
    await page.goto('/admin/dashboard?tab=ANALYTICS', { waitUntil: 'networkidle' });
    await analyticsHostSummaryPromise;

    await expect(page.getByRole('heading', { name: '데이터 심층 분석' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Business & Guest' })).toBeVisible();

    await test.step('Show platform-wide KPI scope labels', async () => {
      await expect(page.getByText('총 거래액 (GMV)')).toBeVisible();
      await expect(page.getByText('체험 + 서비스 결제', { exact: true })).toBeVisible();
      await expect(page.getByText('플랫폼 순수익')).toBeVisible();
      await expect(page.getByText('플랫폼 전체 기준', { exact: true })).toBeVisible();
      await expect(page.getByText('객단가 (AOV)')).toBeVisible();
      await expect(page.getByText('전체 결제 건 기준', { exact: true })).toBeVisible();
      await expect(page.getByText('반복 결제 고객 비율')).toBeVisible();
      await expect(page.getByText('체험 + 서비스 결제 고객', { exact: true })).toBeVisible();
    });

    await test.step('Show experience-only section copy', async () => {
      await expect(page.getByText('취소율')).toBeVisible();
      await expect(page.getByText('체험 예약 기준', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: /체험 검색 인기 트렌드/ })).toBeVisible();
      await expect(page.getByText('체험 예약 결제 완료 건수 기준', { exact: true })).toBeVisible();
    });

    await test.step('Open GMV modal with platform-wide explanation', async () => {
      await page.getByText('총 거래액 (GMV)').click();
      await expect(page.getByRole('heading', { name: '🔥 최고 매출 기록일' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('선택하신 기간 내 체험 예약과 서비스 결제를 합친 하루 기준 최고 거래액입니다.')).toBeVisible();
      await closeAnalyticsModal(page);
    });

    await test.step('Open cancellation modal with experience-only explanation', async () => {
      await page.getByText('취소율').click();
      await expect(page.getByRole('heading', { name: '체험 예약 취소 사유 분석' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('이 구간은 서비스 의뢰가 아닌 체험 예약 취소 기준입니다. 호스트 거절이 많다면 달력 관리를 독려해야 합니다.')).toBeVisible();
      await closeAnalyticsModal(page);
    });

    await test.step('Open retention modal with platform-wide explanation', async () => {
      await page.getByText('반복 결제 고객 비율').click();
      await expect(page.getByRole('heading', { name: '기간 내 반복 결제 고객 비율' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/해당 기간 내 체험 예약과 서비스 결제를 합친 전체 결제 고객 중 2회 이상 결제한 고객 비율/)).toBeVisible();
      await closeAnalyticsModal(page);
    });

    await test.step('Open Host tab after host summary load', async () => {
      await page.getByRole('button', { name: 'Host Ecosystem' }).click();
      await expect(page.getByRole('heading', { name: /호스트 활성화 퍼널/ })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: /커뮤니케이션 현황/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: /호스트 생태계 통계/ })).toBeVisible();
    });
  });
});
