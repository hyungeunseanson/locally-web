import path from 'path';

import { expect, test } from '@playwright/test';

const LIVE_BASE_URL = 'https://locally-web.vercel.app';
const HOST_EMAIL = 'codex.host.1772980212472@example.com';
const HOST_PASSWORD = 'LocallyTest!2026';

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

test.describe.serial('Live approved host experience creation flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(240000);

  test('logs in as approved host and creates an experience with image uploads', async ({ page }, testInfo) => {
    const browserIssues: string[] = [];
    const uploads = pickUploadImages();
    const experienceTitle = `[Playwright] Live Host Experience ${Date.now()}`;

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

      const loginResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/auth/v1/token?grant_type=password') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
        { timeout: 30000 }
      );

      await page.locator('input[type="email"]').fill(HOST_EMAIL);
      await page.locator('input[type="password"]').fill(HOST_PASSWORD);
      await page.locator('button[type="submit"]').click();

      await loginResponsePromise;
      await page.waitForTimeout(2000);
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

      await page.locator('input[type="file"]').first().setInputFiles(uploads.heroImages);
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

      await page.locator('input[type="file"]').first().setInputFiles(uploads.itineraryImage);
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

    await test.step('Complete step 7: pricing and submit', async () => {
      await page.locator('input[type="number"]').first().fill('57000');
      await page.locator('footer').getByRole('button', { name: /체험 등록하기|Submit experience|体験を登録する|提交体验/ }).click();

      await page.waitForURL('**/host/dashboard?tab=experiences', { timeout: 30000 });
      await expect(page).toHaveURL(/\/host\/dashboard\?tab=experiences/);
      await expect(page.getByText(experienceTitle)).toBeVisible({ timeout: 20000 });
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
