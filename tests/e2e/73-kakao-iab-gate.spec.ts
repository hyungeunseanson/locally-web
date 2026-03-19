import { expect, test } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const KAKAO_IAB_ATTEMPT_STORAGE_KEY = 'locally.kakao_iab.last_attempt_url';
const KAKAO_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 KAKAOTALK Safari/604.1';
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function getRootUrl(baseURL: string | undefined) {
  return new URL('/', baseURL || DEFAULT_BASE_URL).toString();
}

test.describe('Kakao IAB escape gate', () => {
  test('does not render the gate for a normal mobile browser', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: MOBILE_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('kakao-iab-gate')).toHaveCount(0);
    await expect(page.locator('#locally-app-shell')).toBeVisible();

    await context.close();
  });

  test('locks the app shell and shows fallback UI for Kakao IAB after an attempted handoff', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: KAKAO_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const rootUrl = getRootUrl(testInfo.project.use.baseURL);

    await context.addInitScript(
      ({ storageKey, targetUrl }) => {
        window.sessionStorage.setItem(storageKey, targetUrl);
      },
      { storageKey: KAKAO_IAB_ATTEMPT_STORAGE_KEY, targetUrl: rootUrl }
    );

    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-iab', 'kakao');
    await expect(page.locator('html')).toHaveAttribute('data-iab-lock', 'true');
    await expect(page.locator('#locally-app-shell')).toBeHidden();
    await expect(page.getByTestId('kakao-iab-gate')).toBeVisible();
    await expect(page.getByRole('button', { name: '브라우저로 다시 열기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '링크 복사' })).toBeVisible();

    await context.close();
  });

  test('skips the gate when bypass query is present', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: KAKAO_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/?locally_iab_bypass=1', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('kakao-iab-gate')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-iab', 'kakao');
    await expect(page.locator('#locally-app-shell')).toBeVisible();

    await context.close();
  });
});
