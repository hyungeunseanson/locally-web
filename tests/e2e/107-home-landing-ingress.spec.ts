import { expect, test, type Page } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Home landing ingress guidance', () => {
  test('shows next-step guidance for experience and service entry points', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const experienceHint = page.getByTestId('home-experience-ingress-hint');
    await expect(experienceHint).toBeVisible({ timeout: 15000 });
    await expect(
      experienceHint.getByRole('link', {
        name: /검색 결과 전체 보기|View full search results|検索結果をすべて見る|查看完整搜索结果/,
      })
    ).toBeVisible();

    await page.locator('[data-testid="home-tab-service"]:visible').first().click();

    const serviceHint = page.getByTestId('home-service-ingress-hint');
    await expect(serviceHint).toBeVisible({ timeout: 15000 });
    await expect(
      serviceHint.getByRole('link', {
        name: /맞춤 요청서 작성|Start a custom request|依頼フォームを書く|填写定制请求/,
      })
    ).toHaveAttribute('href', '/services/request');
  });
});
