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
    const localeCases = [
      {
        locale: 'ko',
        path: '/',
        title: '마음에 드는 체험은 먼저 저장해두세요!',
        description: '검색에서 도시, 날짜, 체험 언어를 확인하고 맞는 체험을 골라보세요.',
      },
      {
        locale: 'en',
        path: '/en',
        title: 'Save experiences you like first',
        description: 'Use search to check the city, dates, and experience language, then narrow down what fits.',
      },
      {
        locale: 'ja',
        path: '/ja',
        title: '気になる体験は先に保存しておきましょう',
        description: '検索で都市、日付、体験言語を確認しながら、自分に合う体験を絞り込めます。',
      },
      {
        locale: 'zh',
        path: '/zh',
        title: '先把喜欢的体验保存起来',
        description: '在搜索里确认城市、日期和体验语言，再慢慢筛选合适的体验。',
      },
    ] as const;

    for (const localeCase of localeCases) {
      await page.context().clearCookies();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate((locale) => {
        window.localStorage.setItem('app_lang', locale);
        document.cookie = `app_lang=${locale}; path=/`;
      }, localeCase.locale);
      await page.goto(localeCase.path, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(page);

      const experienceHint = page.getByTestId('home-experience-ingress-hint');
      await expect(experienceHint).toBeVisible({ timeout: 15000 });
      await expect(experienceHint).toContainText(localeCase.title);
      await expect(experienceHint).toContainText(localeCase.description);
      await expect(
        experienceHint.getByRole('link', {
          name: /검색 결과 전체 보기|View full search results|検索結果をすべて見る|查看完整搜索结果/,
        })
      ).toBeVisible();
    }

    await page.goto('/', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

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
