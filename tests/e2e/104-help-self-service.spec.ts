import { expect, test } from '@playwright/test';

test.describe('Help Center self-service copy', () => {
  test('shows inbox reply guidance, support CTA, and the public support email owner', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('help-inbox-reply-strip')).toBeVisible();
    await expect(page.locator('a[href="mailto:locally.partners@gmail.com"]')).toBeVisible();

    await page.getByRole('textbox').fill('playwright-no-faq-match');

    await expect(page.getByTestId('help-search-empty-state')).toBeVisible();
    await expect(page.getByTestId('help-search-empty-cta')).toBeVisible();
  });
});
