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
    email: `codex.host.register.visibility.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Register Visibility ${timestamp}`,
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

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('host register keeps previous button visible and shows self-intro language helper', async ({ page }) => {
  const user = createUser('visibility');
  await createAuthUser(user);
  await login(page, user);

  await page.goto('/host/register', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /국적은|nationality|国籍|国籍/ })).toBeVisible();

  const prevButton = page.getByTestId('host-register-prev-button').last();
  await expect(prevButton).toBeVisible();
  await expect(prevButton).toBeDisabled();

  await page.getByRole('button', { name: /Korean|한국인|Japanese|日本人/ }).first().click();
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();
  await expect(page.getByRole('heading', { name: /어떤 언어로 소통이|Which languages can|どの言語でコミュニケーション|可以使用哪些语言沟通/ })).toBeVisible();

  await page.getByRole('button', { name: /한국어|Korean|韓国語|韩语/ }).first().click();
  await page.getByRole('button', { name: 'Lv.5' }).first().click();
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  await expect(
    page.getByText(
      /정산과 신원 확인에 사용되는 이름입니다\.|This name is used for identity review and payouts\.|本人確認と精算に使われる名前です。|该姓名会用于身份审核和结算/
    )
  ).toBeVisible();

  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();
  await expect(page.getByRole('heading', { name: /호스트님의\s*연락처를 알려주세요|Tell us how to\s*reach you|連絡先を\s*教えてください|请告诉我们\s*您的联系方式/ })).toBeVisible();

  await page.locator('input[placeholder="홍길동"], input[placeholder="John Doe"]').fill(user.fullName);
  await page.locator('input[autocomplete="bday"]').fill('19900101');
  await page.locator('input[placeholder="010-1234-5678"]').fill(user.phone);
  await page.locator('input[placeholder="example@gmail.com"]').fill(user.email);
  await page.locator('input[placeholder="@locally.host"]').fill('@host_visibility');
  await page.locator('input[placeholder*="인스타"], input[placeholder*="Instagram"], input[placeholder*="インスタ"], input[placeholder*="小红书"]').fill('playwright');
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  await expect(
    page.getByText(
      /게스트가 가장 먼저 보는 사진이에요\.|This is often the first image guests notice\.|ゲストが最初に目にしやすい写真です。|这通常是游客最先看到的照片/
    )
  ).toBeVisible();

  await expect(
    page.getByText(
      /보여주고 싶은 게스트의 언어로 작성해주세요\.|Write this in the language of the guests you want to show it to\.|見せたいゲストの言語で作成してください。|请使用你想展示给游客看的语言来填写。/
    )
  ).toBeVisible();
});
