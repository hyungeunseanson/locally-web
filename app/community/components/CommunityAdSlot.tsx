'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

import {
    buildAdSenseScriptUrl,
    resolveCommunityAdSlotConfig,
    type CommunityAdPlacement,
} from '@/app/utils/adsense';

interface CommunityAdSlotProps {
    testId: string;
    variant: 'sidebar' | 'bottom';
    placement: CommunityAdPlacement;
    title?: string;
}

const VARIANT_CLASSNAME: Record<CommunityAdSlotProps['variant'], string> = {
    sidebar: 'h-64',
    bottom: 'h-24 md:h-28',
};

declare global {
    interface Window {
        adsbygoogle?: unknown[];
    }
}

export default function CommunityAdSlot({
    testId,
    variant,
    placement,
}: CommunityAdSlotProps) {
    const adRef = useRef<HTMLModElement | null>(null);
    const { clientId, slotId, enabled } = resolveCommunityAdSlotConfig(placement);
    const shouldRenderLiveAd = enabled && Boolean(clientId) && Boolean(slotId);
    const scriptUrl = buildAdSenseScriptUrl(clientId);

    useEffect(() => {
        if (!shouldRenderLiveAd || !adRef.current) return;
        if (adRef.current.dataset.adsenseInitialized === 'true') return;

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            adRef.current.dataset.adsenseInitialized = 'true';
        } catch (error) {
            console.error(`[CommunityAdSlot] failed to initialize AdSense slot for ${placement}:`, error);
        }
    }, [placement, shouldRenderLiveAd]);

    if (!shouldRenderLiveAd || !clientId || !slotId || !scriptUrl) return null;

    return (
        <>
            <Script
                id="locally-google-adsense"
                src={scriptUrl}
                strategy="afterInteractive"
                crossOrigin="anonymous"
            />
            <div
                data-testid={testId}
                className={`overflow-hidden rounded-2xl bg-white shadow-sm ${VARIANT_CLASSNAME[variant]}`}
            >
                <ins
                    ref={adRef}
                    className="adsbygoogle block h-full w-full"
                    style={{ display: 'block' }}
                    data-ad-client={clientId}
                    data-ad-slot={slotId}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                />
            </div>
        </>
    );
}
