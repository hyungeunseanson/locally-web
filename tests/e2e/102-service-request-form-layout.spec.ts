import { test, expect } from '@playwright/test';

const SECTION_PLAN = /일정과 기본 조건|Schedule and basic details|日程と基本条件|行程与基本条件/;
const SECTION_REQUEST = /원하는 서비스 내용|What you need help with|希望するサービス内容|您需要的服务内容/;
const SECTION_CONTACT = /연락 및 결제 진행 정보|Contact and payment details|連絡先と決済情報|联系与支付信息/;
const SUMMARY_TITLE = /예상 결제 요약|Estimated payment summary|決済予定の概要|预计支付摘要/;
const NEXT_STEP = /다음 단계|What happens next|次のステップ|接下来会发生什么/;
const SUBMIT_CTA = /의뢰 등록 및 결제하기|Register & Pay for Request|リクエストを登録して決済する|提交需求并支付/;

test.describe('Service request form layout', () => {
  test('shows grouped sections and sticky summary on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });
    await page.goto('/services/request', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(SECTION_PLAN)).toBeVisible();
    await expect(page.getByText(SECTION_REQUEST)).toBeVisible();
    await expect(page.getByText(SECTION_CONTACT)).toBeVisible();
    await expect(page.getByRole('complementary').getByText(SUMMARY_TITLE)).toBeVisible();
    await expect(page.getByRole('complementary').getByText(NEXT_STEP)).toBeVisible();
    await expect(page.getByRole('button', { name: SUBMIT_CTA }).last()).toBeVisible();
  });

  test('keeps summary card visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1200 });
    await page.goto('/services/request', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(SECTION_PLAN)).toBeVisible();
    await expect(page.getByText(SUMMARY_TITLE).first()).toBeVisible();
    await expect(page.getByRole('button', { name: SUBMIT_CTA }).first()).toBeVisible();
  });

  test('keeps service intro mobile CTA above the viewport bottom without bottom tab overlap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/services/intro', { waitUntil: 'domcontentloaded' });

    const mobileCta = page.getByTestId('service-intro-mobile-cta');
    await expect(mobileCta).toBeVisible();
    await expect(mobileCta).toBeInViewport();
    await expect(page.getByTestId('mobile-tab-home')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(mobileCta).toBeInViewport();
  });

  test('keeps request submit CTA accessible on short mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/services/request', { waitUntil: 'domcontentloaded' });

    const mobileCta = page.getByTestId('service-request-mobile-cta');
    const submitButton = page.getByTestId('service-request-mobile-submit');

    await expect(mobileCta).toBeVisible();
    await expect(mobileCta).toBeInViewport();
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeInViewport();
    await expect(page.getByTestId('mobile-tab-home')).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(submitButton).toBeInViewport();
  });
});
