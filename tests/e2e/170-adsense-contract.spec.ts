import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  buildAdSenseScriptUrl,
  buildAdsTxtEntry,
  getAdSensePublisherId,
  isAdSenseEnabled,
  normalizeAdSenseClientId,
  resolveCommunityAdSlotConfig,
  resolveDesktopFooterAdSlotConfig,
  resolveDesktopRightRailAdSlotConfig,
} from '@/app/utils/adsense';
import {
  hasNoIndexDirective,
  normalizeDesktopFooterAdPathname,
  shouldShowDesktopFooterAd,
  shouldShowDesktopRightRailAd,
} from '@/app/utils/desktopFooterAd';
import { getLegalDocument } from '@/app/constants/legalDocuments';

test.describe('AdSense preparation contracts', () => {
  test('normalizes AdSense client ids for script and ads.txt usage', () => {
    expect(normalizeAdSenseClientId('ca-pub-1234567890')).toBe('ca-pub-1234567890');
    expect(normalizeAdSenseClientId('pub-1234567890')).toBe('ca-pub-1234567890');
    expect(getAdSensePublisherId('ca-pub-1234567890')).toBe('pub-1234567890');
    expect(buildAdSenseScriptUrl('pub-1234567890')).toContain('client=ca-pub-1234567890');
    expect(buildAdsTxtEntry({
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
    })).toBe('google.com, pub-1234567890, DIRECT, f08c47fec0942fa0');
    expect(normalizeAdSenseClientId('publisher-1234567890')).toBeNull();
    expect(normalizeAdSenseClientId('ca-pub-not-numeric')).toBeNull();
    expect(buildAdSenseScriptUrl('invalid-client')).toBeNull();
    expect(buildAdsTxtEntry({
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'invalid-client',
    })).toBeNull();
  });

  test('keeps AdSense globally disabled unless the toggle and client id are both configured', () => {
    expect(isAdSenseEnabled({})).toBeFalsy();
    expect(isAdSenseEnabled({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
    })).toBeFalsy();
    expect(isAdSenseEnabled({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'false',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
    })).toBeFalsy();
    expect(isAdSenseEnabled({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
    })).toBeTruthy();
  });

  test('fails safe per placement when a slot id is missing', () => {
    const enabledSidebar = resolveCommunityAdSlotConfig('community-list-sidebar', {
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT: '1111111111',
    });

    const disabledBottom = resolveCommunityAdSlotConfig('community-list-bottom', {
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT: '1111111111',
    });

    expect(enabledSidebar).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: '1111111111',
      globallyEnabled: true,
      enabled: true,
    });
    expect(disabledBottom).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: null,
      globallyEnabled: true,
      enabled: false,
    });
  });

  test('enables the desktop footer slot only when toggle, client id, and slot id exist', () => {
    expect(resolveDesktopFooterAdSlotConfig({})).toEqual({
      clientId: null,
      slotId: null,
      globallyEnabled: false,
      enabled: false,
    });

    expect(resolveDesktopFooterAdSlotConfig({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
    })).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: null,
      globallyEnabled: true,
      enabled: false,
    });

    expect(resolveDesktopFooterAdSlotConfig({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT: '2222222222',
    })).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: '2222222222',
      globallyEnabled: true,
      enabled: true,
    });

    expect(resolveDesktopFooterAdSlotConfig({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT: 'footer-slot',
    })).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: null,
      globallyEnabled: true,
      enabled: false,
    });
  });

  test('enables the desktop right rail only with a numeric dedicated slot id', () => {
    expect(resolveDesktopRightRailAdSlotConfig({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT: '3333333333',
    })).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: '3333333333',
      globallyEnabled: true,
      enabled: true,
    });

    expect(resolveDesktopRightRailAdSlotConfig({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT: 'right-rail',
    })).toEqual({
      clientId: 'ca-pub-1234567890',
      slotId: null,
      globallyEnabled: true,
      enabled: false,
    });
  });

  test('shows the desktop footer ad only on public, non-transactional routes', () => {
    const publicPaths = [
      '/',
      '/en',
      '/about',
      '/experiences/experience-id',
      '/company/notices',
      '/help',
      '/become-a-host',
      '/users/user-id',
    ];
    const excludedPaths = [
      '/admin/dashboard',
      '/login',
      '/account',
      '/guest/trips',
      '/host/dashboard',
      '/notifications',
      '/payment/success',
      '/proxy-bookings/new',
      '/search',
      '/ja/search/',
      '/site-map',
      '/community',
      '/zh/community/post-id',
      '/community/write',
      '/ko/community/write',
      '/experiences/experience-id/payment',
      '/experiences/experience-id/payment/complete',
      '/services',
      '/services/intro',
      '/services/request-id',
      '/services/my',
      '/services/request',
      '/services/request-id/apply',
      '/services/request-id/payment',
      '/unknown',
    ];

    for (const pathname of publicPaths) {
      expect(shouldShowDesktopFooterAd(pathname), pathname).toBeTruthy();
    }

    for (const pathname of excludedPaths) {
      expect(shouldShowDesktopFooterAd(pathname), pathname).toBeFalsy();
    }

    expect(normalizeDesktopFooterAdPathname('/en/company/notices/')).toBe('/company/notices');
  });

  test('limits the desktop right rail to help and notices', () => {
    for (const pathname of [
      '/help',
      '/en/help',
      '/company/notices',
      '/ja/company/notices/',
    ]) {
      expect(shouldShowDesktopRightRailAd(pathname), pathname).toBeTruthy();
    }

    for (const pathname of [
      '/',
      '/about',
      '/become-a-host',
      '/experiences/experience-id',
      '/users/user-id',
      '/guest/inbox',
      '/guest/trips',
      '/guest/wishlists',
      '/account',
      '/host/dashboard',
      '/company/news',
    ]) {
      expect(shouldShowDesktopRightRailAd(pathname), pathname).toBeFalsy();
    }
  });

  test('suppresses ads when page metadata marks the screen as noindex', () => {
    expect(hasNoIndexDirective([])).toBeFalsy();
    expect(hasNoIndexDirective(['index, follow'])).toBeFalsy();
    expect(hasNoIndexDirective(['NOINDEX, nofollow'])).toBeTruthy();
    expect(hasNoIndexDirective([null, 'max-image-preview:large', 'noindex'])).toBeTruthy();
  });

  test('places one server-configured desktop ad directly after the global footer', () => {
    const layoutSource = fs.readFileSync(path.join(process.cwd(), 'app/layout.tsx'), 'utf8');
    const desktopAdSource = fs.readFileSync(
      path.join(process.cwd(), 'app/components/DesktopFooterAdSlot.tsx'),
      'utf8',
    );
    const siteFooterIndex = layoutSource.indexOf('<SiteFooter />');
    const desktopAdIndex = layoutSource.indexOf('<DesktopFooterAdSlot');
    const bottomNavigationIndex = layoutSource.indexOf('<BottomTabNavigation />');

    expect(siteFooterIndex).toBeGreaterThan(-1);
    expect(desktopAdIndex).toBeGreaterThan(siteFooterIndex);
    expect(bottomNavigationIndex).toBeGreaterThan(desktopAdIndex);
    expect(layoutSource.match(/<DesktopFooterAdSlot/g)).toHaveLength(1);
    expect(layoutSource).toContain('resolveDesktopFooterAdSlotConfig(process.env)');
    expect(layoutSource).toContain('clientId={desktopFooterAdConfig.clientId}');
    expect(layoutSource).toContain('slotId={desktopFooterAdConfig.slotId}');
    expect(layoutSource).toContain('enabled={desktopFooterAdConfig.enabled}');
    expect(layoutSource).not.toContain('id="locally-google-adsense"');
    expect(desktopAdSource).toContain('id="locally-google-adsense"');
    expect(desktopAdSource).toContain('buildAdSenseScriptUrl(clientId)');
  });

  test('keeps the right rail static, fixed-size, wide-desktop-only, and script-free', () => {
    const rightRailSource = fs.readFileSync(
      path.join(process.cwd(), 'app/components/DesktopRightRailAdSlot.tsx'),
      'utf8',
    );
    const helpSource = fs.readFileSync(path.join(process.cwd(), 'app/help/page.tsx'), 'utf8');
    const noticesSource = fs.readFileSync(
      path.join(process.cwd(), 'app/company/notices/page.tsx'),
      'utf8',
    );

    expect(rightRailSource).toContain("const RIGHT_RAIL_MEDIA_QUERY = '(min-width: 1536px)'");
    expect(rightRailSource).toContain('data-testid="desktop-right-rail-ad"');
    expect(rightRailSource).toContain('className="hidden w-[300px] self-start 2xl:block"');
    expect(rightRailSource).toContain('style={{ display: \'block\', width: 300, height: 600 }}');
    expect(rightRailSource).not.toContain('<Script');
    expect(rightRailSource).not.toContain('sticky');
    expect(rightRailSource).not.toContain('fixed');
    expect(rightRailSource).toContain('data-testid="desktop-right-rail-layout"');
    expect(rightRailSource).toContain('2xl:grid-cols-[minmax(0,1040px)_300px] 2xl:gap-8');
    expect(rightRailSource).toContain('if (!layoutEnabled) return children;');
    expect(helpSource).toContain('<DesktopRightRailAdLayout>');
    expect(noticesSource).toContain('<DesktopRightRailAdLayout>');
  });

  test('does not render a community placeholder when its ad slot is disabled', () => {
    const communityAdSource = fs.readFileSync(
      path.join(process.cwd(), 'app/community/components/CommunityAdSlot.tsx'),
      'utf8',
    );

    expect(communityAdSource).toContain(
      'if (!shouldRenderLiveAd || !clientId || !slotId || !scriptUrl) return null;',
    );
    expect(communityAdSource).not.toContain('Sponsored');
  });

  test('publishes a localized privacy page with the required Google advertising disclosure', async ({ request }) => {
    for (const locale of ['ko', 'en', 'ja', 'zh'] as const) {
      const document = getLegalDocument(locale, 'privacy');

      expect(document.body).toContain('https://adssettings.google.com/');
      expect(document.body).toContain('https://policies.google.com/privacy');
    }

    const response = await request.get('/privacy');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('data-testid="privacy-policy-body"');
    expect(body).toContain('https://adssettings.google.com/');
    expect(body).toContain('https://policies.google.com/privacy');
  });

  test('keeps ads.txt hidden by default when no AdSense client id is configured', async ({ request }) => {
    const response = await request.get('/ads.txt');

    expect(response.status()).toBe(404);
    await expect(response.text()).resolves.toContain('Not Found');
  });
});
