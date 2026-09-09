import { expect, type Page } from '@playwright/test';

export const CANARY_SECRET_HEADER = 'x-locally-canary-secret';

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required functional canary environment variable: ${name}`);
  return value;
}

export function canaryHeaders() {
  return {
    [CANARY_SECRET_HEADER]: requiredEnv('CLOUDFLARE_FUNCTIONAL_CANARY_SECRET'),
  };
}

export async function loginWithPassword(page: Page, emailName = 'CLOUDFLARE_CANARY_GUEST_EMAIL') {
  const passwordName = emailName.replace(/_EMAIL$/, '_PASSWORD');
  await page.goto('/login?returnUrl=%2Faccount', { waitUntil: 'domcontentloaded' });
  const dismiss = page.getByTestId('global-site-announcement-dismiss');
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await page.locator('input[type="email"]').fill(requiredEnv(emailName));
  await page.locator('input[type="password"]').fill(requiredEnv(passwordName));
  await page.getByRole('button', { name: /Log in|로그인/i }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
}

export function isRscRequest(url: string, headers: Record<string, string>) {
  return headers.rsc === '1' || new URL(url).searchParams.has('_rsc');
}
