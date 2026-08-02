import { expect, test } from '@playwright/test';

const ADSENSE_RUNTIME_CONFIGURED =
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
  && /^ca-pub-\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '')
  && /^\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT || '');

const RIGHT_RAIL_RUNTIME_CONFIGURED =
  ADSENSE_RUNTIME_CONFIGURED
  && /^\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT || '');

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

    for (const pathname of [
      '/login',
      '/community/00000000-0000-0000-0000-000000000000',
      '/community/write',
      '/guest/inbox',
      '/guest/trips',
      '/guest/wishlists',
      '/account',
      '/host/dashboard',
    ]) {
      await page.goto(pathname);
      await expect(page.getByTestId('desktop-footer-ad'), pathname).toHaveCount(0);
      await expect(page.getByTestId('desktop-right-rail-ad'), pathname).toHaveCount(0);
      await expect(page.locator('script#locally-google-adsense'), pathname).toHaveCount(0);
      await expect(page.locator('ins.adsbygoogle'), pathname).toHaveCount(0);
    }
  });

  test('adds the footer to public content without a right rail below 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1439, height: 1000 });

    for (const pathname of ['/help', '/become-a-host', '/search', '/community']) {
      await page.goto(pathname);
      await expect(page.getByTestId('desktop-footer-ad'), pathname).toHaveCount(1);
      await expect(page.getByTestId('desktop-right-rail-ad'), pathname).toHaveCount(0);
      await expect(page.locator('script#locally-google-adsense'), pathname).toHaveCount(1);
      await expect(page.locator('ins.adsbygoogle'), pathname).toHaveCount(1);
      await expect(page.locator('footer'), pathname).toHaveCount(1);
    }
  });

  test('does not reserve a right rail column when its slot is not configured', async ({ page }) => {
    test.skip(RIGHT_RAIL_RUNTIME_CONFIGURED, 'Run without a configured right rail slot.');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/help');

    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
    await expect(page.getByTestId('desktop-right-rail-layout')).toHaveCount(0);
    await expect(page.getByTestId('desktop-right-rail-ad')).toHaveCount(0);

    const centered = await page.getByTestId('help-main-content').evaluate((main) => {
      const rect = main.getBoundingClientRect();
      return Math.abs(rect.left - (window.innerWidth - rect.right)) <= 1;
    });
    expect(centered).toBeTruthy();
  });

  test('renders one static 300x600 rail on approved public pages at 1440px', async ({ page }) => {
    test.skip(!RIGHT_RAIL_RUNTIME_CONFIGURED, 'Run with a configured right rail slot.');
    await page.setViewportSize({ width: 1440, height: 1000 });

    const approvedPages = [
      { pathname: '/help', mainTestId: 'help-main-content' },
      { pathname: '/community', mainTestId: 'community-main-content' },
      { pathname: '/company/careers', mainTestId: 'company-careers-main-content' },
      { pathname: '/company/investors', mainTestId: 'company-investors-main-content' },
      { pathname: '/company/news', mainTestId: 'company-news-main-content' },
      { pathname: '/company/notices', mainTestId: 'company-notices-main-content' },
      { pathname: '/company/partnership', mainTestId: 'company-partnership-main-content' },
    ] as const;

    for (const { pathname, mainTestId } of approvedPages) {
      await page.goto(pathname);

      const footerAd = page.getByTestId('desktop-footer-ad');
      const rightRailAd = page.getByTestId('desktop-right-rail-ad');

      await expect(footerAd, pathname).toHaveCount(1);
      await expect(rightRailAd, pathname).toHaveCount(1);
      await expect(page.locator('script#locally-google-adsense'), pathname).toHaveCount(1);
      await expect(page.locator('ins.adsbygoogle'), pathname).toHaveCount(2);

      const layout = await page.evaluate((currentMainTestId) => {
        const main = document.querySelector(`[data-testid="${currentMainTestId}"]`);
        const rail = document.querySelector<HTMLElement>('[data-testid="desktop-right-rail-ad"]');
        const railIns = rail?.querySelector<HTMLElement>('ins.adsbygoogle');
        const mainRect = main?.getBoundingClientRect();
        const railRect = rail?.getBoundingClientRect();

        return {
          gap: mainRect && railRect ? railRect.left - mainRect.right : null,
          railPosition: rail ? window.getComputedStyle(rail).position : null,
          railWidth: railIns?.getBoundingClientRect().width ?? null,
          railHeight: railIns?.getBoundingClientRect().height ?? null,
          railRightDistance: railRect ? window.innerWidth - railRect.right : null,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      }, mainTestId);

      expect(layout.gap).toBeGreaterThanOrEqual(8);
      expect(layout.railPosition).toBe('static');
      expect(layout.railWidth).toBe(300);
      expect(layout.railHeight).toBe(600);
      expect(layout.railRightDistance).toBeGreaterThanOrEqual(0);
      expect(layout.railRightDistance).toBeLessThanOrEqual(8);
      expect(layout.horizontalOverflow).toBeFalsy();
    }
  });

  test('keeps the help modal above and isolated from the right rail ad', async ({ page }) => {
    test.skip(!RIGHT_RAIL_RUNTIME_CONFIGURED, 'Run with a configured right rail slot.');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/help');

    await page.getByTestId('help-contact-modal-trigger').click();

    const modalBackdrop = page.getByTestId('help-contact-modal');
    const rail = page.getByTestId('desktop-right-rail-ad');
    await expect(modalBackdrop).toBeVisible();
    await expect(rail).toHaveCount(1);

    const coverage = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[data-testid="desktop-right-rail-ad"]');
      const backdrop = document.querySelector<HTMLElement>('[data-testid="help-contact-modal"]');
      if (!rail || !backdrop) return null;
      const rect = rail.getBoundingClientRect();
      const topElement = document.elementFromPoint(
        rect.left + rect.width / 2,
        Math.min(window.innerHeight - 1, rect.top + Math.min(rect.height / 2, 200)),
      );
      const backdropRect = backdrop.getBoundingClientRect();

      return {
        railContainsTopElement: Boolean(topElement && rail.contains(topElement)),
        backdropCoversViewport:
          backdropRect.left === 0
          && backdropRect.top === 0
          && backdropRect.right === window.innerWidth
          && backdropRect.bottom === window.innerHeight,
        backdropPointerEvents: window.getComputedStyle(backdrop).pointerEvents,
        backdropZIndex: Number(window.getComputedStyle(backdrop).zIndex),
        railZIndex: window.getComputedStyle(rail).zIndex,
      };
    });

    expect(coverage).toEqual({
      railContainsTopElement: false,
      backdropCoversViewport: true,
      backdropPointerEvents: 'auto',
      backdropZIndex: 210,
      railZIndex: 'auto',
    });
  });
});
