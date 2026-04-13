import { expect, test } from '@playwright/test';

test.describe('Public company surface CTA truth', () => {
  test('news page exposes archive previews instead of dead article links', async ({ page }) => {
    await page.goto('/company/news', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-news-item')).toHaveCount(4);
    await expect(page.getByTestId('company-news-item-status')).toHaveCount(4);
    await expect(page.getByTestId('company-news-status-banner')).toBeVisible();
    await expect(page.getByTestId('company-news-notices-cta')).toHaveAttribute('href', '/company/notices');
    await expect(page.getByTestId('company-news-availability-note')).toBeVisible();
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
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('site-map page exposes legal documents without dead links', async ({ page }) => {
    await page.goto('/site-map', { waitUntil: 'networkidle' });

    await expect(page.locator('a[href="#"]')).toHaveCount(0);

    await page.getByTestId('site-map-legal-trigger-terms').click();

    const legalModal = page.getByTestId('site-map-legal-modal');

    await expect(legalModal).toBeVisible();
    await expect(legalModal.getByRole('heading')).toBeVisible();
    await expect(legalModal.getByText(/\S+/).first()).toBeVisible();
  });
});
