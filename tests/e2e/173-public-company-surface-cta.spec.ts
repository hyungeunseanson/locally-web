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
    await legalModal.getByRole('button', { name: 'Close legal document' }).click();
    await expect(legalModal).toBeHidden();

    await page.getByTestId('site-map-legal-trigger-refund').click();

    await expect(legalModal).toBeVisible();
    await expect(legalModal).toContainText(
      /체험일 당일 또는 이미 지난 일정 취소: 환불 불가|Cancellation on the experience day or for a past date: Non-refundable/
    );
    await expect(legalModal).toContainText(
      /그 외 결제일과 동일한 한국 시간\(KST\) 기준 날짜에 취소한 경우: 여행요금 전액 환불|Otherwise, cancellation on the same Korea Standard Time \(KST\) calendar day as payment: 100% refund/
    );
    await expect(legalModal).toContainText(
      /여행시작 8일 전까지 \(19~8일\) 통보 시: 여행요금의 80% 환불|Notification by 8 days before the experience starts \(19~8 days\): 80% refund/
    );
    await expect(legalModal).toContainText(
      /여행시작 2일 전까지 \(7~2일\) 통보 시: 여행요금의 70% 환불|Notification by 2 days before the experience starts \(7~2 days\): 70% refund/
    );
    await expect(legalModal).toContainText(
      /여행시작 1일 전까지 \(~1일\) 통보 시: 여행요금의 40% 환불|Notification by 1 day before the experience starts \(~1 day\): 40% refund/
    );
    await expect(legalModal).toContainText(
      /호스트 사유로 투어가 취소되거나 회사가 진행 불가를 확인한 경우에는 여행요금을 전액 환불합니다\.|If the host cancels or the company confirms that the experience could not proceed, the booking is fully refunded\./
    );
    await expect(legalModal).not.toContainText(/24시간|within 24 hours of paying/);
    await expect(legalModal).not.toContainText(/가이드가 확정되기 전에|before the guide is confirmed/);
    await expect(legalModal).not.toContainText(/서비스 수수료 10%|service fee/);
    await expect(legalModal).not.toContainText(/현지 예약금|local deposit/);
  });
});
