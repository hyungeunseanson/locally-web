import { expect, test } from '@playwright/test';

const ADSENSE_RUNTIME_CONFIGURED =
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
  && /^ca-pub-\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '')
  && /^\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT || '');

const RIGHT_RAIL_RUNTIME_CONFIGURED =
  ADSENSE_RUNTIME_CONFIGURED
  && /^\d+$/.test(process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT || '');

test.describe('AdSense responsive footer runtime', () => {
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

  test('renders the same responsive footer slot on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/about');

    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
    await expect(page.locator('script#locally-google-adsense')).toHaveCount(1);
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(1);
    await expect(page.locator('footer')).toBeHidden();
    await expect(page.getByTestId('footer-ad-mobile-clearance')).toBeVisible();
  });

  test('keeps one responsive footer slot across the supported width matrix', async ({ page }) => {
    for (const width of [390, 430, 768, 1024, 1280, 1366, 1439, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/about');

      await expect(page.getByTestId('desktop-footer-ad'), `${width}px`).toHaveCount(1);
      await expect(page.locator('ins.adsbygoogle'), `${width}px`).toHaveCount(1);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalOverflow, `${width}px`).toBeFalsy();
    }
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

  test('tracks streamed dynamic metadata in the body without trusting stale or noindex tags', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/about');
    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);

    const replaceMetadata = async ({
      pathname,
      canonicalPathname,
      publicPathname,
      noindex = false,
      target = 'body',
    }: {
      pathname: string;
      canonicalPathname: string;
      publicPathname: string;
      noindex?: boolean;
      target?: 'head' | 'body';
    }) => {
      await page.evaluate((metadata) => {
        window.history.pushState({}, '', metadata.pathname);
        document.querySelectorAll(
          'link[rel="canonical"], meta[name="robots"], meta[name="googlebot"], meta[name="locally-adsense-public-path"]'
        ).forEach((element) => element.remove());

        const root = metadata.target === 'head' ? document.head : document.body;
        const canonical = document.createElement('link');
        canonical.rel = 'canonical';
        canonical.href = `${window.location.origin}${metadata.canonicalPathname}`;
        root.appendChild(canonical);

        const publicPath = document.createElement('meta');
        publicPath.name = 'locally-adsense-public-path';
        publicPath.content = metadata.publicPathname;
        root.appendChild(publicPath);

        if (metadata.noindex) {
          const robots = document.createElement('meta');
          robots.name = 'robots';
          robots.content = 'noindex, nofollow';
          root.appendChild(robots);
        }
      }, {
        pathname,
        canonicalPathname,
        publicPathname,
        noindex,
        target,
      });
    };

    await replaceMetadata({
      pathname: '/experiences/body-public',
      canonicalPathname: '/experiences/body-public',
      publicPathname: '/experiences/body-public',
    });
    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);

    await replaceMetadata({
      pathname: '/experiences/body-private',
      canonicalPathname: '/experiences/body-private',
      publicPathname: '/experiences/body-private',
      noindex: true,
    });
    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);

    await replaceMetadata({
      pathname: '/users/stale-public-path',
      canonicalPathname: '/users/stale-public-path',
      publicPathname: '/users/previous-path',
    });
    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);

    await replaceMetadata({
      pathname: '/community/head-public',
      canonicalPathname: '/community/head-public',
      publicPathname: '/community/head-public',
      target: 'head',
    });
    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(1);
  });

  test('adds the footer to public content without a right rail below 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1439, height: 1000 });

    for (const pathname of [
      '/help',
      '/become-a-host',
      '/search',
      '/community',
      '/privacy',
      '/services/intro',
    ]) {
      await page.goto(pathname);
      await expect(page.getByTestId('desktop-footer-ad'), pathname).toHaveCount(1);
      await expect(page.getByTestId('desktop-right-rail-ad'), pathname).toHaveCount(0);
      await expect(page.locator('script#locally-google-adsense'), pathname).toHaveCount(1);
      await expect(page.locator('ins.adsbygoogle'), pathname).toHaveCount(1);
      await expect(page.locator('footer'), pathname).toHaveCount(1);
    }
  });

  test('keeps the mobile ad creative clear of fixed navigation and actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const hydrationErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (error.message.includes('Hydration failed')) hydrationErrors.push(error.message);
    });

    for (const { pathname, fixedTestIds } of [
      {
        pathname: '/about',
        fixedTestIds: ['mobile-bottom-tab', 'global-support-report-trigger'],
      },
      {
        pathname: '/community',
        fixedTestIds: ['mobile-bottom-tab', 'global-support-report-trigger'],
      },
      {
        pathname: '/services/intro',
        fixedTestIds: ['service-intro-mobile-cta', 'global-support-report-trigger'],
      },
      {
        pathname: '/help',
        fixedTestIds: ['mobile-bottom-tab'],
      },
    ] as const) {
      await page.goto(pathname);
      const creative = page.locator('[data-testid="desktop-footer-ad"] ins.adsbygoogle');
      await expect(creative, pathname).toHaveCount(1);
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      await expect.poll(
        () => page.evaluate(
          () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight
        ),
        { message: `${pathname} reaches the document bottom` }
      ).toBeTruthy();

      for (const testId of fixedTestIds) {
        const fixedElement = page.getByTestId(testId);
        await expect(fixedElement, `${pathname} ${testId}`).toBeVisible();

        const measurement = await page.evaluate(([adTestId, controlTestId]) => {
          const ad = document.querySelector<HTMLElement>(
            `[data-testid="${adTestId}"] ins.adsbygoogle`
          );
          const control = document.querySelector<HTMLElement>(`[data-testid="${controlTestId}"]`);
          if (!ad || !control) return null;
          const adRect = ad.getBoundingClientRect();
          const controlRect = control.getBoundingClientRect();
          const clearance = document.querySelector<HTMLElement>(
            '[data-testid="footer-ad-mobile-clearance"]'
          );
          return {
            gap: controlRect.top - adRect.bottom,
            adBottom: adRect.bottom,
            controlTop: controlRect.top,
            clearanceHeight: clearance?.getBoundingClientRect().height ?? null,
            scrollY: window.scrollY,
            scrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
          };
        }, ['desktop-footer-ad', testId]);

        expect(measurement, `${pathname} ${testId}`).not.toBeNull();
        expect(measurement?.gap, `${pathname} ${testId}: ${JSON.stringify(measurement)}`)
          .toBeGreaterThanOrEqual(12);
      }
    }

    expect(hydrationErrors).toEqual([]);
  });

  test('keeps the desktop support report button clear of the footer creative', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/about');

    const creative = page.locator('[data-testid="desktop-footer-ad"] ins.adsbygoogle');
    const supportButton = page.getByTestId('global-support-report-trigger');
    await creative.scrollIntoViewIfNeeded();
    await expect(supportButton).toBeVisible();

    const horizontalGap = await page.evaluate(() => {
      const ad = document.querySelector<HTMLElement>(
        '[data-testid="desktop-footer-ad"] ins.adsbygoogle'
      );
      const support = document.querySelector<HTMLElement>(
        '[data-testid="global-support-report-trigger"]'
      );
      if (!ad || !support) return null;
      return support.getBoundingClientRect().left - ad.getBoundingClientRect().right;
    });

    expect(horizontalGap).not.toBeNull();
    expect(horizontalGap as number).toBeGreaterThanOrEqual(12);
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

  test('keeps the support login modal above and isolated from the right rail ad', async ({ page }) => {
    test.skip(!RIGHT_RAIL_RUNTIME_CONFIGURED, 'Run with a configured right rail slot.');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/help');

    await page.getByTestId('help-contact-modal-trigger').click();

    const modalBackdrop = page.getByTestId('login-modal');
    const rail = page.getByTestId('desktop-right-rail-ad');
    await expect(modalBackdrop).toBeVisible();
    await expect(rail).toHaveCount(1);

    const coverage = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[data-testid="desktop-right-rail-ad"]');
      const backdrop = document.querySelector<HTMLElement>('[data-testid="login-modal"]');
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
      backdropZIndex: 200,
      railZIndex: 'auto',
    });
  });
});
