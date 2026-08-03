import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'locally_legacy_popup_closed_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function openFreshHome(page: Page, path = '/') {
  await page.addInitScript((storageKey) => window.localStorage.removeItem(storageKey), STORAGE_KEY);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('legacy-experience-popup')).toBeVisible({ timeout: 10_000 });
}

test.describe('Legacy experience home popup', () => {
  test('matches the desktop actions, traps focus, and remembers dismissal for seven days', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openFreshHome(page, '/ko');

    const dialog = page.getByRole('dialog', { name: '찾으시던 체험이 보이지 않나요?' });
    const close = page.getByTestId('legacy-experience-popup-close');
    const legacyLink = page.getByTestId('legacy-experience-popup-legacy-link');
    const continueButton = page.getByTestId('legacy-experience-popup-continue');

    await expect(dialog).toBeVisible();
    await expect(legacyLink).toHaveAttribute('href', 'https://locally2.imweb.me');
    await expect(close).toBeFocused();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await expect(page.locator('#locally-app-shell')).toHaveAttribute('inert', '');

    const legacyBox = await legacyLink.boundingBox();
    const continueBox = await continueButton.boundingBox();
    const dialogBox = await dialog.boundingBox();
    expect(legacyBox).not.toBeNull();
    expect(continueBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox?.width).toBeLessThanOrEqual(720);
    expect(dialogBox?.height).toBeLessThan(620);
    expect(dialogBox?.x).toBeGreaterThanOrEqual(32);
    expect(dialogBox?.y).toBeGreaterThanOrEqual(32);
    expect(Math.abs((legacyBox?.y ?? 0) - (continueBox?.y ?? 0))).toBeLessThan(4);
    expect((continueBox?.x ?? 0)).toBeGreaterThan((legacyBox?.x ?? 0) + (legacyBox?.width ?? 0));

    await page.keyboard.press('Shift+Tab');
    await expect(continueButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#locally-app-shell')).not.toHaveAttribute('inert', '');
    const dismissedAt = await page.evaluate((storageKey) => Number(window.localStorage.getItem(storageKey)), STORAGE_KEY);
    expect(Date.now() - dismissedAt).toBeLessThan(10_000);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('legacy-experience-popup')).toHaveCount(0);

    await page.evaluate(
      ({ storageKey, oldTimestamp }) => window.localStorage.setItem(storageKey, String(oldTimestamp)),
      { storageKey: STORAGE_KEY, oldTimestamp: Date.now() - SEVEN_DAYS_MS - 1_000 }
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('legacy-experience-popup')).toBeVisible({ timeout: 10_000 });
  });

  test('uses a bottom sheet and vertical actions on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFreshHome(page, '/ja');

    const dialog = page.getByRole('dialog', { name: 'お探しの体験が見つかりませんか？' });
    const legacyLink = page.getByTestId('legacy-experience-popup-legacy-link');
    const continueButton = page.getByTestId('legacy-experience-popup-continue');
    const dialogBox = await dialog.boundingBox();
    const legacyBox = await legacyLink.boundingBox();
    const continueBox = await continueButton.boundingBox();

    expect(dialogBox).not.toBeNull();
    expect(Math.abs(((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)) - 832)).toBeLessThan(2);
    expect(dialogBox?.x).toBeGreaterThanOrEqual(12);
    expect(dialogBox?.width).toBeLessThanOrEqual(366);
    expect(dialogBox?.height).toBeLessThan(650);
    expect((continueBox?.y ?? 0)).toBeGreaterThan((legacyBox?.y ?? 0) + (legacyBox?.height ?? 0));
    await expect(dialog).toContainText('以前の体験を見る');
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });

  test('closes from the X button, continue button, and backdrop, but never renders off home', async ({ page }) => {
    await openFreshHome(page);
    await page.getByTestId('legacy-experience-popup-close').click();
    await expect(page.getByTestId('legacy-experience-popup')).toHaveCount(0);

    await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), STORAGE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('legacy-experience-popup')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('legacy-experience-popup-continue').click();
    await expect(page.getByTestId('legacy-experience-popup')).toHaveCount(0);

    await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), STORAGE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const overlay = page.getByTestId('legacy-experience-popup-overlay');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await overlay.click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('legacy-experience-popup')).toHaveCount(0);

    await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), STORAGE_KEY);
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await expect(page.getByTestId('legacy-experience-popup')).toHaveCount(0);
  });
});
