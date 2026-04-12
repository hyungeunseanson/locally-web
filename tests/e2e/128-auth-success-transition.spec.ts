import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
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

test.describe('Auth success transition', () => {
  test('shows a longer success toast and redirects after login without a success card', async ({ page }) => {
    const user = createTestUser('auth.success.login');
    await createAuthUser(user, createdAuthUserIds);
    await forceEnglishLocale(page);

    await page.goto('/login?returnUrl=%2Fguest%2Ftrips', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await page.locator('input[autocomplete="username"]').fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill(user.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Welcome back. You are now logged in.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('auth-success-state')).toHaveCount(0);
    await page.waitForURL('**/guest/trips', { timeout: 15000 });
  });

  test('keeps the verification toast visible while immediately returning to login mode', async ({ page }) => {
    const signupEmail = `codex.signup.transition.${Date.now()}@example.com`;
    const signupPassword = 'LocallyTest!2026';
    const signupResponsePattern = '**/auth/v1/signup*';
    await forceEnglishLocale(page);

    await page.route(signupResponsePattern, async (route) => {
      const now = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '00000000-0000-4000-8000-000000000128',
            aud: 'authenticated',
            role: 'authenticated',
            email: signupEmail,
            phone: '',
            created_at: now,
            updated_at: now,
            confirmation_sent_at: now,
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: { full_name: 'Signup Transition User' },
            identities: [],
          },
          session: null,
        }),
      });
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await page.getByRole('button', { name: /Don't have an account\?\s*Sign up/i }).click();
    await page.locator('input[autocomplete="username"]').fill(signupEmail);
    await page.getByTestId('signup-password-input').fill(signupPassword);
    await page.getByTestId('signup-password-confirm-input').fill(signupPassword);
    await page.locator('input[autocomplete="name"]').fill('Signup Transition User');
    await page.locator('select').nth(0).selectOption('US');
    await page.locator('input[autocomplete="tel"]').fill('01012345678');
    await page.locator('input[autocomplete="bday"]').fill('19900115');
    await page.locator('select').nth(1).selectOption('Male');
    await page.getByText('Agree to all').click();
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.getByTestId('auth-success-state')).toHaveCount(0);
    await expect(page.getByText('Verification email sent! Confirm your email to unlock all features.')).toBeVisible({
      timeout: 15000,
    });

    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[autocomplete="username"]')).toHaveValue(signupEmail);
  });

  test('does not show the success state when login fails', async ({ page }) => {
    const user = createTestUser('auth.success.fail');
    await createAuthUser(user, createdAuthUserIds);
    await forceEnglishLocale(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await page.locator('input[autocomplete="username"]').fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill(`${user.password}x`);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Your email or password is incorrect.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('auth-success-state')).toHaveCount(0);
  });
});
