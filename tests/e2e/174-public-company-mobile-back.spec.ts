import { expect, test } from '@playwright/test';

test.describe('Public company mobile back fallback', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('news direct entry falls back to /about', async ({ page }) => {
    await page.goto('/company/news', { waitUntil: 'networkidle' });

    await page.getByTestId('company-news-back-button').click();

    await expect(page).toHaveURL(/\/about$/);
  });

  test('notices direct entry falls back to /about', async ({ page }) => {
    await page.goto('/company/notices', { waitUntil: 'networkidle' });

    await page.getByTestId('company-notices-back-button').click();

    await expect(page).toHaveURL(/\/about$/);
  });
});
