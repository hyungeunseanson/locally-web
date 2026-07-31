'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  buildSanitizedGoogleAnalyticsLocation,
  initializeGoogleAnalytics,
  isGoogleAnalyticsConsentGranted,
  isGoogleAnalyticsPathAllowed,
  sendGoogleAnalyticsEvent,
} from '@/app/utils/analytics/google';

type GoogleAnalyticsGateProps = {
  enabled: boolean;
  measurementId: string | null;
  cmpScriptUrl: string | null;
  allowedHostname: string | null;
};

export default function GoogleAnalyticsGate({
  enabled,
  measurementId,
  cmpScriptUrl,
  allowedHostname,
}: GoogleAnalyticsGateProps) {
  const pathname = usePathname();
  const [consentGranted, setConsentGranted] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const lastPageViewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !measurementId || !cmpScriptUrl || !allowedHostname) return;
    if (window.location.hostname.toLowerCase() !== allowedHostname) return;

    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];

    const evaluateConsent = () => {
      const values = window.googlefc?.getGoogleConsentModeValues?.();
      const statusEnum = window.googlefc?.ConsentModePurposeStatusEnum;
      const granted = isGoogleAnalyticsConsentGranted(values, statusEnum);
      const wasGranted = window.__locallyGoogleAnalyticsConsentGranted === true;

      if (wasGranted && !granted) {
        window.__locallyGoogleAnalyticsConsentGranted = false;
        window.gtag?.('consent', 'update', {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        });
        window.location.reload();
        return;
      }

      window.__locallyGoogleAnalyticsConsentGranted = granted;
      setConsentGranted(granted);
    };

    window.googlefc.callbackQueue.push({
      CONSENT_MODE_DATA_READY: evaluateConsent,
    });

    evaluateConsent();

    window.addEventListener('focus', evaluateConsent);
    document.addEventListener('visibilitychange', evaluateConsent);

    return () => {
      window.removeEventListener('focus', evaluateConsent);
      document.removeEventListener('visibilitychange', evaluateConsent);
    };
  }, [allowedHostname, cmpScriptUrl, enabled, measurementId]);

  useEffect(() => {
    if (!analyticsReady || !isGoogleAnalyticsPathAllowed(pathname)) return;

    const pageLocation = buildSanitizedGoogleAnalyticsLocation(
      window.location.origin,
      pathname,
    );
    if (!pageLocation || lastPageViewRef.current === pageLocation) return;

    lastPageViewRef.current = pageLocation;
    sendGoogleAnalyticsEvent('page_view', {
      page_location: pageLocation,
      page_path: pathname,
      page_title: document.title,
    });
  }, [analyticsReady, pathname]);

  if (!enabled || !measurementId || !cmpScriptUrl || !allowedHostname) return null;

  return (
    <>
      <Script
        id="locally-google-cmp"
        src={cmpScriptUrl}
        strategy="afterInteractive"
      />
      {consentGranted && (
        <Script
          id="locally-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onLoad={() => {
            if (initializeGoogleAnalytics(measurementId)) {
              setAnalyticsReady(true);
            }
          }}
        />
      )}
    </>
  );
}
