import { expect, type BrowserContext, type Page } from '@playwright/test';

export const CANARY_SECRET_HEADER = 'x-locally-canary-secret';
const accessProtectedContexts = new WeakSet<BrowserContext>();

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required functional canary environment variable: ${name}`);
  return value;
}

export function canaryAccessHeaders() {
  return {
    'CF-Access-Client-Id': requiredEnv('CLOUDFLARE_ACCESS_CLIENT_ID'),
    'CF-Access-Client-Secret': requiredEnv('CLOUDFLARE_ACCESS_CLIENT_SECRET'),
  };
}

export function canaryHeaders() {
  return {
    ...canaryAccessHeaders(),
    [CANARY_SECRET_HEADER]: requiredEnv('CLOUDFLARE_FUNCTIONAL_CANARY_SECRET'),
  };
}

export async function protectCanaryBrowserContext(context: BrowserContext) {
  if (accessProtectedContexts.has(context)) return;

  const canaryOrigin = new URL(requiredEnv('CLOUDFLARE_CANARY_BASE_URL')).origin;
  await context.route(
    (url) => url.origin === canaryOrigin,
    async (route) => {
      try {
        await route.continue({
          headers: {
            ...route.request().headers(),
            ...canaryAccessHeaders(),
          },
        });
      } catch {
        // Navigation teardown can abandon prefetches; never print Access headers in diagnostics.
      }
    }
  );
  accessProtectedContexts.add(context);
}

export async function loginWithPassword(page: Page, emailName = 'CLOUDFLARE_CANARY_GUEST_EMAIL') {
  const passwordName = emailName.replace(/_EMAIL$/, '_PASSWORD');
  await protectCanaryBrowserContext(page.context());
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
