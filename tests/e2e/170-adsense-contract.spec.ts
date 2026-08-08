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
  ADSENSE_PUBLIC_PATH_META_NAME,
  hasMatchingCanonicalPathname,
  hasMatchingPublicAdPathname,
  hasNoIndexDirective,
  normalizeDesktopFooterAdPathname,
  requiresCanonicalMatchForDesktopFooterAd,
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
      '/community',
      '/community/post-id',
      '/ko/community/post-id/',
      '/zh/community/',
      '/experiences/experience-id',
      '/company/notices',
      '/help',
      '/privacy',
      '/search',
      '/ja/search/',
      '/services/intro',
      '/en/services/intro/',
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
      '/site-map',
      '/community/write',
      '/ko/community/write',
      '/experiences/experience-id/payment',
      '/experiences/experience-id/payment/complete',
      '/services',
      '/services/intro/extra',
      '/services/request-id',
      '/services/my',
      '/services/request',
      '/services/request-id/apply',
      '/services/request-id/payment',
      '/unknown',
      '/experiences/experience-id/unknown',
      '/users/user-id/unknown',
    ];

    for (const pathname of publicPaths) {
      expect(shouldShowDesktopFooterAd(pathname), pathname).toBeTruthy();
    }

    for (const pathname of excludedPaths) {
      expect(shouldShowDesktopFooterAd(pathname), pathname).toBeFalsy();
    }

    expect(normalizeDesktopFooterAdPathname('/en/company/notices/')).toBe('/company/notices');
  });

  test('limits the desktop right rail to the approved public content pages', () => {
    for (const pathname of [
      '/help',
      '/en/help',
      '/community',
      '/zh/community/',
      '/company/careers',
      '/company/investors',
      '/company/news',
      '/company/notices',
      '/company/partnership',
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
      '/community/post-id',
      '/community/write',
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

  test('requires a current canonical pathname on dynamic public detail routes', () => {
    for (const pathname of [
      '/community/post-id',
      '/experiences/experience-id',
      '/users/user-id',
      '/ja/community/post-id/',
    ]) {
      expect(requiresCanonicalMatchForDesktopFooterAd(pathname), pathname).toBeTruthy();
    }

    for (const pathname of ['/', '/community', '/services/intro', '/company/notices']) {
      expect(requiresCanonicalMatchForDesktopFooterAd(pathname), pathname).toBeFalsy();
    }

    expect(hasMatchingCanonicalPathname(
      '/community/current-post',
      ['https://www.locally-travel.com/community/current-post'],
    )).toBeTruthy();
    expect(hasMatchingCanonicalPathname(
      '/community/current-post',
      ['https://www.locally-travel.com/community/previous-post'],
    )).toBeFalsy();
    expect(hasMatchingCanonicalPathname(
      '/ja/experiences/current-id/',
      ['https://www.locally-travel.com/experiences/current-id?lang=ja'],
    )).toBeTruthy();
    expect(hasMatchingCanonicalPathname('/users/current-id', ['not a valid canonical'])).toBeFalsy();

    expect(ADSENSE_PUBLIC_PATH_META_NAME).toBe('locally-adsense-public-path');
    expect(hasMatchingPublicAdPathname(
      '/experiences/current-id',
      ['/experiences/current-id'],
    )).toBeTruthy();
    expect(hasMatchingPublicAdPathname(
      '/experiences/current-id',
      ['/experiences/previous-id'],
    )).toBeFalsy();
    expect(hasMatchingPublicAdPathname(
      '/ja/users/current-id/',
      ['/users/current-id'],
    )).toBeTruthy();
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
    expect(desktopAdSource).not.toContain("const DESKTOP_MEDIA_QUERY = '(min-width: 768px)'");
    expect(desktopAdSource).toContain('data-ad-format="auto"');
    expect(desktopAdSource).toContain('data-full-width-responsive="true"');
    expect(desktopAdSource).toContain('data-testid="footer-ad-mobile-clearance"');
  });

  test('keeps the right rail static, fixed-size, 1440px-only, and script-free', () => {
    const rightRailSource = fs.readFileSync(
      path.join(process.cwd(), 'app/components/DesktopRightRailAdSlot.tsx'),
      'utf8',
    );
    const eligiblePageSources = [
      'app/help/page.tsx',
      'app/community/page.tsx',
      'app/company/careers/page.tsx',
      'app/company/investors/page.tsx',
      'app/company/news/page.tsx',
      'app/company/notices/page.tsx',
      'app/company/partnership/page.tsx',
    ].map((sourcePath) => fs.readFileSync(path.join(process.cwd(), sourcePath), 'utf8'));

    expect(rightRailSource).toContain("const RIGHT_RAIL_MEDIA_QUERY = '(min-width: 1440px)'");
    expect(rightRailSource).toContain('data-testid="desktop-right-rail-ad"');
    expect(rightRailSource).toContain('className="hidden w-[300px] self-start min-[1440px]:block"');
    expect(rightRailSource).toContain('style={{ display: \'block\', width: 300, height: 600 }}');
    expect(rightRailSource).not.toContain('<Script');
    expect(rightRailSource).not.toContain('sticky');
    expect(rightRailSource).not.toContain('fixed');
    expect(rightRailSource).toContain('data-testid="desktop-right-rail-layout"');
    expect(rightRailSource).toContain('min-[1440px]:grid-cols-[minmax(0,1fr)_300px]');
    expect(rightRailSource).toContain('min-[1440px]:gap-2 min-[1440px]:pr-2');
    expect(rightRailSource).toContain('if (!layoutEnabled) return children;');
    for (const source of eligiblePageSources) {
      expect(source).toContain('<DesktopRightRailAdLayout>');
    }
  });

  test('does not render a community placeholder when its ad slot is disabled', () => {
    const communityAdSource = fs.readFileSync(
      path.join(process.cwd(), 'app/community/components/CommunityAdSlot.tsx'),
      'utf8',
    );
    const communityPageSource = fs.readFileSync(
      path.join(process.cwd(), 'app/community/page.tsx'),
      'utf8',
    );
    const communityDetailSource = fs.readFileSync(
      path.join(process.cwd(), 'app/community/[id]/page.tsx'),
      'utf8',
    );

    expect(communityAdSource).toContain(
      'if (!shouldRenderLiveAd || !clientId || !slotId || !scriptUrl) return null;',
    );
    expect(communityAdSource).not.toContain('Sponsored');
    expect(communityPageSource).not.toContain('<CommunityAdSlot');
    expect(communityPageSource).not.toContain("from './components/CommunityAdSlot'");
    expect(communityDetailSource).not.toContain('<CommunityAdSlot');
    expect(communityDetailSource).not.toContain("from '../components/CommunityAdSlot'");
  });

  test('uses only the global footer on search', () => {
    const searchSource = fs.readFileSync(
      path.join(process.cwd(), 'app/search/page.tsx'),
      'utf8',
    );

    expect(searchSource).not.toContain("import SiteFooter from '@/app/components/SiteFooter'");
    expect(searchSource).not.toContain('<SiteFooter />');
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

  test('matches ads.txt visibility to the current AdSense client configuration', async ({ request }) => {
    const response = await request.get('/ads.txt');
    const expectedEntry = buildAdsTxtEntry(process.env);

    if (expectedEntry) {
      expect(response.status()).toBe(200);
      await expect(response.text()).resolves.toContain(expectedEntry);
      return;
    }

    expect(response.status()).toBe(404);
    await expect(response.text()).resolves.toContain('Not Found');
  });
});
