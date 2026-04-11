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

async function submitLoginForm(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

test.describe('Login flow guidance', () => {
  test('shows return guidance when a returnUrl is present', async ({ page }) => {
    await page.goto('/login?returnUrl=%2Fguest%2Ftrips', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByTestId('login-page-help')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('login-page-help')).toContainText(
      /로그인하면 바로 이어서 진행할 수 있어요|You can continue right away after login|ログインするとすぐに続けられます|登录后可以立刻继续/
    );
    await expect(page.getByTestId('login-modal-flow-hint')).toContainText(
      /로그인하고 계속 진행해요|Log in to continue|ログインして続けましょう|登录后继续/
    );
    await expect(page.getByTestId('login-modal-flow-hint')).toContainText(
      /로그인 후 지금 보던 화면으로 돌아가 바로 이어서 진행해요|After login, you will return to the screen you were viewing and continue right away|ログイン後は、今見ていた画面に戻ってそのまま続けられます|登录后会回到刚才的页面，直接继续操作/
    );
    await expect(page.getByTestId('login-modal-social-return-hint')).toBeVisible();
  });

  test('redirects authenticated users only to normalized internal returnUrl values', async ({ page }) => {
    const user = createTestUser('login.return');
    await createAuthUser(user, createdAuthUserIds);
    await login(page, user);

    const cases = [
      {
        query: '/login?returnUrl=%2Fguest%2Ftrips',
        expectedPath: '/guest/trips',
      },
      {
        query: '/login?returnUrl=https%3A%2F%2Fevil.example',
        expectedPath: '/',
      },
      {
        query: '/login?returnUrl=%2F%2Fevil.example',
        expectedPath: '/',
      },
      {
        query: '/login?returnUrl=javascript%3Aalert(1)',
        expectedPath: '/',
      },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.query, { waitUntil: 'domcontentloaded' });
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
        .toBe(testCase.expectedPath);
    }
  });

  for (const protectedPath of ['/guest/inbox', '/guest/wishlists', '/account'] as const) {
    test(`redirects ${protectedPath} to login and resumes on the same canonical page after login`, async ({ page }) => {
      const user = createTestUser(`login.protected-return.${protectedPath.replace(/\W+/g, '.')}`);
      await createAuthUser(user, createdAuthUserIds);

      await page.goto(protectedPath, { waitUntil: 'domcontentloaded' });

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
        .toBe('/login');
      await expect
        .poll(() => new URL(page.url()).searchParams.get('returnUrl'))
        .toBe(protectedPath);

      await dismissAnnouncementIfVisible(page);
      await submitLoginForm(page, user.email, user.password);
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30000 })
        .toBe(protectedPath);
    });
  }
});
