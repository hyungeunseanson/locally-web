'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import {
  hasNoIndexDirective,
  shouldShowDesktopFooterAd,
} from '@/app/utils/desktopFooterAd';

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

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
  const [isDesktop, setIsDesktop] = useState(false);
  const [pageEligibility, setPageEligibility] = useState<{
    pathname: string | null;
    eligible: boolean;
  }>({ pathname: null, eligible: false });
  const pageHasEligibleMetadata =
    pageEligibility.pathname === pathname && pageEligibility.eligible;
  const shouldRender =
    enabled &&
    isDesktop &&
    pageHasEligibleMetadata &&
    shouldShowDesktopFooterAd(pathname);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const updateViewport = () => setIsDesktop(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);

    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    const updateEligibility = () => {
      const robotsMetaContents = Array.from(
        document.head.querySelectorAll<HTMLMetaElement>(
          'meta[name="robots"], meta[name="googlebot"]'
        )
      ).map((meta) => meta.content);

      setPageEligibility({
        pathname,
        eligible: !hasNoIndexDirective(robotsMetaContents),
      });
    };

    updateEligibility();

    const observer = new MutationObserver(updateEligibility);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content'],
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

  if (!shouldRender || !clientId || !slotId) return null;

  return (
    <aside
      aria-label="Advertisement"
      data-testid="desktop-footer-ad"
      className="hidden min-h-[100px] w-full border-t border-gray-100 bg-white px-6 py-1 md:block"
    >
      <div className="mx-auto min-h-[90px] w-full max-w-[1280px]">
        <ins
          ref={adRef}
          className="adsbygoogle block min-h-[90px] w-full"
          style={{ display: 'block' }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="horizontal"
          data-full-width-responsive="false"
        />
      </div>
    </aside>
  );
}
