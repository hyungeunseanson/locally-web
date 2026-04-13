import { readFileSync } from 'fs';
import path from 'path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { LIVE_BASE_URL } from './helpers/liveBaseUrl';

const HOST_EMAIL = 'codex.host.1772980212472@example.com';
const HOST_PASSWORD = 'LocallyTest!2026';
const HOST_FALLBACK_NAME = 'Codex Live Host';
const HOST_FALLBACK_PHONE = '01017720212';
type EnvMap = Record<string, string>;

let adminClient: SupabaseClient | null = null;
const createdExperienceIds: number[] = [];
const createdExperienceTitles: string[] = [];
const createdAdminAlertMessageFragments: string[] = [];

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

async function ensureApprovedLiveHostAccount() {
  const supabase = getAdminClient();
  let userId: string | null = null;

  const knownUserResult = await supabase.auth.admin.getUserById('cc84b331-7e78-4818-b9ba-f1a960017473');
  if (knownUserResult.data.user?.email?.toLowerCase() === HOST_EMAIL.toLowerCase()) {
    userId = knownUserResult.data.user.id;
  } else {
    const listedUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matchedUser = listedUsers.data.users.find((user) => user.email?.toLowerCase() === HOST_EMAIL.toLowerCase());
    if (matchedUser?.id) {
      userId = matchedUser.id;
    }
  }

  if (userId) {
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
      email: HOST_EMAIL,
      password: HOST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: HOST_FALLBACK_NAME,
        phone: HOST_FALLBACK_PHONE,
      },
    });

    if (updateUserError) throw updateUserError;
  } else {
    const createdUser = await supabase.auth.admin.createUser({
      email: HOST_EMAIL,
      password: HOST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: HOST_FALLBACK_NAME,
        phone: HOST_FALLBACK_PHONE,
      },
    });

    if (createdUser.error || !createdUser.data.user?.id) {
      throw createdUser.error || new Error(`Failed to create live host auth user for ${HOST_EMAIL}`);
    }

    userId = createdUser.data.user.id;
  }

  await waitForProfile(userId);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: HOST_FALLBACK_NAME,
      phone: HOST_FALLBACK_PHONE,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  const latestApplication = await supabase
    .from('host_applications')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestApplication.error) throw latestApplication.error;

  const hostApplicationPayload = {
    user_id: userId,
    host_nationality: '대한민국',
    languages: ['한국어'],
    language_levels: [{ language: '한국어', level: 5 }],
    name: HOST_FALLBACK_NAME,
    phone: HOST_FALLBACK_PHONE,
    dob: '1992-04-12',
    email: HOST_EMAIL,
    instagram: '@codex_live_host',
    source: 'playwright',
    language_cert: '',
    profile_photo: '',
    self_intro: '라이브 호스트 체험 등록 E2E 검증용 승인 호스트입니다.',
    id_card_file: '',
    bank_name: '국민은행',
    account_number: '12345678901234',
    account_holder: HOST_FALLBACK_NAME,
    motivation: '라이브 호스트 create 플로우 검증',
    status: 'approved',
  };

  if (latestApplication.data?.id) {
    const { error: updateApplicationError } = await supabase
      .from('host_applications')
      .update(hostApplicationPayload)
      .eq('id', latestApplication.data.id);

    if (updateApplicationError) throw updateApplicationError;
  } else {
    const { error: insertApplicationError } = await supabase
      .from('host_applications')
      .insert(hostApplicationPayload);

    if (insertApplicationError) throw insertApplicationError;
  }
}

const IMAGE_POOL = [
  path.resolve(process.cwd(), 'public/images/host-transition.png'),
  path.resolve(process.cwd(), 'public/images/guest-transition.png'),
  path.resolve(process.cwd(), 'public/images/logo-new-black.png'),
  path.resolve(process.cwd(), 'public/images/logo.png'),
];

function pickUploadImages() {
  const shuffled = [...IMAGE_POOL].sort(() => Math.random() - 0.5);
  return {
    heroImages: shuffled.slice(0, 3),
    itineraryImage: shuffled[3] || shuffled[0],
  };
}

async function clickFooterButton(page: import('@playwright/test').Page, pattern: RegExp) {
  await page.locator('footer').getByRole('button', { name: pattern }).click();
}

test.afterAll(async () => {
  const supabase = getAdminClient();
  const experienceIds = new Set<number>(createdExperienceIds);

  for (const messageFragment of createdAdminAlertMessageFragments) {
    await supabase
      .from('notifications')
      .delete()
      .eq('type', 'admin_alert')
      .ilike('message', `%${messageFragment}%`);
  }

  for (const title of createdExperienceTitles) {
    const { data, error } = await supabase
      .from('experiences')
      .select('id')
      .eq('title', title);

    if (error) throw error;
    for (const row of data || []) {
      if (row?.id != null) {
        experienceIds.add(Number(row.id));
      }
    }
  }

  for (const experienceId of experienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }
});

test.describe.serial('Live approved host experience creation flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(240000);

  test('logs in as approved host and creates an experience with image uploads', async ({ page }, testInfo) => {
    const browserIssues: string[] = [];
    const uploads = pickUploadImages();
    const experienceTitle = `[Playwright] Live Host Experience ${Date.now()}`;
    createdExperienceTitles.push(experienceTitle);
    createdAdminAlertMessageFragments.push(experienceTitle);

    await ensureApprovedLiveHostAccount();

    page.on('pageerror', (error) => {
      browserIssues.push(`[pageerror] ${error.message}`);
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserIssues.push(`[console:error] ${message.text()}`);
      }
    });

    await test.step('Login with the approved test host account', async () => {
      await page.goto('/login', { waitUntil: 'networkidle' });

      await page.locator('input[type="email"]').fill(HOST_EMAIL);
      await page.locator('input[type="password"]').fill(HOST_PASSWORD);
      await page.locator('button[type="submit"]').click();

      const results = await Promise.allSettled([
        page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
        page.getByText('Welcome back. You are now logged in.').waitFor({ state: 'visible', timeout: 30000 }),
        expect
          .poll(
            async () => {
              const cookies = await page.context().cookies();
              return cookies.some((cookie) => cookie.name.startsWith('sb-') && cookie.value.length > 0);
            },
            { timeout: 30000 }
          )
          .toBeTruthy(),
      ]);

      if (results.every((result) => result.status === 'rejected')) {
        const invalidCredentialsVisible = await page
          .getByText(/invalid email or password|이메일 또는 비밀번호가 올바르지 않습니다|ログイン情報が正しくありません|邮箱或密码不正确/i)
          .isVisible()
          .catch(() => false);
        const rateLimitVisible = await page
          .getByText(/too many attempts|잠시 후 다시 시도|しばらくしてから再度お試しください|请稍后重试/i)
          .isVisible()
          .catch(() => false);

        if (invalidCredentialsVisible) {
          throw new Error(`Login credentials were rejected for ${HOST_EMAIL}`);
        }
        if (rateLimitVisible) {
          throw new Error(`Login appears rate-limited for ${HOST_EMAIL}`);
        }

        throw new Error(`Login did not complete for ${HOST_EMAIL}`);
      }

      await page.goto('/account', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/account/);
    });

    await test.step('Open the create experience flow as the approved host', async () => {
      await page.goto('/host/create', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/host\/create/);
    });

    await test.step('Complete step 1: city and category', async () => {
      await page.getByRole('button', { name: /서울|Seoul|ソウル|首尔/ }).first().click();
      await page.getByRole('button', { name: /맛집 탐방|Food Tour|グルメ巡り|美食探索/ }).first().click();
      await clickFooterButton(page, /다음|Next|次へ|下一步/);
    });

    await test.step('Complete step 2: language and level', async () => {
      await page.getByRole('button', { name: /한국어|Korean|韓国語|韩语/ }).first().click();
      await page.getByRole('button', { name: 'Lv.5' }).first().click();
      await clickFooterButton(page, /다음|Next|次へ|下一步/);
    });

    await test.step('Complete step 3: title and hero photos', async () => {
      await page
        .locator(
          'input[placeholder="체험 제목을 입력하세요"], input[placeholder="Enter experience title"], input[placeholder="体験タイトルを入力してください"], input[placeholder="请输入体验标题"]'
        )
        .fill(experienceTitle);

      await page.locator('main input[type="file"][multiple]').setInputFiles(uploads.heroImages);
      await expect(page.locator('img[alt*="preview"]').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('img[alt*="preview"]')).toHaveCount(3, { timeout: 15000 });

      await clickFooterButton(page, /다음|Next|次へ|下一步/);
    });

    await test.step('Complete step 4: meeting point, itinerary, and itinerary image', async () => {
      await page
        .locator(
          'input[placeholder="예) 스타벅스 홍대역점"], input[placeholder="e.g. Starbucks Hongdae Station"], input[placeholder="例）スターバックス弘大駅店"], input[placeholder="例如：弘大站星巴克"]'
        )
        .fill('Locally E2E Meeting Point');
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
        .fill('Hongdae Local Food Stop');
      await page
        .locator(
          'textarea[placeholder="무엇을 하게 되나요?"], textarea[placeholder="Short description (optional)"], textarea[placeholder="What will happen here?"], textarea[placeholder="ここで何をしますか？"], textarea[placeholder="这里会进行什么活动？"]'
        )
        .first()
        .fill('We meet, introduce the route, and start a neighborhood food walk together.');

      await page
        .getByLabel(/장소 사진 추가|Add place photo|場所の写真を追加|添加地点照片/)
        .setInputFiles(uploads.itineraryImage);
      await expect(page.locator('img[alt*="preview"]').first()).toBeVisible({ timeout: 15000 });

      await clickFooterButton(page, /다음|Next|次へ|下一步/);
    });

    await test.step('Complete step 5: description and inclusions', async () => {
      await page
        .locator(
          'textarea[placeholder="상세 소개글을 입력하세요. (최소 50자 이상)"], textarea[placeholder="Enter a detailed description. (At least 50 characters)"], textarea[placeholder="詳細紹介文を入力してください。（50文字以上推奨）"], textarea[placeholder="请输入详细介绍。（建议至少50字）"]'
        )
        .fill(
          'This is a live E2E test experience created to verify the approved host flow, photo upload pipeline, multi-step validation, and successful submission into the host dashboard.'
        );

      const inclusionInput = page.locator(
        'input[placeholder="예) 음료"], input[placeholder="e.g. Drink"], input[placeholder="例）ドリンク"], input[placeholder="例如：饮品"]'
      );
      await inclusionInput.fill('One welcome snack');
      await inclusionInput.press('Enter');

      const exclusionInput = page.locator(
        'input[placeholder="예) 개인 교통비"], input[placeholder="e.g. Personal transportation"], input[placeholder="例）個人の交通費"], input[placeholder="例如：个人交通费"]'
      );
      await exclusionInput.fill('Personal purchases');
      await exclusionInput.press('Enter');

      await page
        .locator(
          'textarea[placeholder="준비물이나 복장 안내를 적어주세요"], textarea[placeholder="Tell guests what to prepare or wear"], textarea[placeholder="What to bring (optional)"], textarea[placeholder="持ち物や服装の案内を入力してください"], textarea[placeholder="请填写需要准备的物品或服装"], textarea[placeholder="e.g. Comfortable shoes, water"]'
        )
        .fill('Comfortable walking shoes are recommended.');

      await clickFooterButton(page, /다음|Next|次へ|下一步/);
    });

    await test.step('Complete step 6: rules', async () => {
      await page
        .locator(
          'input[placeholder="예) 만 7세 이상"], input[placeholder="e.g. Ages 7 and up"], input[placeholder="例）満7歳以上"], input[placeholder="例如：满7岁以上"]'
        )
        .fill('Ages 19 and up');

      await clickFooterButton(page, /다음|Next|次へ|下一步/);
    });

    await test.step('Complete step 7: pricing, submit, and verify success copy', async () => {
      await page.locator('input[inputmode="numeric"], input[type="number"]').first().fill('57000');
      await page.locator('footer').getByRole('button', { name: /체험 등록하기|Submit experience|体験を登録する|提交体验/ }).click();

      await expect(
        page.getByRole('heading', { name: /체험 등록 완료! 🎉|Experience submitted! 🎉|体験登録が完了しました！ 🎉|体验提交完成！ 🎉/ })
      ).toBeVisible({ timeout: 30000 });
      await expect(
        page.getByText(
          /미리 일정을 열어 예약을 준비해보세요\.|Open your schedule in advance to get ready for bookings\.|Open your schedule and start receiving bookings\.|事前に日程を開けて、予約の受付を準備してみましょう。|请先开放日程，提前做好接待预订的准备。/
        )
      ).toBeVisible({ timeout: 30000 });

      await page.getByRole('button', { name: /내 체험 보러가기|View my experiences|自分の体験を見る|查看我的体验/ }).click();
      await page.waitForURL('**/host/dashboard?tab=experiences', { timeout: 30000 });
      await expect(page).toHaveURL(/\/host\/dashboard\?tab=experiences/);
      await expect(page.getByRole('heading', { name: experienceTitle })).toBeVisible({ timeout: 20000 });

      const { data: createdExperience, error: createdExperienceError } = await getAdminClient()
        .from('experiences')
        .select('id')
        .eq('title', experienceTitle)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (createdExperienceError) throw createdExperienceError;
      if (createdExperience?.id != null) {
        createdExperienceIds.push(Number(createdExperience.id));
      }
    });

    await test.step('Capture final state and attach created experience metadata', async () => {
      await page.screenshot({
        path: testInfo.outputPath('live-host-experience-created.png'),
        fullPage: true,
      });

      await testInfo.attach('created-experience.json', {
        body: JSON.stringify(
          {
            hostEmail: HOST_EMAIL,
            experienceTitle,
            heroImages: uploads.heroImages,
            itineraryImage: uploads.itineraryImage,
          },
          null,
          2
        ),
        contentType: 'application/json',
      });

      if (browserIssues.length > 0) {
        await testInfo.attach('browser-issues.txt', {
          body: browserIssues.join('\n'),
          contentType: 'text/plain',
        });
      }
    });
  });
});
