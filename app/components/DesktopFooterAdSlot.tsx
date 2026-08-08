'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

import { buildAdSenseScriptUrl } from '@/app/utils/adsense';
import {
  hasMatchingCanonicalPathname,
  hasNoIndexDirective,
  normalizeDesktopFooterAdPathname,
  requiresCanonicalMatchForDesktopFooterAd,
  shouldShowDesktopFooterAd,
} from '@/app/utils/desktopFooterAd';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface DesktopFooterAdSlotProps {
  clientId: string | null;
  slotId: string | null;
  enabled: boolean;
}

export default function DesktopFooterAdSlot({
  clientId,
  slotId,
  enabled,
}: DesktopFooterAdSlotProps) {
  const pathname = usePathname();
  const adRef = useRef<HTMLModElement | null>(null);
  const [pageEligibility, setPageEligibility] = useState<{
    pathname: string | null;
    eligible: boolean;
  }>({ pathname: null, eligible: false });
  const pageHasEligibleMetadata =
    pageEligibility.pathname === pathname && pageEligibility.eligible;
  const shouldRender =
    enabled &&
    pageHasEligibleMetadata &&
    shouldShowDesktopFooterAd(pathname);
  const scriptUrl = buildAdSenseScriptUrl(clientId);
  const normalizedPathname = normalizeDesktopFooterAdPathname(pathname || '/');
  const mobileClearance = normalizedPathname.startsWith('/community')
    ? 200
    : normalizedPathname === '/services/intro'
      ? 176
      : normalizedPathname === '/help'
        ? 88
        : 152;
  const shouldReserveDesktopSupportSpace = normalizedPathname !== '/help';

  useEffect(() => {
    const updateEligibility = () => {
      const robotsMetaContents = Array.from(
        document.head.querySelectorAll<HTMLMetaElement>(
          'meta[name="robots"], meta[name="googlebot"]'
        )
      ).map((meta) => meta.content);
      const canonicalHrefs = Array.from(
        document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')
      ).map((link) => link.href);
      const requiresCanonicalMatch = requiresCanonicalMatchForDesktopFooterAd(pathname);

      setPageEligibility({
        pathname,
        eligible:
          !hasNoIndexDirective(robotsMetaContents) &&
          (!requiresCanonicalMatch || hasMatchingCanonicalPathname(pathname, canonicalHrefs)),
      });
    };

    updateEligibility();

    const observer = new MutationObserver(updateEligibility);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'href'],
    });

    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!shouldRender || !adRef.current) return;
    if (adRef.current.dataset.adsenseInitialized === 'true') return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      adRef.current.dataset.adsenseInitialized = 'true';
    } catch (error) {
      console.error('[DesktopFooterAdSlot] failed to initialize AdSense slot:', error);
    }
  }, [shouldRender]);

  if (!shouldRender || !clientId || !slotId || !scriptUrl) return null;

  return (
    <>
      <Script
        id="locally-google-adsense"
        src={scriptUrl}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <aside
        aria-label="Advertisement"
        data-testid="desktop-footer-ad"
        className="min-h-[100px] w-full border-t border-gray-100 bg-white px-3 pt-1 md:px-6"
      >
        <div
          className={
            shouldReserveDesktopSupportSpace
              ? 'mx-auto min-h-[90px] w-full md:ml-auto md:mr-[196px] md:w-[calc(100%_-_220px)] md:max-w-[1280px]'
              : 'mx-auto min-h-[90px] w-full max-w-[1280px]'
          }
        >
          <ins
            ref={adRef}
            className="adsbygoogle block min-h-[90px] w-full"
            style={{ display: 'block' }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
        <div
          aria-hidden="true"
          className="md:hidden"
          data-testid="footer-ad-mobile-clearance"
          style={{
            height: `calc(${mobileClearance}px + env(safe-area-inset-bottom, 0px))`,
          }}
        />
      </aside>
    </>
  );
}
