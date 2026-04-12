import { expect, test, type Page } from '@playwright/test';

import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  login,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];

test.afterAll(async () => {
  await cleanupAuthUsers(createdAuthUserIds);
});

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

async function forceEnglishLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('app_lang', 'en');
    document.cookie = 'app_lang=en; path=/';
  });
}

async function forceKoreanLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('app_lang', 'ko');
    document.cookie = 'app_lang=ko; path=/';
  });
}

test.describe('Account accessibility auth surfaces', () => {
  test('requires password confirmation before signup submits', async ({ page }) => {
    let signupRequested = false;

    await forceEnglishLocale(page);
    await page.route('**/auth/v1/signup*', async (route) => {
      signupRequested = true;
      await route.abort();
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await page.getByRole('button', { name: /Don't have an account\?\s*Sign up/i }).click();
    await expect(page.getByTestId('signup-password-confirm-input')).toBeVisible();

    await page.locator('input[autocomplete="username"]').fill(`codex.signup.mismatch.${Date.now()}@example.com`);
    await page.getByTestId('signup-password-input').fill('LocallyTest!2026');
    await page.getByTestId('signup-password-confirm-input').fill('LocallyTest!2027');
    await page.locator('input[autocomplete="name"]').fill('Mismatch User');
    await page.locator('select').nth(0).selectOption('US');
    await page.locator('input[autocomplete="tel"]').fill('01012345678');
    await page.locator('input[autocomplete="bday"]').fill('19900115');
    await page.locator('select').nth(1).selectOption('Male');
    await page.getByText('Agree to all').click();
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.getByText('Passwords do not match.')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    expect(signupRequested).toBe(false);
  });

  test('shows account deletion guidance on the account page', async ({ page }) => {
    const user = createTestUser('account.withdraw.notice');
    await createAuthUser(user, createdAuthUserIds);
    await forceKoreanLocale(page);
    await login(page, user);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('account-withdrawal-notice')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('account-withdrawal-notice')).toContainText(/회원 탈퇴는 운영팀에 문의/);
  });

  test('keeps help account FAQ aligned with the actual account surface', async ({ page }) => {
    await forceKoreanLocale(page);
    await page.goto('/help', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '비밀번호를 잊어버렸어요.' }).click();
    await expect(page.getByText('현재 비밀번호 재설정 기능은 지원하지 않습니다.')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: '회원 탈퇴는 어떻게 하나요?' }).click();
    await expect(page.getByText('회원 탈퇴는 운영팀에 문의해 주세요.')).toBeVisible({ timeout: 10000 });
  });
});
