import { expect, test } from '@playwright/test';

test.describe('Help Center self-service copy', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('app_lang', 'ko');
      document.cookie = 'app_lang=ko; path=/';
    });
  });

  test('shows expanded guest help categories and support surfaces without legacy eSIM copy', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('help-featured-topics')).toBeVisible();
    await expect(page.getByTestId('help-inbox-reply-strip')).toBeVisible();
    await expect(page.getByTestId('help-category-guest-service-request')).toBeVisible();
    await expect(page.getByTestId('help-category-guest-service-matching')).toBeVisible();
    await expect(page.getByTestId('help-category-guest-proxy')).toBeVisible();
    await expect(page.getByTestId('help-category-guest-care')).toBeVisible();
    await expect(page.getByTestId('help-category-guest-cancellation')).toBeVisible();
    await expect(page.getByRole('button', { name: '호스트에게 팁을 드려도 되나요?' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('eSIM');

    await expect(page.getByTestId('help-public-support-email')).toHaveAttribute(
      'href',
      /mailto:locally\.partners@gmail\.com\?subject=Locally%20Support/
    );
    await expect(page.getByTestId('help-public-support-email-note')).toContainText('locally.partners@gmail.com');
  });

  test('shows expanded host help categories', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '호스트 (For Hosts)' }).click();

    await expect(page.getByTestId('help-category-host-review')).toBeVisible();
    await expect(page.getByTestId('help-category-host-profile')).toBeVisible();
    await expect(page.getByTestId('help-category-host-operation')).toBeVisible();
    await expect(page.getByTestId('help-category-host-jobs')).toBeVisible();
    await expect(page.getByTestId('help-category-host-payout')).toBeVisible();
    await expect(page.getByTestId('help-category-host-policy')).toBeVisible();
    await expect(page.getByRole('button', { name: '게스트가 팁을 주겠다고 하면 받아도 되나요?' })).toBeVisible();
  });

  test('routes key search terms to FAQ results before falling back to inquiry empty state', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' });

    await page.getByRole('textbox').fill('입금');
    await expect(page.getByText('무통장 입금은 언제까지 해야 하나요?')).toBeVisible();
    await expect(page.getByTestId('help-search-empty-state')).toHaveCount(0);

    await page.getByRole('textbox').fill('PayPal');
    await expect(page.getByText('카드·무통장·PayPal 중 어떤 결제가 가능한가요?')).toBeVisible();

    await page.getByRole('textbox').fill('1인 예약');
    await expect(page.getByText('1인 출발 보장 옵션은 언제 필요한가요?')).toBeVisible();

    await page.getByRole('textbox').fill('호스트 선택');
    await expect(page.getByText('여러 지원자 중 누구를 어떻게 선택하나요?')).toBeVisible();

    await page.getByRole('textbox').fill('전화예약');
    await expect(page.getByText('전화예약으로 어떤 문의를 맡길 수 있나요?')).toBeVisible();

    await page.getByRole('textbox').fill('Tier 2');
    await expect(page.getByText('Tier 1과 Tier 2 차이는 무엇인가요?')).toBeVisible();

    await page.getByRole('textbox').fill('노쇼');
    await expect(page.getByText('당일 지각·노쇼는 어떻게 처리되나요?')).toBeVisible();

    await page.getByRole('textbox').fill('커피');
    await expect(page.getByText('호스트에게 팁을 드려도 되나요?')).toBeVisible();

    await page.getByRole('button', { name: '호스트 (For Hosts)' }).click();
    await page.getByRole('textbox').fill('추가 금액');
    await expect(page.getByText('게스트가 팁을 주겠다고 하면 받아도 되나요?')).toBeVisible();

    await page.getByRole('textbox').fill('playwright-no-faq-match');
    await expect(page.getByTestId('help-search-empty-state')).toBeVisible();
    await expect(page.getByTestId('help-search-empty-cta')).toBeVisible();
  });

  test('shows the current experience refund matrix without legacy 24-hour withdrawal copy', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' });

    const cancellationCategory = page.getByTestId('help-category-guest-cancellation');

    await page.getByRole('textbox').fill('환불 규정');
    await page.getByRole('button', { name: '취소 규정은 어떻게 계산되나요?' }).click();

    await expect(
      page.getByText(
        '현재 기준으로 체험일 당일이나 이미 지난 일정은 환불되지 않습니다. 그 외에는 결제 당일 취소 100%, 체험일 20일 전까지는 100%, 8~19일 전은 80%, 2~7일 전은 70%, 1일 전은 40% 환불됩니다. 호스트 사유 취소나 운영팀이 진행 불가를 확인한 취소는 전액 환불됩니다.'
      )
    ).toBeVisible();
    await expect(cancellationCategory).not.toContainText('24시간');
    await expect(cancellationCategory).not.toContainText('서비스 수수료 10%');
  });
});
