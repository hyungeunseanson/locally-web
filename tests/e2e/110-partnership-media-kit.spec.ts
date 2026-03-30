import { expect, test, type Page } from '@playwright/test';

const ANNOUNCEMENT_DISMISS_KEY = 'locally_site_announcement_dismissed:bank-only-template-2026-04-01';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Partnership media kit page', () => {
  test('shows media kit slots and updated footer section titles', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, '1');
      window.localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    }, ANNOUNCEMENT_DISMISS_KEY);

    await page.goto('/company/partnership', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await expect(
      page.getByRole('heading', { name: 'Instagram 광고 · 제휴 문의', exact: true })
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('partnership-media-kit')).toBeVisible();
    await expect(page.locator('[data-testid^="partnership-media-kit-card-"]')).toHaveCount(7);

    await expect(page.getByTestId('footer-column-title-support')).toHaveText('로컬리');
    await expect(page.getByTestId('footer-column-title-locally')).toHaveText('지원');
  });
});
