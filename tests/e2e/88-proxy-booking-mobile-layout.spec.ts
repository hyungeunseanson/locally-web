import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Proxy booking mobile layout', () => {
  test('keeps the restaurant slot picker actionable on mobile', async ({ page }) => {
    await page.goto('/proxy-bookings/new', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '일본인이 대신 전화 예약을 도와드립니다' })).toBeVisible();

    const trigger = page.getByTestId('preferred-slot-primary-trigger');
    await trigger.click();

    const firstEnabledDay = page.locator('[data-testid^="preferred-slot-primary-day-"]:not([disabled])').first();
    await expect(firstEnabledDay).toBeVisible();
    await firstEnabledDay.click();

    const timeButton = page.getByTestId('preferred-slot-primary-time-19:00');
    await timeButton.scrollIntoViewIfNeeded();
    await expect(timeButton).toBeInViewport();
    await timeButton.click();

    const confirmButton = page.getByTestId('preferred-slot-primary-confirm');
    await expect(confirmButton).toBeInViewport();
    await confirmButton.click();

    await expect(confirmButton).toBeHidden();
    await expect(trigger).toContainText('19:00', { timeout: 10000 });
  });
});
