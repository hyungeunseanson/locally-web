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
  test('shows the localized mobile header without affecting desktop or about', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, '1');
    }, ANNOUNCEMENT_DISMISS_KEY);

    await page.setViewportSize({ width: 320, height: 844 });

    const cases = [
      { path: '/become-a-host', locale: 'ko' },
      { path: '/en/become-a-host', locale: 'en' },
      { path: '/ja/become-a-host', locale: 'ja' },
      { path: '/zh/become-a-host', locale: 'zh' },
    ] as const;

    for (const testCase of cases) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate((locale) => {
        window.localStorage.setItem('app_lang', locale);
        document.cookie = `app_lang=${locale}; path=/; samesite=lax`;
      }, testCase.locale);
      await page.goto(testCase.path, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(page);

      const mobileHeader = page.getByTestId('host-landing-mobile-header');
      const desktopHeader = page.getByTestId('host-landing-desktop-header').locator('header');
      await expect(mobileHeader).toBeVisible({ timeout: 15000 });
      await expect(mobileHeader.getByRole('button', { name: '모바일 언어 전환' })).toBeVisible();
      await expect(page.getByTestId('host-landing-mobile-home-link')).toHaveCount(0);
      await expect(mobileHeader.locator('img')).toHaveCount(0);
      await expect(desktopHeader).toBeHidden();
      await expect(page.locator(`img[src*="/images/become-a-host/mobile/${testCase.locale}/1.png"]`)).toBeVisible();

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
      expect(await mobileHeader.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
    }

    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('host-landing-mobile-header')).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/become-a-host', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('host-landing-mobile-header')).toBeHidden();
    await expect(page.getByTestId('host-landing-desktop-header').locator('header')).toBeVisible();
  });

  test('reuses the existing globe switcher and keeps the host landing query', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, '1');
    }, ANNOUNCEMENT_DISMISS_KEY);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/become-a-host?utm_source=mobile_header', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const mobileHeader = page.getByTestId('host-landing-mobile-header');
    await mobileHeader.getByRole('button', { name: '모바일 언어 전환' }).click();
    await mobileHeader.getByRole('button', { name: 'English', exact: true }).click();

    await expect(page).toHaveURL(/\/en\/become-a-host\?utm_source=mobile_header$/);
    await expect(page).toHaveTitle('Become a Host | Locally');
    await expect(page.locator('img[src*="/images/become-a-host/mobile/en/1.png"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequently asked questions', exact: true })).toBeVisible();
    await expect(page.getByTestId('host-landing-primary-cta').first()).toHaveText('Apply to host');
  });

  test('shows status hint and opens login modal with return guidance', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, '1');
    }, ANNOUNCEMENT_DISMISS_KEY);

    await page.goto('/become-a-host', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByTestId('host-landing-status-hint')).toHaveCount(1);

    const statusHint = page.getByTestId('host-landing-status-hint').first();
    await expect(statusHint).toBeVisible({ timeout: 15000 });
    await expect(statusHint).toContainText(
      /먼저 로그인하면 지원을 바로 시작할 수 있어요|Log in first to start your host application right away|まずログインすると、そのまま応募を始められます|先登录，就可以直接开始申请/
    );

    await page.getByTestId('host-landing-primary-cta').first().click();

    await expect(page.getByTestId('login-modal-flow-hint')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('login-modal-flow-hint')).toContainText(
      /로그인 후 지금 보고 있던 화면으로 다시 돌아갑니다|After login, you will return to the (page|screen) you were viewing(?: and continue right away)?|ログイン後は、今見ていたページに戻ります|登录后会回到你刚才正在查看的页面/
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
        payoutGroup: 'Payouts and operations',
        payoutCopy: 'Payouts are not reflected immediately when a booking is made or paid.',
      },
      {
        path: '/ja/become-a-host',
        title: 'ホストになる | Locally',
        faqHeading: 'よくあるご質問',
        cta: 'ホストに応募する',
        payoutGroup: '精算と運営',
        payoutCopy: '精算は予約や決済の直後に反映されるのではなく、体験完了後に精算待ちの流れへ反映されます。',
      },
      {
        path: '/zh/become-a-host',
        title: '成为房东 | Locally',
        faqHeading: '常见问题解答',
        cta: '申请成为房东',
        payoutGroup: '结算与运营',
        payoutCopy: '结算不会在预订或付款后立刻反映，而是在体验完成后进入待结算流程。',
      },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.path, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(page);
      await expect(page).toHaveTitle(testCase.title, { timeout: 15000 });
      await expect(page.getByRole('heading', { name: testCase.faqHeading, exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('host-landing-primary-cta').first()).toHaveText(testCase.cta);
      await page.getByRole('heading', { name: testCase.payoutGroup, exact: true }).click();
      await expect(page.getByText(testCase.payoutCopy)).toBeVisible({ timeout: 15000 });
    }
  });
});
