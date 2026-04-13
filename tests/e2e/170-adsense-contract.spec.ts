import { expect, test } from '@playwright/test';

import {
  buildAdSenseScriptUrl,
  buildAdsTxtEntry,
  getAdSensePublisherId,
  isAdSenseEnabled,
  normalizeAdSenseClientId,
  resolveCommunityAdSlotConfig,
} from '@/app/utils/adsense';

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

  test('keeps ads.txt hidden by default when no AdSense client id is configured', async ({ request }) => {
    const response = await request.get('/ads.txt');

    expect(response.status()).toBe(404);
    await expect(response.text()).resolves.toContain('Not Found');
  });
});
