import { expect, test } from '@playwright/test';

test.describe('Help Center self-service copy', () => {
  test('shows inbox reply guidance and search empty-state support CTA', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('help-inbox-reply-strip')).toBeVisible();

    await page.getByRole('textbox').fill('playwright-no-faq-match');

    await expect(page.getByTestId('help-search-empty-state')).toBeVisible();
    await expect(page.getByTestId('help-search-empty-cta')).toBeVisible();
  });
});
