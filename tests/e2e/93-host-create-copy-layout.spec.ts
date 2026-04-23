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
const STEP1_SELECTION_HELP_REGEX =
  /검색과 추천 노출에 영향을 주는 기본 정보예요\.|This basic information affects search visibility and recommendations\.|検索表示やおすすめ表示に影響する基本情報です。|这是会影响搜索和推荐展示的基础信息。/;
const PHOTO_HELP_REGEX =
  /대표사진에는 호스트 얼굴이 보이는 사진을 최소 1장 이상 반드시 포함해주세요\.|Please include at least one hero photo showing the host’s face\.|代表写真には、ホスト本人の顔が見える写真を最低1枚以上必ず含めてください。|代表照片中请至少包含一张能看到房东本人脸部的照片。/;
const ADD_HERO_PHOTO_REGEX = /대표사진 추가|Add hero photo|代表写真を追加|添加代表照片/;

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

  await page.goto('/host/create', { waitUntil: 'networkidle' });

  const cityButton = page.getByRole('button', { name: /^(서울|Seoul|ソウル|首尔)$/ }).first();
  const categoryButton = page.getByRole('button', { name: /^(맛집 탐방|Food Tour|グルメ巡り|美食探索)$/ }).first();

  await expect(page.getByText(STEP1_SELECTION_HELP_REGEX)).toHaveCount(0);
  await expect(cityButton).toBeVisible();
  await cityButton.click();
  await expect(cityButton).toHaveClass(/bg-black/);
  await expect(categoryButton).toBeVisible();
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

  await expect(
    page.getByText(
      /게스트가 한눈에 이해할 수 있게 장소, 분위기, 핵심 경험이 드러나면 좋아요\.|A strong title quickly shows the place, mood, and core experience\.|場所、雰囲気、体験の核がひと目で伝わるタイトルが理想です。|如果能一眼看出地点、氛围和核心体验，会更吸引游客。/
    )
  ).toBeVisible();
  await expect(
    page.getByText(PHOTO_HELP_REGEX)
  ).toBeVisible();
  await expect(
    page.getByText(
      /인기 체험 노출은 게스트의 위시리스트 저장 수를 바탕으로 집계됩니다\. 저장하고 싶은 체험이 되도록 사진, 소개, 후기 경험을 꾸준히 관리해보세요\.|Popular experience placement is based on how many times guests save your experience to their wishlist\. Keep improving your photos, description, and review experience so your experience becomes one guests want to save\.|人気体験の表示は、ゲストのウィッシュリスト保存数をもとに集計されます。保存したくなる体験になるよう、写真・紹介文・レビュー体験を継続的に整えてみてください。|热门体验展示会根据游客加入愿望清单的保存数量进行统计。请持续优化照片、介绍和评价体验，让你的体验成为游客愿意先收藏的内容。/
    )
  ).toBeVisible();

  const addHeroPhotoTile = page.locator('label').filter({ hasText: ADD_HERO_PHOTO_REGEX }).first();
  const photoHelp = page.getByText(PHOTO_HELP_REGEX);

  await expect(addHeroPhotoTile).toBeVisible();
  await expect(photoHelp).toBeVisible();

  const addHeroPhotoBox = await addHeroPhotoTile.boundingBox();
  const photoHelpBox = await photoHelp.boundingBox();

  expect(addHeroPhotoBox).not.toBeNull();
  expect(photoHelpBox).not.toBeNull();
  expect(photoHelpBox!.y).toBeGreaterThan(addHeroPhotoBox!.y + addHeroPhotoBox!.height - 2);

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

  await expect(
    page.getByText(
      /게스트가 실제로 처음 만날 장소를 쉽게 찾을 수 있게 적어주세요\.|Write it so guests can easily find the exact first meeting spot\.|ゲストが最初に迷わず見つけられるように書いてください。|请写成游客第一次见面时能轻松找到的地点说明。/
    )
  ).toBeVisible();
  await page.getByText(/만나는 장소와 동선은 이렇게 생각해주세요|Think of meeting point and itinerary this way|集合場所と動線はこう考えると分かりやすいです|集合地点和流程可以这样理解/).click();
  await expect(
    page.getByText(
      /동선 예: 홍대 골목 산책|Itinerary example: Walk through local alleys|動線の例：ローカル路地散策|流程示例：本地巷子散步/
    )
  ).toBeVisible();

  await clickFooterButton(page, /다음|Next|次へ|下一步/);

  await page
    .locator(
      'textarea[placeholder="상세 소개글을 입력하세요. (최소 50자 이상)"], textarea[placeholder="Enter a detailed description. (At least 50 characters)"], textarea[placeholder="詳細紹介文を入力してください。（50文字以上推奨）"], textarea[placeholder="请输入详细介绍。（建议至少50字）"]'
    )
    .fill('This is a long enough description to move through the host create flow and verify the structured copy layout in the rules step.');
  const inclusionInput = page.locator(
    'input[placeholder="예) 음료"], input[placeholder="e.g. Drink"], input[placeholder="例）ドリンク"], input[placeholder="例如：饮品"]'
  );
  await inclusionInput.fill('a');
  await expect(
    page.getByText(
      /포함 사항은 두 글자 이상으로 구체적으로 입력해주세요\.|Make each inclusion specific and at least 2 characters long\.|含まれるものは2文字以上で具体的に入力してください。|包含内容请至少填写2个字并尽量具体。/
    )
  ).toBeVisible();
  await inclusionInput.fill('Welcome drink');
  await inclusionInput.press('Enter');

  await expect(
    page.getByText(
      /가격에 포함된 것을 명확히 써야 게스트가 안심합니다\.|Clear inclusions help guests feel confident about what they are paying for\.|料金に含まれる内容を明確にすると、ゲストが安心して予約できます。|明确写出价格中包含什么，游客会更安心。/
    )
  ).toBeVisible();

  await clickFooterButton(page, /다음|Next|次へ|下一步/);

  const refundPolicyCard = page.getByTestId('host-create-refund-policy-card');
  await expect(refundPolicyCard).toBeVisible();
  await expect(refundPolicyCard.getByTestId('host-create-refund-policy-chip-0')).toBeVisible();
  await expect(refundPolicyCard.getByTestId('host-create-refund-policy-chip-5')).toBeVisible();
  await expect(
    refundPolicyCard.getByText(
      /결제 당일 취소: 100%|Cancellation on the payment day: 100%|決済当日のキャンセル: 100%|付款当日取消：100%/
    )
  ).toBeVisible();
  await expect(
    refundPolicyCard.getByText(
      /체험일 당일\/지난 일정: 환불 불가|Experience day or past dates: Non-refundable|体験当日 \/ 過ぎた日程: 返金不可|行程当天\/已过日期：不可退款/
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      /게스트가 예약 전에 꼭 알아야 할 점을 적어주세요\.|Add anything guests should know before booking\.|予約前に必ず知っておいてほしいことを書いてください。|请写下游客在预订前一定要知道的内容。/
    )
  ).toBeVisible();
  await page
    .locator(
      'textarea[placeholder^="예) 골목길이 많아 편한 운동화를 추천해요"], textarea[placeholder^="e.g. There are a lot of alleys"], textarea[placeholder^="例）路地が多いので歩きやすいスニーカー"], textarea[placeholder^="例如：路线里有不少小巷"]'
    )
    .fill('Comfortable walking shoes are recommended. If it rains, part of the route may move indoors.');

  await page
    .locator(
      'input[placeholder="예) 만 7세 이상"], input[placeholder="e.g. Ages 7 and up"], input[placeholder="例）満7歳以上"], input[placeholder="例如：满7岁以上"]'
    )
    .fill('Ages 10 and up');

  await clickFooterButton(page, /다음|Next|次へ|下一步/);
  await expect(
    page.getByText(
      /게스트가 경험의 가치를 이해할 수 있도록 포함 항목과 함께 생각해주세요\.|Think about price together with duration, inclusions, and the value guests will feel\.|所要時間、含まれる内容、ゲストが感じる価値を一緒に考えて価格を決めてください。|请结合时长、包含内容和游客能感受到的价值来考虑价格。/
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      /1인 출발 확정 옵션|Guaranteed solo departure option|1名出発確定オプション|1人出发保障选项/
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      /혼자 예약한 게스트가 이 옵션을 선택하면 최소 인원 미달이어도 취소 없이 출발합니다\.|If a solo guest buys this option, the experience can go ahead without cancellation even when the minimum group size is not met\.|1名予約のゲストがこのオプションを選ぶと、最少人数に満たなくてもキャンセルなしで出発できます。|如果单人游客购买这个选项，即使未达到最低成团人数，也可以不取消直接出发。/
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      /\*추가 인원 모객 시 게스트에게 자동 환불|\*Automatically refunded to the guest if more people join later|\*後から参加者が増えた場合はゲストへ自動返金|\*后续有更多游客加入时，会自动退还给游客/
    )
  ).toBeVisible();
  await expect(page.getByText('+ ₩30,000')).toBeVisible();

  const basePriceInput = page.locator('input[inputmode="numeric"]').first();
  await basePriceInput.fill('');
  await expect(
    page.getByText(
      /기본 가격을 올바르게 입력해주세요\.|Enter a valid base price\.|基本価格を正しく入力してください。|请输入正确的基础价格。/
    )
  ).toBeVisible();
  await basePriceInput.fill('50000');
  await expect(basePriceInput).toHaveValue('50,000');
});
