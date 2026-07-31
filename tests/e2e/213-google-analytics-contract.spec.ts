import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  buildGoogleAnalyticsAdminUrl,
  buildSanitizedGoogleAnalyticsLocation,
  isGoogleAnalyticsConsentGranted,
  isGoogleAnalyticsPathAllowed,
  normalizeGoogleAnalyticsAccountId,
  normalizeGoogleAnalyticsMeasurementId,
  normalizeGoogleAnalyticsPropertyId,
  normalizeGoogleAnalyticsSearchTerm,
  normalizeGoogleCmpScriptUrl,
  resolveGoogleAnalyticsConfig,
} from '@/app/utils/analytics/google';
import { getLegalDocument } from '@/app/constants/legalDocuments';

test.describe('Google Analytics privacy-first contracts', () => {
  test('fails closed until every production setting is valid', () => {
    expect(resolveGoogleAnalyticsConfig({}).enabled).toBeFalsy();
    expect(resolveGoogleAnalyticsConfig({
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ENABLED: 'true',
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: 'G-ABC123',
      NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com',
    }).enabled).toBeFalsy();

    expect(resolveGoogleAnalyticsConfig({
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ENABLED: 'true',
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: 'G-ABC123',
      NEXT_PUBLIC_GOOGLE_CMP_SCRIPT_URL:
        'https://fundingchoicesmessages.google.com/i/pub-1234567890?ers=1',
      NEXT_PUBLIC_SITE_URL: 'https://locally-web.vercel.app',
    }).enabled).toBeFalsy();

    expect(resolveGoogleAnalyticsConfig({
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ENABLED: 'true',
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: 'G-ABC123',
      NEXT_PUBLIC_GOOGLE_ANALYTICS_PROPERTY_ID: 'p485388343',
      NEXT_PUBLIC_GOOGLE_CMP_SCRIPT_URL:
        'https://fundingchoicesmessages.google.com/i/pub-1234567890?ers=1',
      NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com',
    })).toEqual({
      enabled: true,
      measurementId: 'G-ABC123',
      propertyId: '485388343',
      cmpScriptUrl: 'https://fundingchoicesmessages.google.com/i/pub-1234567890?ers=1',
      allowedHostname: 'www.locally-travel.com',
    });
  });

  test('validates Google identifiers, CMP origin, and dashboard links', () => {
    expect(normalizeGoogleAnalyticsMeasurementId(' g-abc123 ')).toBe('G-ABC123');
    expect(normalizeGoogleAnalyticsMeasurementId('UA-123')).toBeNull();
    expect(normalizeGoogleAnalyticsPropertyId('p485388343')).toBe('485388343');
    expect(normalizeGoogleAnalyticsPropertyId('property-id')).toBeNull();
    expect(normalizeGoogleAnalyticsAccountId('a351953719')).toBe('351953719');
    expect(normalizeGoogleAnalyticsAccountId('account-id')).toBeNull();
    expect(normalizeGoogleCmpScriptUrl(
      'https://fundingchoicesmessages.google.com/i/pub-1234567890?ers=1',
    )).toBe('https://fundingchoicesmessages.google.com/i/pub-1234567890?ers=1');
    expect(normalizeGoogleCmpScriptUrl('https://example.com/i/pub-123')).toBeNull();
    expect(buildGoogleAnalyticsAdminUrl('p485388343')).toContain('/p485388343/');
    expect(buildGoogleAnalyticsAdminUrl('485388343', '351953719')).toContain(
      '/a351953719p485388343/',
    );
  });

  test('unblocks analytics only for granted or not-applicable consent', () => {
    const statusEnum = {
      CONSENT_MODE_PURPOSE_STATUS_GRANTED: 1,
      CONSENT_MODE_PURPOSE_STATUS_NOT_APPLICABLE: 4,
    };

    expect(isGoogleAnalyticsConsentGranted(
      { analyticsStoragePurposeConsentStatus: 1 },
      statusEnum,
    )).toBeTruthy();
    expect(isGoogleAnalyticsConsentGranted(
      { analyticsStoragePurposeConsentStatus: 4 },
      statusEnum,
    )).toBeTruthy();
    expect(isGoogleAnalyticsConsentGranted(
      { analyticsStoragePurposeConsentStatus: 2 },
      statusEnum,
    )).toBeFalsy();
    expect(isGoogleAnalyticsConsentGranted(null, statusEnum)).toBeFalsy();
  });

  test('removes query data and excludes administrative or callback paths', () => {
    expect(buildSanitizedGoogleAnalyticsLocation(
      'https://www.locally-travel.com',
      '/experiences/exp/payment/complete',
    )).toBe('https://www.locally-travel.com/experiences/exp/payment/complete');

    expect(isGoogleAnalyticsPathAllowed('/experiences/exp')).toBeTruthy();
    expect(isGoogleAnalyticsPathAllowed('/admin/dashboard')).toBeFalsy();
    expect(isGoogleAnalyticsPathAllowed('/auth/callback')).toBeFalsy();
    expect(isGoogleAnalyticsPathAllowed('/api/payments')).toBeFalsy();
  });

  test('never forwards free-form search text to Google Analytics', () => {
    expect(normalizeGoogleAnalyticsSearchTerm('제주')).toBe('jeju');
    expect(normalizeGoogleAnalyticsSearchTerm('Tokyo')).toBe('tokyo');
    expect(normalizeGoogleAnalyticsSearchTerm('locallytest@naver.com')).toBe('other');
    expect(normalizeGoogleAnalyticsSearchTerm('홍길동 전화번호')).toBe('other');
  });

  test('discloses consent-gated Google Analytics use in every supported language', () => {
    for (const locale of ['ko', 'en', 'ja', 'zh'] as const) {
      const document = getLegalDocument(locale, 'privacy');
      expect(document.body).toContain('Google Analytics');
    }
  });

  test('keeps Google Analytics disabled in the default local runtime', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('script#locally-google-analytics')).toHaveCount(0);
    await expect(page.locator('script#locally-google-cmp')).toHaveCount(0);
  });

  test('wires only the experience funnel and keeps existing analytics intact', () => {
    const root = process.cwd();
    const layoutSource = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');
    const gateSource = fs.readFileSync(
      path.join(root, 'app/components/GoogleAnalyticsGate.tsx'),
      'utf8',
    );
    const detailSource = fs.readFileSync(
      path.join(root, 'app/experiences/[id]/ExperienceClient.tsx'),
      'utf8',
    );
    const paymentSource = fs.readFileSync(
      path.join(root, 'app/experiences/[id]/payment/page.tsx'),
      'utf8',
    );
    const completeSource = fs.readFileSync(
      path.join(root, 'app/experiences/[id]/payment/complete/page.tsx'),
      'utf8',
    );

    expect(layoutSource).toContain('<GoogleAnalyticsGate');
    expect(gateSource).toContain('CONSENT_MODE_DATA_READY');
    expect(gateSource).toContain('isGoogleAnalyticsConsentGranted');
    expect(gateSource).toContain('buildSanitizedGoogleAnalyticsLocation');
    expect(detailSource).toContain("sendGoogleAnalyticsEvent('view_item'");
    expect(detailSource).toContain("sendGoogleAnalyticsEvent('select_item'");
    expect(paymentSource).toContain("sendGoogleAnalyticsEvent('begin_checkout'");
    expect(completeSource).toContain('sendGoogleAnalyticsPurchase({');

    expect(fs.readFileSync(
      path.join(root, 'app/services/request/page.tsx'),
      'utf8',
    )).not.toContain('sendGoogleAnalyticsEvent');
  });

  test('adds safe external links to the protected admin analytics screen', () => {
    const analyticsTabSource = fs.readFileSync(
      path.join(process.cwd(), 'app/admin/dashboard/components/AnalyticsTab.tsx'),
      'utf8',
    );

    expect(analyticsTabSource).toContain('admin-vercel-analytics-link');
    expect(analyticsTabSource).toContain('admin-google-analytics-link');
    expect(analyticsTabSource).toContain('target="_blank"');
    expect(analyticsTabSource).toContain('rel="noopener noreferrer"');
    expect(analyticsTabSource).toContain(
      'https://vercel.com/locallys-projects-b062321b/locally-web/analytics',
    );
  });
});
