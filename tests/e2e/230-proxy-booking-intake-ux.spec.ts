import { expect, test, type Page } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Proxy booking intake UX', () => {
  test('keeps the intake flow compact while preserving categories and payment branches', async ({ page }) => {
    await page.goto('/proxy-bookings/new', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByRole('heading', { name: '일본 현지 전화, 로컬리가 대신해드려요' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /한국인 ❌\s+일본 현지인 ✅/ })).toBeVisible();
    await expect(page.getByText('① 요청 작성 → ② 결제 확인 → ③ 현지 전화 → ④ 결과 안내')).toBeVisible();
    await expect(page.getByText('리뷰 확인은')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '서비스 안내' })).toHaveCount(0);

    for (const category of ['식당 예약', '숙소 문의', '교통 문의', '현지 업체 문의', '분실물 문의']) {
      await expect(page.getByText(category, { exact: true })).toBeVisible();
    }

    await page.getByText('숙소 문의', { exact: true }).click();
    await expect(page.getByRole('heading', { name: '숙소 문의 신청 정보' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '예약 정보를 알려주세요' })).toBeVisible();
    await page.getByLabel('문의 유형').selectOption('CHANGE');
    await expect(page.getByLabel('어떻게 변경하고 싶으신가요?')).toBeVisible();
    await page.getByLabel('문의 유형').selectOption('CANCEL');
    await expect(page.getByLabel('어떻게 변경하고 싶으신가요?')).toHaveCount(0);

    await expect(page.locator('input[value="card"]')).toBeVisible();
    await expect(page.locator('input[value="bank"]')).toBeVisible();
    await expect(page.locator('input[value="NAVER"]')).toBeVisible();

    await page.locator('input[value="card"]').check();
    await expect(page.getByTestId('proxy-bank-transfer-notice')).toHaveCount(0);
    await expect(page.getByText('결제 금액')).toBeVisible();

    await page.locator('input[value="bank"]').check();
    await expect(page.getByTestId('proxy-bank-transfer-notice')).toBeVisible();

    await page.locator('input[value="NAVER"]').check();
    await expect(page.getByTestId('proxy-bank-transfer-notice')).toHaveCount(0);
    await expect(page.getByLabel('구매자 이름')).toBeVisible();
  });
});
