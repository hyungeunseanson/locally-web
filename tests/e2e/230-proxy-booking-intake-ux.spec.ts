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
    await expect(page.getByText('일본인이 직접 전화하여, 일본 식당 및 업체에서도 신뢰도 UP!')).toBeVisible();
    await expect(page.getByText('번역만 대신 전달하는 방식이 아닙니다. 일본 현지인 팀원이 직접 일본어로 전화합니다.')).toHaveCount(0);
    await expect(page.getByText('① 요청 작성 → ② 결제 확인 → ③ 현지 전화 → ④ 결과 안내')).toBeVisible();
    await expect(page.getByText('리뷰 확인은')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '서비스 안내' })).toHaveCount(0);

    await page.getByLabel('서비스 이용 및 환불 규정에 동의합니다. (필수)').check();
    await page.getByRole('button', { name: '요청 접수하기' }).click();
    await expect(page.getByTestId('proxy-login-required-dialog')).toBeVisible();
    await expect(page.getByText('식당 이름을 입력해주세요.')).toHaveCount(0);
    await page.getByRole('button', { name: '취소' }).click();

    for (const category of ['식당 예약', '숙소 문의', '교통 문의', '현지 업체 문의', '분실물 문의']) {
      await expect(page.getByText(category, { exact: true })).toBeVisible();
    }

    for (const category of ['식당 예약', '숙소 문의', '교통 문의', '현지 업체 문의', '분실물 문의']) {
      await page.getByText(category, { exact: true }).click();
      await expect(page.getByLabel('업장 링크 주소')).toHaveAttribute('required', '');
      await expect(page.getByLabel('업장 링크 주소')).toHaveAttribute('type', 'url');
      await expect(page.getByLabel('업장 전화번호')).toHaveAttribute('required', '');
    }

    await page.getByText('교통 문의', { exact: true }).click();
    await expect(page.getByLabel('업체 이름')).toHaveAttribute('required', '');

    for (const [category, fieldLabel] of [
      ['식당 예약', '식당 이름'],
      ['숙소 문의', '숙소 이름'],
      ['교통 문의', '업체 이름'],
      ['현지 업체 문의', '업체 이름'],
      ['분실물 문의', '분실 장소'],
    ] as const) {
      await page.getByText(category, { exact: true }).click();
      await page.getByLabel(fieldLabel).focus();
      await expect(page.getByTestId('proxy-login-required-dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: '로그인이 필요합니다' })).toBeVisible();
      await page.getByRole('button', { name: '취소' }).click();
      await expect(page.getByTestId('proxy-login-required-dialog')).toHaveCount(0);
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

    await page.getByText('교통 문의', { exact: true }).click();
    await page.getByLabel('업체 이름').focus();
    await Promise.all([
      page.waitForURL(/\/login\?returnUrl=/),
      page.getByRole('button', { name: '로그인/회원가입하기' }).click(),
    ]);

    await page.goto('/proxy-bookings/new', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);
    await expect(page.getByRole('heading', { name: '교통 문의 신청 정보' })).toBeVisible();
  });
});
