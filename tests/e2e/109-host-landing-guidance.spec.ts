import { expect, test, type Page } from '@playwright/test';

const ANNOUNCEMENT_DISMISS_KEY = 'locally_site_announcement_dismissed:bank-only-template-2026-04-01';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Host landing guidance', () => {
  test('shows status hint and opens login modal with return guidance', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, '1');
    }, ANNOUNCEMENT_DISMISS_KEY);

    await page.goto('/become-a-host', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    const statusHint = page.getByTestId('host-landing-status-hint').first();
    await expect(statusHint).toBeVisible({ timeout: 15000 });
    await expect(statusHint).toContainText(
      /먼저 로그인하면 지원을 바로 시작할 수 있어요|Log in first to start your host application right away|まずログインすると、そのまま応募を始められます|先登录，就可以直接开始申请/
    );

    await page.getByTestId('host-landing-primary-cta').first().click();

    await expect(page.getByTestId('login-modal-flow-hint')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('login-modal-flow-hint')).toContainText(
      /로그인 후 지금 보고 있던 화면으로 다시 돌아갑니다|After login, you will return to the page you were viewing|ログイン後は、今見ていたページに戻ります|登录后会回到你刚才正在查看的页面/
    );
  });

  test('keeps server and client locale in sync for localized host landing routes', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, '1');
      window.localStorage.removeItem('app_lang');
      document.cookie = 'app_lang=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }, ANNOUNCEMENT_DISMISS_KEY);

    const cases = [
      {
        path: '/en/become-a-host',
        title: 'Become a Host | Locally',
        faqHeading: 'Frequently asked questions',
        cta: 'Apply to host',
      },
      {
        path: '/ja/become-a-host',
        title: 'ホストになる | Locally',
        faqHeading: 'よくあるご質問',
        cta: 'ホストに応募する',
      },
      {
        path: '/zh/become-a-host',
        title: '成为房东 | Locally',
        faqHeading: '常见问题解答',
        cta: '申请成为房东',
      },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.path, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(page);
      await expect(page).toHaveTitle(testCase.title, { timeout: 15000 });
      await expect(page.getByRole('heading', { name: testCase.faqHeading, exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('host-landing-primary-cta').first()).toHaveText(testCase.cta);
    }
  });
});
