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
const createdApplicationIds: string[] = [];

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

function createUser(prefix: string): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.host.register.revision.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Register Revision ${timestamp}`,
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

async function createRevisionHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const existingSource = `existing-source-${Date.now()}`;
  const existingSelfIntro = '호스트 재제출 UI 검증용 기존 자기소개입니다. 수정 전 상태에서도 최소 글자 수를 충분히 넘기도록 길게 작성한 소개문입니다.';
  const existingMotivation = '호스트 재제출 UI 검증용 기존 지원 동기입니다. 수정 후에도 같은 row가 pending으로 되돌아가는지 보기 위해 충분한 길이로 준비했습니다.';

  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: 'Korea',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1990.01.01',
      email: user.email,
      instagram: '@codex_host_revision_existing',
      source: existingSource,
      language_cert: 'TOPIK 6',
      profile_photo: 'https://example.com/profile.png',
      self_intro: existingSelfIntro,
      id_card_file: 'id_card/existing-revision-upload.png',
      bank_name: '기존은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: existingMotivation,
      status: 'revision',
      admin_comment: '자기소개와 지원 동기를 조금 더 구체적으로 보완해 주세요.',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create revision host application.');
  }

  createdApplicationIds.push(String(data.id));
  return {
    applicationId: String(data.id),
    existingSource,
    existingSelfIntro,
    existingMotivation,
  };
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

  for (const applicationId of createdApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('revision host can reopen the application form and re-submit the same row as pending', async ({ page }) => {
  test.setTimeout(120000);

  const user = createUser('ui');
  const userId = await createAuthUser(user);
  const { applicationId, existingSource, existingSelfIntro, existingMotivation } = await createRevisionHostApplication(userId, user);
  const nextMotivation = `${existingMotivation} 재제출 단계에서 내용을 한 줄 더 보완했습니다.`;

  await login(page, user);
  await page.goto('/host/dashboard', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /보완이 필요합니다|Revision Required|修正が必要です|需要补充信息/ })
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/자기소개와 지원 동기를 조금 더 구체적으로 보완해 주세요\./)).toBeVisible();

  await page.getByRole('button', { name: /신청서 수정하기|Edit Application|申請書を修正|修改申请书/ }).click();
  await page.waitForURL('**/host/register', { timeout: 15000 });

  await page.getByRole('button', { name: /한국인|Korean/ }).first().click();
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  await page.getByRole('button', { name: /한국어|Korean|韓国語|韩语/ }).first().click();
  await page.getByRole('button', { name: 'Lv.5' }).first().click();
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  const nameInput = page.locator('input[placeholder="홍길동"], input[placeholder="John Doe"]').first();
  const phoneInput = page.locator('input[placeholder="010-1234-5678"]').first();
  const emailInput = page.locator('input[placeholder="example@gmail.com"]').first();
  const sourceInput = page.locator(
    'input[placeholder="예) 인스타, 지인 추천"], input[placeholder="e.g. Instagram, friend referral"], input[placeholder="例）Instagram、知人の紹介"], input[placeholder="例如：Instagram、朋友推荐"]'
  ).first();

  await expect(nameInput).toHaveValue(user.fullName);
  await expect(phoneInput).toHaveValue(user.phone);
  await expect(emailInput).toHaveValue(user.email);
  await expect(sourceInput).toHaveValue(existingSource);
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  const selfIntroInput = page.locator('textarea').first();
  await expect(selfIntroInput).toHaveValue(existingSelfIntro);
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  const bankNameInput = page.locator(
    'input[placeholder="예) 카카오뱅크, 신한은행 / みずほ銀行(渋谷支店)"], input[placeholder="e.g. KakaoBank, Shinhan Bank / Mizuho Bank (Shibuya Branch)"], input[placeholder="例）楽天銀行、三井住友銀行 / みずほ銀行（渋谷支店）"], input[placeholder="例如：KakaoBank、Shinhan Bank / 瑞穗银行（涩谷支店）"]'
  ).first();
  const accountHolderInput = page.locator(
    'input[placeholder="본인 실명"], input[placeholder="Your legal name"], input[placeholder="本人の実名"], input[placeholder="本人实名"]'
  ).first();
  await expect(bankNameInput).toHaveValue('기존은행');
  await expect(accountHolderInput).toHaveValue(user.fullName);
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  const motivationInput = page.locator('textarea').first();
  await expect(motivationInput).toHaveValue(existingMotivation);
  await motivationInput.fill(nextMotivation);
  await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).click();

  const submitResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/host/register/submit') &&
      response.request().method() === 'POST' &&
      response.status() === 200
  );

  await page.getByRole('button', { name: /신청 완료하기|Submit application|申請を完了する|完成申请/ }).click();

  const submitResponse = await submitResponsePromise;
  await expect(
    Promise.resolve(submitResponse.request().postDataJSON() as { source?: string; motivation?: string })
  ).resolves.toMatchObject({
    source: existingSource,
    motivation: nextMotivation,
  });
  await expect(submitResponse.json()).resolves.toMatchObject({
    success: true,
    applicationId,
    status: 'pending',
    notifyAdmin: true,
  });

  await page.waitForURL('**/host/dashboard', { timeout: 15000 });
  await expect(
    page.getByRole('heading', { name: /심사가 진행 중입니다|Application Pending|審査中です|正在审核中/ })
  ).toBeVisible({ timeout: 15000 });

  const supabase = getAdminClient();
  const { data: application, error } = await supabase
    .from('host_applications')
    .select('id, status, source, motivation')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) throw error;

  expect(application).toMatchObject({
    id: applicationId,
    status: 'pending',
    source: existingSource,
    motivation: nextMotivation,
  });
});
