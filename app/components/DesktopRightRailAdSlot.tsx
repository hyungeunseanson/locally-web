'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolveDesktopRightRailAdSlotConfig } from '@/app/utils/adsense';
import {
  hasNoIndexDirective,
  shouldShowDesktopRightRailAd,
} from '@/app/utils/desktopFooterAd';

const RIGHT_RAIL_MEDIA_QUERY = '(min-width: 1440px)';

const rightRailConfig = resolveDesktopRightRailAdSlotConfig({
  NEXT_PUBLIC_ADSENSE_ENABLED: process.env.NEXT_PUBLIC_ADSENSE_ENABLED,
  NEXT_PUBLIC_ADSENSE_CLIENT_ID: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT:
    process.env.NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT,
});

export function DesktopRightRailAdLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const layoutEnabled =
    rightRailConfig.enabled && shouldShowDesktopRightRailAd(pathname);

  if (!layoutEnabled) return children;

  return (
    <div
      data-testid="desktop-right-rail-layout"
      className="w-full min-[1440px]:grid min-[1440px]:grid-cols-[minmax(0,1fr)_300px] min-[1440px]:gap-2 min-[1440px]:pr-2"
    >
      {children}
      <div className="hidden pt-24 min-[1440px]:block">
        <DesktopRightRailAdSlot />
      </div>
    </div>
  );
}

export default function DesktopRightRailAdSlot() {
  const pathname = usePathname();
  const adRef = useRef<HTMLModElement | null>(null);
  const [isWideDesktop, setIsWideDesktop] = useState(false);
  const [pageEligibility, setPageEligibility] = useState<{
    pathname: string | null;
    eligible: boolean;
  }>({ pathname: null, eligible: false });
  const shouldRender =
    rightRailConfig.enabled &&
    isWideDesktop &&
    pageEligibility.pathname === pathname &&
    pageEligibility.eligible &&
    shouldShowDesktopRightRailAd(pathname);

  useEffect(() => {
    const mediaQuery = window.matchMedia(RIGHT_RAIL_MEDIA_QUERY);
    const updateViewport = () => setIsWideDesktop(mediaQuery.matches);

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
      console.error('[DesktopRightRailAdSlot] failed to initialize AdSense slot:', error);
    }
  }, [shouldRender]);

  if (
    !shouldRender ||
    !rightRailConfig.clientId ||
    !rightRailConfig.slotId
  ) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      data-testid="desktop-right-rail-ad"
      className="hidden w-[300px] self-start min-[1440px]:block"
    >
      <ins
        ref={adRef}
        className="adsbygoogle block h-[600px] w-[300px]"
        style={{ display: 'block', width: 300, height: 600 }}
        data-ad-client={rightRailConfig.clientId}
        data-ad-slot={rightRailConfig.slotId}
        data-full-width-responsive="false"
      />
    </aside>
  );
}
