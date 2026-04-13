import { expect, test } from '@playwright/test';

test.describe('Public company surface CTA truth', () => {
  test('news page exposes archive previews instead of dead article links', async ({ page }) => {
    await page.goto('/company/news', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-news-item')).toHaveCount(4);
    await expect(page.getByTestId('company-news-availability-note')).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('careers page shows upcoming roles without dead apply links', async ({ page }) => {
    await page.goto('/company/careers', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Upcoming Roles' })).toBeVisible();
    await expect(page.getByTestId('company-career-role')).toHaveCount(4);
    await expect(page.getByTestId('company-careers-availability-note')).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('investors page keeps report rows read-only until downloads exist', async ({ page }) => {
    await page.goto('/company/investors', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-investors-availability-note')).toBeVisible();
    await expect(page.getByTestId('company-investor-report-row')).toHaveCount(3);
    await expect(page.getByTestId('company-investor-report-row').first()).not.toHaveClass(/cursor-pointer/);
  });
});
