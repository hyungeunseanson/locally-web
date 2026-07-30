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
} from '@/app/utils/adsense';
import {
  hasNoIndexDirective,
  normalizeDesktopFooterAdPathname,
  shouldShowDesktopFooterAd,
} from '@/app/utils/desktopFooterAd';

test.describe('AdSense preparation contracts', () => {
  test('normalizes AdSense client ids for script and ads.txt usage', () => {
    expect(normalizeAdSenseClientId('ca-pub-1234567890')).toBe('ca-pub-1234567890');
    expect(normalizeAdSenseClientId('pub-1234567890')).toBe('ca-pub-1234567890');
    expect(getAdSensePublisherId('ca-pub-1234567890')).toBe('pub-1234567890');
    expect(buildAdSenseScriptUrl('pub-1234567890')).toContain('client=ca-pub-1234567890');
    expect(buildAdsTxtEntry({
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
    })).toBe('google.com, pub-1234567890, DIRECT, f08c47fec0942fa0');
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
  });

  test('shows the desktop footer ad only on public, non-transactional routes', () => {
    const publicPaths = [
      '/',
      '/en',
      '/experiences/experience-id',
      '/company/notices',
      '/services/intro',
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

  test('suppresses ads when page metadata marks the screen as noindex', () => {
    expect(hasNoIndexDirective([])).toBeFalsy();
    expect(hasNoIndexDirective(['index, follow'])).toBeFalsy();
    expect(hasNoIndexDirective(['NOINDEX, nofollow'])).toBeTruthy();
    expect(hasNoIndexDirective([null, 'max-image-preview:large', 'noindex'])).toBeTruthy();
  });

  test('places one server-configured desktop ad directly after the global footer', () => {
    const layoutSource = fs.readFileSync(path.join(process.cwd(), 'app/layout.tsx'), 'utf8');
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
  });

  test('keeps ads.txt hidden by default when no AdSense client id is configured', async ({ request }) => {
    const response = await request.get('/ads.txt');

    expect(response.status()).toBe(404);
    await expect(response.text()).resolves.toContain('Not Found');
  });
});
