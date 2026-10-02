import { expect, type Page } from '@playwright/test';

// SSR form visibility is deliberately independent of hydration. Before testing
// submission, observe the real React focus handler (not merely DOM presence).
export async function waitForLoginHydration(page: Page) {
  const email = page.locator('input[type="email"]');
  await expect(async () => {
    await email.blur();
    await email.focus();
    await expect(email.locator('..')).toHaveClass(/ring-black/);
  }).toPass({ timeout: 10_000 });
}
