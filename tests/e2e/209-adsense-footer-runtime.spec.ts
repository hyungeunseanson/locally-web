import { expect, test } from '@playwright/test';

const ADSENSE_RUNTIME_CONFIGURED =
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
  && /^ca-pub-\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '')
  && /^\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT || '');

test.describe('AdSense desktop footer runtime', () => {
  test.skip(!ADSENSE_RUNTIME_CONFIGURED, 'Run with an enabled test AdSense client and footer slot.');

  test.beforeEach(async ({ page }) => {
    await page.route('https://pagead2.googlesyndication.com/**', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'window.adsbygoogle = window.adsbygoogle || [];',
      });
    });
  });

  test('renders one non-sticky manual ad directly after the desktop footer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/about');

    const footer = page.locator('footer');
    const ad = page.getByTestId('desktop-footer-ad');

    await expect(footer).toBeVisible();
    await expect(ad).toHaveCount(1);
    await expect(page.locator('script#locally-google-adsense')).toHaveCount(1);
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(1);

    const placement = await page.evaluate(() => {
      const footerElement = document.querySelector('footer');
      const adElement = document.querySelector<HTMLElement>('[data-testid="desktop-footer-ad"]');

      return {
        followsFooter: footerElement?.nextElementSibling === adElement,
        position: adElement ? window.getComputedStyle(adElement).position : null,
      };
    });

    expect(placement).toEqual({
      followsFooter: true,
      position: 'static',
    });
  });

  test('does not render the script or slot on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/about');

    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);
    await expect(page.locator('script#locally-google-adsense')).toHaveCount(0);
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  });

  test('does not render ads on excluded product routes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const pathname of ['/login', '/search', '/guest/trips']) {
      await page.goto(pathname);
      await expect(page.getByTestId('desktop-footer-ad'), pathname).toHaveCount(0);
      await expect(page.locator('script#locally-google-adsense'), pathname).toHaveCount(0);
      await expect(page.locator('ins.adsbygoogle'), pathname).toHaveCount(0);
    }
  });
});
