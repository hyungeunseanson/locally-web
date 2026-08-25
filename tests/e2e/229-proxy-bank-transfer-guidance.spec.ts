import { expect, test } from '@playwright/test';

test.describe('Proxy bank transfer guidance', () => {
  test('shows bank details before submission and only for the bank transfer branch', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:3000',
    });

    await page.goto('/proxy-bookings/new', { waitUntil: 'networkidle' });

    await page.locator('input[value="bank"]').check();

    const bankTransferNotice = page.getByTestId('proxy-bank-transfer-notice');
    await expect(bankTransferNotice).toBeVisible();
    await expect(bankTransferNotice.getByText('결제 금액')).toBeVisible();
    await expect(bankTransferNotice.getByText('입금 계좌')).toBeVisible();
    await expect(bankTransferNotice.getByText('은행명')).toBeVisible();
    await expect(bankTransferNotice.getByText('계좌번호', { exact: true })).toBeVisible();
    await expect(bankTransferNotice.getByText('예금주')).toBeVisible();

    await bankTransferNotice.getByRole('button', { name: '계좌번호 복사' }).click();
    await expect(bankTransferNotice.getByRole('button', { name: '복사되었습니다.' })).toBeVisible();

    await page.locator('input[value="card"]').check();
    await expect(bankTransferNotice).toHaveCount(0);

    await page.locator('input[value="NAVER"]').check();
    await expect(bankTransferNotice).toHaveCount(0);
  });
});
