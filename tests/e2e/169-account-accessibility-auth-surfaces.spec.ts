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

async function forceJapaneseLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('app_lang', 'ja');
    document.cookie = 'app_lang=ja; path=/';
  });
}

async function forceChineseLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('app_lang', 'zh');
    document.cookie = 'app_lang=zh; path=/';
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
    await expect(page.getByText('조금만 더 채우면, 호스트가 나를 더 잘 이해할 수 있어요.')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('지금은 비워두어도 괜찮아요. 채워둘수록 호스트가 더 편하게 대화를 시작할 수 있어요.')
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('MBTI는 내 성향을 가볍게 전하는 작은 힌트가 돼요.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('직업이나 하는 일을 적고, 호스트와 공통 관심사를 만들어보세요.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('* 로그인 이메일은 현재 여기서 변경할 수 없어요.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('account-withdrawal-notice')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('account-withdrawal-notice')).toContainText(/회원 탈퇴/);
    await expect(page.getByTestId('account-withdrawal-notice')).toContainText(
      '탈퇴는 운영팀이 도와드리고 있어요. 문의로 접수해 주세요.'
    );
  });

  test('signs out from the mobile account menu using the shared auth contract', async ({ page }) => {
    const user = createTestUser('account.logout.contract');
    await createAuthUser(user, createdAuthUserIds);
    await forceKoreanLocale(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, user);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.localStorage.setItem('admin_active_tab', 'USERS');
      window.localStorage.setItem('global_chat_last_viewed', '2026-04-12T00:00:00.000Z');
      window.localStorage.setItem('host_checked_reservations', JSON.stringify(['booking-1']));
      window.localStorage.setItem('last_active_update', '2026-04-12T00:00:00.000Z');
      window.localStorage.setItem('locally_recent_searches', JSON.stringify(['seoul']));
    });

    await page.getByRole('button', { name: '로그아웃' }).click();
    await page.waitForURL('**/', { timeout: 15000 });

    await expect
      .poll(
        () =>
          page.evaluate(() => ({
            adminActiveTab: window.localStorage.getItem('admin_active_tab'),
            globalChatLastViewed: window.localStorage.getItem('global_chat_last_viewed'),
            hostCheckedReservations: window.localStorage.getItem('host_checked_reservations'),
            lastActiveUpdate: window.localStorage.getItem('last_active_update'),
            recentSearches: window.localStorage.getItem('locally_recent_searches'),
          })),
        { timeout: 15000 }
      )
      .toEqual({
        adminActiveTab: null,
        globalChatLastViewed: null,
        hostCheckedReservations: null,
        lastActiveUpdate: null,
        recentSearches: null,
      });
  });

  test('keeps help account FAQ aligned with the actual account surface', async ({ page }) => {
    await forceKoreanLocale(page);
    await page.goto('/help', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '비밀번호를 잊어버렸어요.' }).click();
    await expect(page.getByText('현재 비밀번호 재설정 기능은 지원하지 않습니다.')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: '회원 탈퇴는 어떻게 하나요?' }).click();
    await expect(page.getByText('회원 탈퇴는 운영팀이 도와드리고 있어요. 문의로 접수해 주세요.')).toBeVisible({ timeout: 10000 });
  });

  test('keeps account deletion FAQ localized across supported guest locales', async ({ page }) => {
    await forceEnglishLocale(page);
    await page.goto('/help', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'How do I delete my account?' }).click();
    await expect(
      page.getByText('Our support team can help you delete your account. Please contact us to get started.')
    ).toBeVisible({ timeout: 10000 });

    await forceJapaneseLocale(page);
    await page.goto('/help', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '退会するにはどうすればよいですか？' }).click();
    await expect(
      page.getByText('退会をご希望の場合は、運営チームがご案内します。お問い合わせください。')
    ).toBeVisible({ timeout: 10000 });

    await forceChineseLocale(page);
    await page.goto('/help', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '如何注销会员？' }).click();
    await expect(page.getByText('如需注销账号，请联系我们，运营团队会协助处理。')).toBeVisible({ timeout: 10000 });
  });
});
