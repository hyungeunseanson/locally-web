import { expect, test } from '@playwright/test';

test.describe('Public company surface CTA truth', () => {
  test('news page exposes archive previews instead of dead article links', async ({ page }) => {
    await page.goto('/company/news', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-news-item')).toHaveCount(4);
    await expect(page.getByTestId('company-news-item-status')).toHaveCount(4);
    await expect(page.getByTestId('company-news-status-banner')).toBeVisible();
    await expect(page.getByTestId('company-news-notices-cta')).toHaveAttribute('href', '/company/notices');
    await expect(page.getByTestId('company-news-availability-note')).toBeVisible();
    await expect(page.getByText(/Series A|유니콘/)).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('careers page shows upcoming roles without dead apply links', async ({ page }) => {
    await page.goto('/company/careers', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Upcoming Roles' })).toBeVisible();
    await expect(page.getByTestId('company-careers-status-banner')).toBeVisible();
    await expect(page.getByTestId('company-careers-about-cta')).toHaveAttribute('href', '/about');
    await expect(page.getByTestId('company-career-role')).toHaveCount(4);
    await expect(page.getByTestId('company-career-role-status')).toHaveCount(4);
    await expect(page.getByTestId('company-careers-availability-note')).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('investors page keeps report rows read-only until downloads exist', async ({ page }) => {
    await page.goto('/company/investors', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-investors-status-banner')).toBeVisible();
    await expect(page.getByTestId('company-investors-notices-cta')).toHaveAttribute('href', '/company/notices');
    await expect(page.getByTestId('company-investors-metrics-note')).toBeVisible();
    await expect(page.getByTestId('company-investor-metric-status')).toHaveCount(3);
    await expect(page.getByTestId('company-investors-availability-note')).toBeVisible();
    await expect(page.getByTestId('company-investor-report-row')).toHaveCount(3);
    await expect(page.getByTestId('company-investor-report-status')).toHaveCount(3);
    await expect(page.getByTestId('company-investor-report-row').first()).not.toHaveClass(/cursor-pointer/);
    await expect(page.getByText(/240%|1\.2M\+|45/)).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('site-map page exposes legal documents without dead links', async ({ page }) => {
    await page.goto('/site-map', { waitUntil: 'networkidle' });
    const siteMapMain = page.locator('main');

    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(siteMapMain.locator('a[href="/host/dashboard"]')).toHaveCount(0);
    await expect(siteMapMain.locator('a[href="/community"]')).toHaveCount(1);
    await expect(siteMapMain.getByRole('link', { name: '로컬리 콘텐츠' })).toHaveAttribute('href', '/community');

    await page.getByTestId('site-map-legal-trigger-privacy').click();

    const legalModal = page.getByTestId('site-map-legal-modal');

    await expect(legalModal).toBeVisible();
    await expect(legalModal.getByRole('heading')).toBeVisible();
    await expect(legalModal.getByText(/\S+/).first()).toBeVisible();
    await expect(legalModal).not.toContainText('OOO');
    await expect(legalModal).not.toContainText('<예)');
    await expect(legalModal).not.toContainText('〈例：');
    await expect(legalModal).not.toContainText('e.g. OOO');
  });
});
