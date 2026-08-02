import { expect, test } from '@playwright/test';

const IOS_INSTAGRAM_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 392.0.0.0.1';
const IOS_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

const HOME_LINKTREE_URL =
  '/?locally_external_prompt=instagram&utm_source=instagram&utm_medium=social&utm_campaign=linktree_home';
const HOST_LINKTREE_URL =
  '/become-a-host?locally_external_prompt=instagram&utm_source=instagram&utm_medium=social&utm_campaign=linktree_host';

test.describe('Linktree external browser handoff', () => {
  test('keeps normal browsers on the destination and removes the prompt marker', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
    const page = await context.newPage();

    await page.goto(HOME_LINKTREE_URL);

    await expect(page).toHaveURL(/\/?utm_source=instagram&utm_medium=social&utm_campaign=linktree_home$/);
    await expect(page.getByTestId('instagram-iab-prompt')).toHaveCount(0);
    await context.close();
  });

  test('shows the glass prompt over the actual home page inside Instagram', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: IOS_INSTAGRAM_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto(HOME_LINKTREE_URL);

    await expect(page.getByTestId('instagram-iab-prompt')).toBeVisible();
    await expect(page.locator('#locally-app-shell')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '현재 창에서 계속하기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '링크 복사' })).toBeVisible();

    const panelBox = await page.getByTestId('instagram-iab-prompt-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(16);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(374);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await context.close();
  });

  test('continues on the loaded page without losing Linktree attribution', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: IOS_INSTAGRAM_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto(HOST_LINKTREE_URL);
    await expect(page.getByTestId('instagram-iab-prompt')).toBeVisible();

    await page.getByTestId('instagram-iab-continue').click();

    await expect(page.getByTestId('instagram-iab-prompt')).toHaveCount(0);
    await expect(page).toHaveURL(/\/become-a-host\?utm_source=instagram&utm_medium=social&utm_campaign=linktree_host$/);

    await context.close();
  });

  test('does not render from an unmarked Instagram visit', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: IOS_INSTAGRAM_USER_AGENT });
    const page = await context.newPage();

    await page.goto('/');

    await expect(page.getByTestId('instagram-iab-prompt')).toHaveCount(0);
    await context.close();
  });
});
