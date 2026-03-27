import { expect, test, type Page } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Login flow guidance', () => {
  test('shows return guidance when a returnUrl is present', async ({ page }) => {
    await page.goto('/login?returnUrl=%2Fguest%2Ftrips', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByTestId('login-page-help')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('login-page-help')).toContainText(
      /로그인하면 바로 이어서 할 수 있어요|You can continue right away after login|ログインするとすぐ続けられます|登录后可以立刻继续/
    );
    await expect(page.getByTestId('login-modal-flow-hint')).toContainText(
      /로그인 후 지금 보고 있던 화면으로 다시 돌아갑니다|After login, you will return to the page you were viewing|ログイン後は、今見ていたページに戻ります|登录后会回到你刚才正在查看的页面/
    );
    await expect(page.getByTestId('login-modal-social-return-hint')).toBeVisible();
  });
});
