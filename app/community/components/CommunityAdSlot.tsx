'use client';

import { useEffect, useRef } from 'react';

import {
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
    title = '광고 영역',
}: CommunityAdSlotProps) {
    const adRef = useRef<HTMLModElement | null>(null);
    const { clientId, slotId, enabled } = resolveCommunityAdSlotConfig(placement);
    const shouldRenderLiveAd = enabled && Boolean(clientId) && Boolean(slotId);

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

    if (shouldRenderLiveAd && clientId && slotId) {
        return (
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
        );
    }

    return (
        <div
            data-testid={testId}
            className={`flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center shadow-sm ${VARIANT_CLASSNAME[variant]}`}
        >
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                    Sponsored
                </div>
                <div className="mt-1 text-[12px] font-semibold text-gray-500 md:text-[13px]">
                    {title}
                </div>
            </div>
        </div>
    );
}
