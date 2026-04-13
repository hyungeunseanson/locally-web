import { expect, test } from '@playwright/test';

test.describe('Public company notices surface', () => {
  test('renders notices from the shared config source and expands the first notice body', async ({ page }) => {
    await page.goto('/company/notices', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('company-notice-item')).toHaveCount(3);
    await expect(page.getByTestId('company-notice-type-1')).toHaveText('Update');
    await expect(page.getByTestId('company-notice-date-1')).toHaveText('Feb 10, 2026');
    await expect(page.getByTestId('company-notice-title-1')).toHaveText('서비스 이용약관 개정 안내');

    await page.getByTestId('company-notice-toggle-1').click();

    await expect(page.getByTestId('company-notice-content-1')).toContainText('투명한 서비스 운영을 위해 이용약관이 개정됩니다.');
  });
});
