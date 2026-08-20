import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  getGlobalSupportReportMobilePosition,
  shouldHideGlobalSupportReport,
} from '@/app/components/support/GlobalSupportReportButton';
import { getSupportInquiryCopy } from '@/app/components/support/supportInquiryCopy';
import {
  clearExpiredSupportReportPending,
  consumeSupportReportPending,
  markSupportReportPending,
  SUPPORT_REPORT_PENDING_STORAGE_KEY,
  SUPPORT_REPORT_PENDING_TTL_MS,
} from '@/app/components/support/supportReportPending';
import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
} from './helpers/testSupabase';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test.describe('Global support report contracts', () => {
  test('localizes every public label and consumes only a fresh login continuation', () => {
    expect(getSupportInquiryCopy('ko').reportButtonLabel).toBe('오류·불편 신고');
    expect(getSupportInquiryCopy('en').reportButtonLabel).toBe('Report a problem');
    expect(getSupportInquiryCopy('ja').reportButtonLabel).toBe('不具合を報告');
    expect(getSupportInquiryCopy('zh').reportButtonLabel).toBe('报告问题');

    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 7, 12, 0, 0);
    markSupportReportPending(storage, now);
    expect(consumeSupportReportPending(storage, now + SUPPORT_REPORT_PENDING_TTL_MS)).toBe(true);
    expect(storage.getItem(SUPPORT_REPORT_PENDING_STORAGE_KEY)).toBeNull();

    markSupportReportPending(storage, now);
    clearExpiredSupportReportPending(storage, now + SUPPORT_REPORT_PENDING_TTL_MS + 1);
    expect(storage.getItem(SUPPORT_REPORT_PENDING_STORAGE_KEY)).toBeNull();

    storage.setItem(SUPPORT_REPORT_PENDING_STORAGE_KEY, '{invalid-json');
    expect(consumeSupportReportPending(storage, now)).toBe(false);
    expect(storage.getItem(SUPPORT_REPORT_PENDING_STORAGE_KEY)).toBeNull();
  });

  test('keeps route exclusions and mobile offsets explicit', () => {
    for (const pathname of [
      '/help',
      '/admin/dashboard',
      '/login',
      '/signup',
      '/auth/callback',
      '/host/create',
      '/host/register',
      '/host/experiences/example/edit',
    ]) {
      expect(shouldHideGlobalSupportReport(pathname), pathname).toBe(true);
    }
    expect(shouldHideGlobalSupportReport('/privacy')).toBe(false);
    expect(getGlobalSupportReportMobilePosition('/privacy')).toBe('bottom-[96px]');
    expect(getGlobalSupportReportMobilePosition('/community')).toBe('bottom-[144px]');
    expect(getGlobalSupportReportMobilePosition('/guest/inbox')).toBe('bottom-[156px]');
    expect(getGlobalSupportReportMobilePosition('/host/dashboard', 'inquiries')).toBe('bottom-[156px]');
    expect(getGlobalSupportReportMobilePosition('/services/request')).toBe('bottom-[120px]');
    expect(getGlobalSupportReportMobilePosition('/experiences/1/payment')).toBe('bottom-[120px]');

    const communityCtaSource = readFileSync(
      'app/community/components/CommunityWriteCta.tsx',
      'utf8'
    );
    expect(communityCtaSource).toContain('fixed bottom-20 right-4');
    expect(communityCtaSource).toContain('h-12 w-12');
  });

  test('shows public entry points but requires login before opening the report modal', async ({ page }) => {
    await page.goto('/privacy');
    const globalTrigger = page.getByTestId('global-support-report-trigger');
    await expect(globalTrigger).toBeVisible();
    await globalTrigger.click();

    const loginModal = page.getByTestId('login-modal');
    await expect(loginModal).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), SUPPORT_REPORT_PENDING_STORAGE_KEY))
      .toBeTruthy();

    await loginModal.locator('button').first().click();
    await expect(loginModal).toHaveCount(0);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), SUPPORT_REPORT_PENDING_STORAGE_KEY))
      .toBeNull();

    await page.goto('/help');
    await expect(page.getByTestId('global-support-report-trigger')).toHaveCount(0);
    await expect(page.getByTestId('help-contact-modal-trigger')).toBeVisible();
    await page.getByTestId('help-contact-modal-trigger').click();
    await expect(page.getByTestId('login-modal')).toBeVisible();

    await page.goto('/login');
    await expect(page.getByTestId('global-support-report-trigger')).toHaveCount(0);
  });

  test('preserves input after failure, prevents duplicate submit, and restores trigger focus', async ({ page }) => {
    test.setTimeout(60000);
    const user = createTestUser('global.support.report');
    const userId = await createAuthUser(user);

    try {
      await login(page, user);
      await page.goto('/privacy');

      const trigger = page.getByTestId('global-support-report-trigger');
      await trigger.click();
      const dialog = page.getByRole('dialog');
      const textarea = page.getByTestId('support-inquiry-content');
      const submitButton = page.getByTestId('support-inquiry-submit');
      await expect(dialog).toBeVisible();
      await expect(textarea).toBeFocused();
      await expect(submitButton).toBeDisabled();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      await trigger.click();
      const reportContent = `화면 이용 중 불편 신고 ${Date.now()}`;
      await textarea.fill(reportContent);

      let unauthorizedPostCount = 0;
      await page.route('**/api/inquiries/thread', async (route) => {
        unauthorizedPostCount += 1;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Unauthorized' }),
        });
      });
      await submitButton.click();
      await expect.poll(() => unauthorizedPostCount).toBe(1);
      const reauthModal = page.getByTestId('login-modal');
      await expect(reauthModal).toBeVisible();
      await reauthModal.locator('button').first().click();
      await page.unroute('**/api/inquiries/thread');

      await trigger.click();
      await expect(textarea).toHaveValue(reportContent);

      let failedPostCount = 0;
      await page.route('**/api/inquiries/thread', async (route) => {
        failedPostCount += 1;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'injected support failure' }),
        });
      });
      await submitButton.click();
      await expect.poll(() => failedPostCount).toBe(1);
      await expect(textarea).toHaveValue(reportContent);
      await page.unroute('**/api/inquiries/thread');

      let successfulPostCount = 0;
      let submittedBody: Record<string, unknown> | null = null;
      await page.route('**/api/inquiries/thread', async (route) => {
        successfulPostCount += 1;
        submittedBody = route.request().postDataJSON() as Record<string, unknown>;
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            inquiryId: 987654,
            redirectUrl: '/privacy?supportSubmitted=1',
          }),
        });
      });

      await expect(submitButton).toBeEnabled();
      await submitButton.click();
      await submitButton.evaluate((button: HTMLButtonElement) => button.click());
      await page.waitForURL(/supportSubmitted=1/);
      expect(successfulPostCount).toBe(1);
      expect(submittedBody).toEqual({
        contextType: 'admin_support',
        message: reportContent,
      });
    } finally {
      const supabase = getTestAdminClient();
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test('does not overlap the mobile bottom navigation or reserved community CTA area', async ({ page }) => {
    const user = createTestUser('global.support.mobile');
    const userId = await createAuthUser(user);

    try {
      await login(page, user);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/privacy');

      const supportBox = await page.getByTestId('global-support-report-trigger').boundingBox();
      const navBox = await page.locator('nav.fixed.bottom-0').boundingBox();
      expect(supportBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(supportBox!.y + supportBox!.height).toBeLessThanOrEqual(navBox!.y);

      await page.goto('/community');
      const communitySupportBox = await page.getByTestId('global-support-report-trigger').boundingBox();
      expect(communitySupportBox).not.toBeNull();
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      const reservedCommunityWriteCtaTop = viewport!.height - 20 - 48;
      expect(communitySupportBox!.y + communitySupportBox!.height)
        .toBeLessThanOrEqual(reservedCommunityWriteCtaTop);
    } finally {
      const supabase = getTestAdminClient();
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });
});
