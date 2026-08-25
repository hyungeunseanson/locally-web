import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Proxy booking mobile layout', () => {
  test('keeps the restaurant slot picker actionable on mobile', async ({ page }) => {
    await page.goto('/proxy-bookings/new', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByRole('heading', { name: '일본 현지 전화, 로컬리가 대신해드려요' })).toBeVisible();

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
