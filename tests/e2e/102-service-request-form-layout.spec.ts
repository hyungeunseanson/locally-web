import { test, expect } from '@playwright/test';

test.describe('Service request form layout', () => {
  test('shows grouped sections and sticky summary on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });
    await page.goto('/services/request', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('일정과 기본 조건')).toBeVisible();
    await expect(page.getByText('원하는 서비스 내용')).toBeVisible();
    await expect(page.getByText('연락 및 결제 진행 정보')).toBeVisible();
    await expect(page.getByRole('complementary').getByText('예상 결제 요약')).toBeVisible();
    await expect(page.getByRole('complementary').getByText('다음 단계')).toBeVisible();
    await expect(page.getByRole('button', { name: '의뢰 등록 및 결제하기' }).last()).toBeVisible();
  });

  test('keeps summary card visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1200 });
    await page.goto('/services/request', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('일정과 기본 조건')).toBeVisible();
    await expect(page.getByText('예상 결제 요약').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '의뢰 등록 및 결제하기' })).toBeVisible();
  });
});
