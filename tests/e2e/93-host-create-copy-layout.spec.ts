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
const TEST_IMAGE = 'tests/e2e/test-image.png';

let adminClient: SupabaseClient | null = null;
const createdAuthUserIds: string[] = [];
const createdApplicationIds: number[] = [];

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
    email: `codex.host.create.copy.${prefix}.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Host Create Copy ${timestamp}`,
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

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: user.fullName,
      phone: user.phone,
    })
    .eq('id', data.user.id);

  if (profileError) throw profileError;

  return data.user.id;
}

async function createApprovedHostApplication(userId: string, user: TestUser) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 3 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_host_create_copy',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 create 카피 레이아웃 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 create 카피 레이아웃 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(data.id);
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

  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/account/);
}

async function clickFooterButton(page: Page, name: RegExp) {
  await page.locator('footer').getByRole('button', { name }).click();
}

test.use({ viewport: { width: 390, height: 844 } });

test.afterAll(async () => {
  const supabase = getAdminClient();

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('host create shows structured primary language guidance and refund policy chips', async ({ page }) => {
  const host = createUser('layout');
  const hostId = await createAuthUser(host);
  await createApprovedHostApplication(hostId, host);

  await login(page, host);

  await page.goto('/host/create', { waitUntil: 'domcontentloaded' });

  const cityButton = page.locator('button').filter({ hasText: /^Seoul$/ }).first();
  const categoryButton = page.locator('button').filter({ hasText: /^Food Tour$/ }).first();

  await cityButton.click();
  await expect(cityButton).toHaveClass(/bg-black/);
  await categoryButton.click();
  await expect(categoryButton).toHaveClass(/border-\[#222\]/);
  await clickFooterButton(page, /다음|Next|次へ|下一步/);
  await expect(page.getByRole('heading', { name: /진행 가능한 언어|Available languages|対応可能な言語|这个体验可以用哪些语言进行？/ })).toBeVisible({ timeout: 10000 });

  const sourceLocaleCard = page.getByTestId('host-create-source-locale-card');
  await expect(sourceLocaleCard).toBeVisible();
  await expect(
    sourceLocaleCard.getByText(
      /주로 받고 싶은 게스트의 언어로 대표 소개를 작성해주세요\.|Write the main introduction in the language of the guests you want to attract most\.|主に受け入れたいゲストの言語で代表紹介文を作成してください。|请使用你主要想接待的游客语言来撰写主介绍。/
    )
  ).toBeVisible();
  await expect(
    sourceLocaleCard.getByText(
      /예: 한국인 게스트를 주로 받는다면 한국어를 선택해 작성하면 됩니다\.|Example: if you mainly want to host Korean guests, choose Korean\.|例：韓国人ゲストを主に受け入れたい場合は韓国語を選択してください。|例：如果你主要想接待韩国游客，就选择韩语。/
    )
  ).toBeVisible();
  await expect(
    sourceLocaleCard.getByText(
      /AI 자동 번역 및 보정이 진행됩니다\.|AI-translated and refined from this primary language\.|AI自動翻訳と補正が行われます。|AI 自动翻译和润色。/
    )
  ).toBeVisible();

  await page.getByRole('button', { name: /한국어|Korean|韓国語|韩语/ }).first().click();
  await page.getByRole('button', { name: 'Lv.5' }).first().click();
  await clickFooterButton(page, /다음|Next|次へ|下一步/);

  await page
    .locator(
      'input[placeholder="체험 제목을 입력하세요"], input[placeholder="Enter experience title"], input[placeholder="体験タイトルを入力してください"], input[placeholder="请输入体验标题"]'
    )
    .fill('Host Create Copy Test Experience');
  await page.locator('main input[type="file"][multiple]').setInputFiles(TEST_IMAGE);
  await expect(page.locator('img[alt="preview 0"]')).toBeVisible({ timeout: 15000 });
  await clickFooterButton(page, /다음|Next|次へ|下一步/);

  await page
    .locator(
      'input[placeholder="예) 스타벅스 홍대역점"], input[placeholder="e.g. Starbucks Hongdae Station"], input[placeholder="例）スターバックス弘大駅店"], input[placeholder="例如：弘大站星巴克"]'
    )
    .fill('Locally Host Create Meeting Point');
  await page
    .locator(
      'input[placeholder="예) 서울특별시 마포구 양화로 165"], input[placeholder="e.g. 165 Yanghwa-ro, Mapo-gu, Seoul"], input[placeholder="例）ソウル特別市 麻浦区 楊花路 165"], input[placeholder="例如：首尔特别市麻浦区杨花路165"]'
    )
    .fill('165 Yanghwa-ro, Mapo-gu, Seoul');
  await page
    .locator(
      'input[placeholder="장소 이름"], input[placeholder="Place name"], input[placeholder="Location name"], input[placeholder="場所名"], input[placeholder="地点名称"]'
    )
    .first()
    .fill('Host Create Copy Itinerary');
  await clickFooterButton(page, /다음|Next|次へ|下一步/);

  await page
    .locator(
      'textarea[placeholder="상세 소개글을 입력하세요. (최소 50자 이상)"], textarea[placeholder="Enter a detailed description. (At least 50 characters)"], textarea[placeholder="詳細紹介文を入力してください。（50文字以上推奨）"], textarea[placeholder="请输入详细介绍。（建议至少50字）"]'
    )
    .fill('This is a long enough description to move through the host create flow and verify the structured copy layout in the rules step.');
  const inclusionInput = page.locator(
    'input[placeholder="예) 음료"], input[placeholder="e.g. Drink"], input[placeholder="例）ドリンク"], input[placeholder="例如：饮品"]'
  );
  await inclusionInput.fill('Welcome drink');
  await inclusionInput.press('Enter');
  await clickFooterButton(page, /다음|Next|次へ|下一步/);

  const refundPolicyCard = page.getByTestId('host-create-refund-policy-card');
  await expect(refundPolicyCard).toBeVisible();
  await expect(refundPolicyCard.getByTestId('host-create-refund-policy-chip-0')).toBeVisible();
  await expect(refundPolicyCard.getByTestId('host-create-refund-policy-chip-5')).toBeVisible();
  await expect(
    refundPolicyCard.getByText(
      /결제 당일 취소 100%|100% on the payment day|決済当日のキャンセル100%|付款当日取消100%/
    )
  ).toBeVisible();
  await expect(
    refundPolicyCard.getByText(
      /당일 환불 불가|No refund on the day|当日返金不可|当天不可退款/
    )
  ).toBeVisible();
});
