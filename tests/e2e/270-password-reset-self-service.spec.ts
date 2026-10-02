import { expect, test, type Page } from '@playwright/test';
import { waitForLoginHydration } from './helpers/loginHydration';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { getPasswordResetCopy } from '@/app/components/passwordResetLocalization';
import { buildPasswordRecoveryRedirect, RECOVERY_COOKIE_NAME, RECOVERY_COOKIE_PATH } from '@/app/utils/passwordReset';
import { isGoogleAnalyticsPathAllowed } from '@/app/utils/analytics/google';
import { startMockSupabaseAuthServer, type MockSupabaseAuthServer } from './helpers/mockSupabaseAuthServer';

// Next dev normalizes Request.url to localhost; Production uses forwarded host.
const ORIGIN = process.env.PLAYWRIGHT_SERVER_MODE === 'start'
  ? 'http://127.0.0.1:3000' : 'http://localhost:3000';
let mock: MockSupabaseAuthServer;
async function navigate(page: Page, path: string) {
  const response = await page.goto(new URL(path, ORIGIN).toString());
  if (new URL(path, ORIGIN).pathname === '/login') await waitForLoginHydration(page);
  return response;
}
async function requestReset(page: Page, email = 'reset@example.com') {
  await navigate(page, '/auth/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Request reset email', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(getPasswordResetCopy('en').sent);
}
async function recover(page: Page) {
  await requestReset(page);
  await navigate(page, '/auth/callback?flow=recovery&next=%2Fauth%2Fupdate-password&code=mock-recovery-code');
  await expect(page).toHaveURL(`${ORIGIN}/auth/update-password`);
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
}
function count(method: string, path: string) {
  return mock.requests.filter((r) => r.method === method && new URL(r.url).pathname === path).length;
}

test.describe('Password reset self-service (local Auth mock only)', () => {
  test.beforeAll(async () => { mock = await startMockSupabaseAuthServer(); });
  test.afterAll(async () => { await mock.close(); });
  test.beforeEach(async ({ context, page }) => {
    mock.resetRequests();
    await context.addCookies([{ name: 'app_lang', value: 'en', url: ORIGIN }]);
    await page.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (!['localhost', '127.0.0.1'].includes(host)) await route.abort();
      else await route.continue();
    });
  });

  test('login link appears only in LOGIN mode', async ({ page }) => {
    await navigate(page, '/login?returnUrl=%2Faccount');
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/auth/forgot-password');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(`${ORIGIN}/auth/forgot-password`);
    await navigate(page, '/login?returnUrl=%2Faccount');
    await page.getByRole('button', { name: /Don't have an account/ }).click();
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveCount(0);
  });

  test('signup retains required fields, agreements, and internal return URL', async ({ page }) => {
    await navigate(page, '/login?returnUrl=%2Faccount');
    await page.getByRole('button', { name: /Don't have an account/ }).click();
    await page.locator('input[autocomplete="username"]').fill('signup@example.com');
    await page.getByTestId('signup-password-input').fill('new-password');
    await page.getByTestId('signup-password-confirm-input').fill('new-password');
    await page.locator('input[autocomplete="name"]').fill('Local Mock User');
    await page.locator('select').nth(0).selectOption('US');
    await page.locator('input[autocomplete="tel"]').fill('01012345678');
    await page.locator('input[autocomplete="bday"]').fill('19900115');
    await page.locator('select').nth(1).selectOption('Male');
    await page.getByText('Agree to all', { exact: true }).click();
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await expect(page).toHaveURL(`${ORIGIN}/account`);
    expect(count('POST', '/auth/v1/signup')).toBe(1);
  });

  test('one recovery request, same-origin callback, no email in redirect', async ({ page }) => {
    const request = page.waitForRequest((r) => new URL(r.url()).pathname === '/auth/v1/recover' && r.method() === 'POST');
    await requestReset(page);
    const url = new URL((await request).url());
    expect(url.searchParams.get('redirect_to')).toBe(buildPasswordRecoveryRedirect(ORIGIN));
    expect(url.toString()).not.toContain('reset@example.com');
    expect(count('POST', '/auth/v1/recover')).toBe(1);
  });

  test('existing, missing, and account-specific errors have identical generic success', async ({ page }) => {
    await requestReset(page, 'exists@example.com');
    mock.setRecoveryStatus(400);
    await requestReset(page, 'missing@example.com');
    await expect(page.getByText('Sensitive account detail')).toHaveCount(0);
  });

  test('429 shows safe retry copy', async ({ page }) => {
    mock.setRecoveryStatus(429);
    await navigate(page, '/auth/forgot-password');
    await page.getByLabel('Email', { exact: true }).fill('reset@example.com');
    await page.getByRole('button', { name: 'Request reset email', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(getPasswordResetCopy('en').retryLater);
    expect(count('POST', '/auth/v1/recover')).toBe(1);
  });

  test('PKCE recovery skips demographics side effects, blocks external next, and strips code', async ({ page }) => {
    await requestReset(page);
    const response = await navigate(page, '/auth/callback?flow=recovery&next=https%3A%2F%2Fevil.example&code=mock-recovery-code');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(`${ORIGIN}/auth/update-password`);
    expect(count('POST', '/auth/v1/token')).toBe(1);
    expect(mock.requests.some((r) => /demographics|notifications/.test(new URL(r.url).pathname) && r.method === 'POST')).toBe(false);
    // Locale sync must not write user metadata on recovery pages.
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  for (const scenario of ['missing', 'expired', 'reused'] as const) {
    test(`${scenario} code produces a safe retry screen`, async ({ page }) => {
      if (scenario !== 'missing') await requestReset(page);
      if (scenario === 'expired') mock.setPkceStatus(400);
      if (scenario === 'reused') await navigate(page, '/auth/callback?flow=recovery&code=mock-recovery-code');
      const code = scenario === 'missing' ? '' : '&code=mock-recovery-code';
      await navigate(page, `/auth/callback?flow=recovery${code}`);
      await expect(page).toHaveURL(/\/auth\/forgot-password\?invalid=1$/);
      await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
      await expect(page.getByRole('link', { name: 'Request another reset email' })).toHaveAttribute('href', '/auth/forgot-password');
      expect(count('PUT', '/auth/v1/user')).toBe(0);
      expect((await page.context().cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
      await expect(page.getByText('Sensitive provider diagnostic')).toHaveCount(0);
    });
  }

  test('mismatch and minimum signup length block password writes', async ({ page }) => {
    await recover(page);
    await page.getByLabel('New password', { exact: true }).fill('new-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('other-password');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Passwords do not match.');
    expect(count('PUT', '/auth/v1/user')).toBe(0);
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Confirm password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  for (const logoutStatus of [204, 401, 403, 404]) {
    test(`valid recovery updates once and clears local session (logout ${logoutStatus})`, async ({ page, context }) => {
      await recover(page);
      mock.setLogoutStatus(logoutStatus);
      const changed = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/auth/update-password/submit');
      await page.getByLabel('New password', { exact: true }).fill('new-password');
      await page.getByLabel('Confirm password', { exact: true }).fill('new-password');
      await page.getByRole('button', { name: 'Change password', exact: true }).click();
      expect((await changed).postDataJSON()).toEqual({ password: 'new-password', confirmation: 'new-password' });
      await expect(page.getByRole('status')).toHaveText(getPasswordResetCopy('en').success);
      expect(count('PUT', '/auth/v1/user')).toBe(1);
      expect(mock.requests.find((r) => r.method === 'PUT')?.bodyFields).toEqual(['password', 'code_challenge', 'code_challenge_method']);
      expect((await context.cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
      const logout = mock.requests.find((r) => new URL(r.url).pathname === '/auth/v1/logout');
      expect(new URL(logout!.url).searchParams.get('scope')).toBe('local');
      expect((await context.cookies()).filter((c) => /-auth-token(?:\.\d+)?$/.test(c.name))).toHaveLength(0);
      await page.getByRole('link', { name: 'Continue to login' }).click();
      await expect(page).toHaveURL(`${ORIGIN}/login`);
      await page.goBack();
      await expect(page.locator('input[type=password]')).toHaveCount(0);
      await navigate(page, '/auth/update-password');
      await expect(page.locator('input[type=password]')).toHaveCount(0);
      expect(count('PUT', '/auth/v1/user')).toBe(1);
    });
  }

  test('cleanup failure allows retry without updating password twice', async ({ page }) => {
    await recover(page);
    mock.setLogoutStatus(500);
    await page.getByLabel('New password', { exact: true }).fill('new-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('new-password');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(getPasswordResetCopy('en').cleanupFailed);
    mock.setLogoutStatus(204);
    await page.getByRole('button', { name: 'Continue to login' }).click();
    await expect(page.getByRole('link', { name: 'Continue to login' })).toBeVisible();
    expect(count('PUT', '/auth/v1/user')).toBe(1);
  });

  test('successful change consumes recovery state even when local cleanup fails', async ({ page, context }) => {
    await recover(page);
    const grant = (await context.cookies()).find((c) => c.name === RECOVERY_COOKIE_NAME)!;
    expect(grant.httpOnly).toBe(true);
    expect(grant.secure).toBe(process.env.PLAYWRIGHT_SERVER_MODE === 'start');
    expect(grant.sameSite).toBe('Lax');
    expect(grant.path).toBe(RECOVERY_COOKIE_PATH);
    expect(grant.expires).toBeLessThanOrEqual(Date.now() / 1000 + 600);
    mock.setLogoutStatus(500);
    await page.getByLabel('New password', { exact: true }).fill('new-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('new-password');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(getPasswordResetCopy('en').cleanupFailed);
    expect(count('PUT', '/auth/v1/user')).toBe(1);
    expect((await context.cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
    // Restore the old signed grant while the session is still present. Auth's
    // consumed recovery state must reject it, rather than trusting cookie deletion.
    await context.addCookies([grant]);
    await page.reload();
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    const response = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: ORIGIN }, data: { password: 'another-password', confirmation: 'another-password' },
    });
    expect(response.status()).toBe(403);
    expect(count('PUT', '/auth/v1/user')).toBe(1);
  });

  test('authenticated recovery session without server marker cannot update', async ({ page, context }) => {
    await recover(page);
    await context.clearCookies({ name: RECOVERY_COOKIE_NAME });
    await page.reload();
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    const response = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: ORIGIN }, data: { password: 'new-password', confirmation: 'new-password' },
    });
    expect(response.status()).toBe(403);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('expired signed recovery grant blocks both UI and server mutation', async ({ page, context }) => {
    await recover(page);
    const grant = (await context.cookies()).find((c) => c.name === RECOVERY_COOKIE_NAME)!;
    const original = JSON.parse(Buffer.from(grant.value.split('.')[0], 'base64url').toString());
    // Sign an expired grant with the local mock-only signing key. Retain a live
    // browser cookie to test server expiry, rather than browser deletion alone.
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ ...original, issuedAt: now - 601, expiresAt: now - 1 })).toString('base64url');
    const key = createHmac('sha256', process.env.CRON_SECRET!).update('locally/password-recovery/v1/key').digest();
    const signed = createHmac('sha256', key).update(`locally/password-recovery/v1:${payload}`).digest('hex');
    await context.addCookies([{ ...grant, value: `${payload}.${signed}` }]);
    await page.reload();
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    const denied = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: ORIGIN }, data: { password: 'new-password', confirmation: 'new-password' },
    });
    expect(denied.status()).toBe(403);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('old recovery grant cannot authorize a different session', async ({ page, context }) => {
    await recover(page);
    const grant = (await context.cookies()).find((c) => c.name === RECOVERY_COOKIE_NAME)!;
    await context.clearCookies();
    await recover(page);
    await context.addCookies([grant]);
    await page.reload();
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    const denied = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: ORIGIN }, data: { password: 'new-password', confirmation: 'new-password' },
    });
    expect(denied.status()).toBe(403);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('recovery exchange without explicit recovery flow never issues a grant', async ({ page, context }) => {
    await requestReset(page);
    await navigate(page, '/auth/callback?code=mock-recovery-code&next=%2Fauth%2Fupdate-password');
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    expect((await context.cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('OAuth code with flow=recovery cannot mint a recovery marker', async ({ page, context }) => {
    await requestReset(page);
    await navigate(page, '/auth/callback?flow=recovery&code=mock-oauth-code');
    await expect(page).toHaveURL(/forgot-password\?invalid=1$/);
    expect((await context.cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('tampered marker and cross-origin POST cannot update', async ({ page, context }) => {
    await recover(page);
    const grant = (await context.cookies()).find((c) => c.name === RECOVERY_COOKIE_NAME)!;
    const crossOrigin = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: 'https://evil.example' }, data: { password: 'new-password', confirmation: 'new-password' },
    });
    expect(crossOrigin.status()).toBe(403);
    await context.addCookies([{ ...grant, value: grant.value.slice(0, -1) + (grant.value.endsWith('a') ? 'b' : 'a') }]);
    await page.reload();
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    const denied = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: ORIGIN }, data: { password: 'new-password', confirmation: 'new-password' },
    });
    expect(denied.status()).toBe(403);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('normal email login cannot enter recovery directly or write a password', async ({ page }) => {
    await navigate(page, '/login?returnUrl=%2Faccount');
    await page.locator('input[type="email"]').fill('auth.regression@example.com');
    await page.locator('input[type="password"]').fill('auth-regression-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(`${ORIGIN}/account`);
    await navigate(page, '/auth/update-password');
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
    expect((await page.context().cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
    const denied = await page.request.post(`${ORIGIN}/auth/update-password/submit`, {
      headers: { Origin: ORIGIN }, data: { password: 'new-password', confirmation: 'new-password' },
    });
    expect(denied.status()).toBe(403);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('missing session blocks update UI', async ({ page }) => {
    await navigate(page, '/auth/update-password?flow=recovery');
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('session revoked after rendering blocks submit', async ({ page }) => {
    await recover(page);
    mock.setUserStatus(401);
    await page.getByLabel('New password', { exact: true }).fill('new-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('new-password');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText(getPasswordResetCopy('en').invalid);
    expect(count('PUT', '/auth/v1/user')).toBe(0);
  });

  test('OAuth callback keeps internal return path and rejects external next', async ({ page }) => {
    await requestReset(page); // Establish a local PKCE verifier for callback regression.
    await navigate(page, '/auth/callback?code=mock-oauth-code&next=%2Faccount');
    await expect(page).toHaveURL(`${ORIGIN}/account`);
    expect((await page.context().cookies()).some((c) => c.name === RECOVERY_COOKIE_NAME)).toBe(false);
    await page.context().clearCookies();
    await requestReset(page);
    await navigate(page, '/auth/callback?code=mock-oauth-code&next=https%3A%2F%2Fevil.example');
    await expect(page).toHaveURL(`${ORIGIN}/`);
  });

  for (const locale of ['ko', 'en', 'ja', 'zh']) {
    test(`${locale} reset and help copy`, async ({ page, context }) => {
      await context.addCookies([{ name: 'app_lang', value: locale, url: ORIGIN }]);
      await navigate(page, '/auth/forgot-password');
      await expect(page.getByRole('heading', { name: getPasswordResetCopy(locale).title, exact: true })).toBeVisible();
      await navigate(page, '/help');
      const questions = { ko: '비밀번호를 잊어버렸어요.', en: 'I forgot my password.', ja: 'パスワードを忘れました。', zh: '我忘记密码了。' };
      await page.getByRole('button', { name: questions[locale as keyof typeof questions], exact: true }).click();
      await expect(page.getByText(getPasswordResetCopy(locale).guidance, { exact: true })).toBeVisible();
    });
  }

  test('no sensitive telemetry or stale unsupported copy', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));
    await requestReset(page, 'private-email@example.com');
    expect(logs.join('\n')).not.toContain('private-email@example.com');
    for (const path of ['/auth/forgot-password', '/auth/update-password', '/auth/callback']) {
      expect(isGoogleAnalyticsPathAllowed(path)).toBe(false);
    }
    for (const file of ['app/auth/PasswordResetForm.tsx', 'app/auth/callback/route.ts', 'app/auth/update-password/submit/route.ts', 'app/utils/passwordRecovery.server.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/sendGoogleAnalyticsEvent|captureException|captureRequestError|console\.(log|error)|localStorage/);
      expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|updateUserById/);
    }
    for (const file of ['app/help/faqContent.ts', 'app/context/LanguageContext.tsx']) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/비밀번호 재설정 기능.*지원하지|Password reset is not|再設定機能は提供していません|暂不支持密码重置|尚未开放独立/);
    }
  });
});
