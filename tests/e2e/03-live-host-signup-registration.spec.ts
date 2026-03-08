import path from 'path';

import { expect, test, type Page } from '@playwright/test';

const LIVE_BASE_URL = 'https://locally-web.vercel.app';
const TEST_IMAGE_PATH = path.resolve(__dirname, 'test-image.png');

function createUniqueUser() {
  const timestamp = Date.now();

  return {
    email: `codex.host.${timestamp}@example.com`,
    password: 'LocallyTest!2026',
    fullName: `Codex Host ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
    birthDate: '19900101',
    instagram: `codex_host_${timestamp}`,
  };
}

async function clickFooterNext(page: Page) {
  await page
    .locator('footer')
    .getByRole('button', { name: /다음|Next|次へ|下一步/ })
    .click();
}

test.describe.serial('Live host signup and registration flow', () => {
  test.use({ baseURL: LIVE_BASE_URL });
  test.setTimeout(240000);

  test('signs up from host landing and submits a host application', async ({ page }, testInfo) => {
    const user = createUniqueUser();
    const browserIssues: string[] = [];

    page.on('pageerror', (error) => {
      browserIssues.push(`[pageerror] ${error.message}`);
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserIssues.push(`[console:error] ${message.text()}`);
      }
    });

    await test.step('Open host landing and switch login modal to signup mode', async () => {
      await page.goto('/become-a-host', { waitUntil: 'networkidle' });

      await page
        .getByRole('button', { name: /호스트 지원하기|지원서 수정하기|호스트 대시보드|신청현황/ })
        .first()
        .click();

      const modal = page.locator('div.fixed.inset-0.z-\\[200\\]').last();
      await expect(modal).toBeVisible();

      await modal.locator('div.mt-6.text-center.text-sm > button').click();
      await expect(modal.getByRole('button', { name: /회원가입|Sign up|登録|注册/ })).toBeVisible();
    });

    await test.step('Create a fresh user account through the signup modal', async () => {
      const modal = page.locator('div.fixed.inset-0.z-\\[200\\]').last();
      const form = modal.locator('form');
      const signupResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/auth/v1/signup') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
        { timeout: 30000 }
      );

      await form.locator('input[type="email"]').fill(user.email);
      await form.locator('input[type="password"]').fill(user.password);
      await form.locator('input[autocomplete="name"]').fill(user.fullName);
      await form.locator('select').first().selectOption({ index: 1 });
      await form.locator('input[autocomplete="tel"]').fill(user.phone);
      await form.locator('input[autocomplete="bday"]').fill(user.birthDate);
      await form.locator('select[autocomplete="sex"]').selectOption('Male');

      await form.getByText(/Agree to all|전체 동의|すべてに同意|全部同意/).click();

      await form.getByRole('button', { name: /회원가입|Sign up|登録|注册/ }).click();
      await signupResponsePromise;

      await page.waitForTimeout(3000);

      if (await modal.isVisible()) {
        const header = (await modal.locator('span.font-bold.text-\\[15px\\]').first().textContent())?.trim() || 'unknown';
        throw new Error(
          `Signup did not complete into an authenticated session. The modal remained open with header "${header}". Email verification or signup handling is blocking the flow.`
        );
      }
    });

    await test.step('Enter the host registration page after signup', async () => {
      await page.waitForLoadState('networkidle');
      await page.goto('/become-a-host', { waitUntil: 'networkidle' });

      await page
        .getByRole('button', { name: /호스트 지원하기|지원서 수정하기|호스트 대시보드|신청현황/ })
        .first()
        .click();

      const modal = page.locator('div.fixed.inset-0.z-\\[200\\]');
      if (await modal.count()) {
        if (await modal.last().isVisible()) {
          throw new Error('Clicking the host CTA after signup opened the login modal again. The new account is not recognized as logged in.');
        }
      }

      await page.waitForURL('**/host/register**', { timeout: 20000 });
    });

    await test.step('Complete steps 1 to 4 of the host registration form', async () => {
      await page.getByRole('button', { name: /한국인|Korean|日本人|Japanese/ }).first().click();
      await clickFooterNext(page);

      await page.getByRole('button', { name: /한국어|Korean|韓国語|韩语/ }).first().click();
      await page.getByRole('button', { name: 'Lv.5' }).first().click();
      await clickFooterNext(page);

      await page.locator('input[placeholder="홍길동"], input[placeholder="John Doe"]').fill(user.fullName);
      await page.locator('input[placeholder="YYYY.MM.DD"]').fill('1990.01.01');
      await page.locator('input[placeholder="010-1234-5678"]').fill(user.phone);
      await page.locator('input[placeholder="example@gmail.com"]').fill(user.email);
      await page.locator('input[placeholder="@locally.host"]').fill(`@${user.instagram}`);
      await page.locator('input[placeholder*="인스타"], input[placeholder*="Instagram"], input[placeholder*="インスタ"], input[placeholder*="小红书"]').fill('E2E host landing test');
      await clickFooterNext(page);

      await page.locator('input[type="file"]').first().setInputFiles(TEST_IMAGE_PATH);
      await page.locator('textarea').fill(
        '안녕하세요. 라이브 호스트 지원 플로우를 점검하기 위한 E2E 테스트 자기소개입니다. 실제 제출과 업로드, 단계 이동이 모두 정상 동작하는지 확인하고 있습니다.'
      );
      await clickFooterNext(page);
    });

    await test.step('Complete steps 5 to 8 and submit the host application', async () => {
      await page.locator('input[type="file"]').last().setInputFiles(TEST_IMAGE_PATH);
      await clickFooterNext(page);

      const payoutInputs = page.locator('main input');
      await payoutInputs.nth(0).fill('Test Bank');
      await payoutInputs.nth(1).fill('123456789012');
      await payoutInputs.nth(2).fill(user.fullName);
      await clickFooterNext(page);

      await page.locator('textarea').fill(
        '로컬리에서 외국인 게스트와 좋은 경험을 만들고 싶어서 지원합니다. 가입, 업로드, 제출, 대시보드 이동까지 전체 흐름을 검증하는 목적도 함께 포함되어 있습니다.'
      );
      await page
        .getByText(
          /I promise to act as a transparent and honest Locally host|로컬리 호스트로서 투명하고 정직하게 활동할 것을 약속하며|透明で誠実なLocallyホストとして行動することを約束し|我承诺作为 Locally 主播将以透明诚实的方式活动/
        )
        .click();
      await clickFooterNext(page);

      await page
        .getByText(
          /I have read and understood all host safety guidelines|위 호스트 안전 가이드라인 및 플랫폼 이용 수칙을 모두 정독하고 숙지하였습니다|ホスト安全ガイドラインと利用ルールをすべて読み理解しました|我已仔细阅读并理解以上主持安全指南与平台规则/
        )
        .click();
      await page
        .getByText(
          /I agree that violations may lead to permanent account suspension|위반 시 계정 영구 정지 및 법적 책임이 따를 수 있음에 동의하며|違反時には永久停止および法的責任が生じることに同意し|我同意若违规可能导致账号永久停用及法律责任/
        )
        .click();

      await page
        .locator('footer')
        .getByRole('button', { name: /신청 완료하기|Submit|提出|送信/ })
        .click();

      await page.waitForURL('**/host/dashboard**', { timeout: 30000 });
      await expect(page).toHaveURL(/\/host\/dashboard/);
    });

    await test.step('Capture the final state and attach browser-side issues', async () => {
      await page.screenshot({
        path: testInfo.outputPath('live-host-registration-success.png'),
        fullPage: true,
      });

      await testInfo.attach('created-user.json', {
        body: JSON.stringify(user, null, 2),
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
