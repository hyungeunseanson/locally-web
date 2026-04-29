import { expect, test } from '@playwright/test';

test.describe('Public company notices surface', () => {
  test('renders notices from the shared config source and expands the first notice body', async ({ page }) => {
    await page.goto('/company/notices', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-notice-item')).toHaveCount(1);
    await expect(page.getByTestId('company-notice-type-1')).toHaveText('Notice');
    await expect(page.getByTestId('company-notice-date-1')).toHaveText('Apr 29, 2026');
    await expect(page.getByTestId('company-notice-title-1')).toHaveText('Locally 웹사이트 오픈 안내');

    await page.getByTestId('company-notice-toggle-1').click();

    await expect(page.getByTestId('company-notice-content-1')).toContainText('새롭게 오픈');
    await expect(page.getByTestId('company-notice-content-1')).toContainText('1:1 문의');
    await expect(page.getByTestId('company-notice-content-1')).toContainText('감사합니다');
  });
});
