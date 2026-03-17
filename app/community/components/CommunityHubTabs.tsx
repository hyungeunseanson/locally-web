'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { COMMUNITY_HUB_OPTIONS, getCommunityHubMeta } from '../hubMeta';
import { buildCommunityListHref, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '../queryParams';
import { usePendingNavigation } from '../hooks/usePendingNavigation';

export default function CommunityHubTabs() {
    const searchParams = useSearchParams();
    const currentHub = resolveCommunityHub(searchParams.get('hub'));
    const currentFormat = resolveCommunityFormat(searchParams.get('format'), searchParams.get('category'));
    const currentQuery = searchParams.get('q') || '';
    const currentSort = resolveCommunitySort(searchParams.get('sort'));
    const { navigate, pendingHref } = usePendingNavigation();

    return (
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1 no-scrollbar md:gap-3">
            {COMMUNITY_HUB_OPTIONS.map((hub) => {
                const meta = getCommunityHubMeta(hub);
                const isActive = currentHub === hub;
                const href = buildCommunityListHref({
                    hub,
                    format: currentFormat,
                    q: currentQuery,
                    sort: currentSort,
                });
                const isNavigating = pendingHref === href;

                return (
                    <button
                        key={hub}
                        type="button"
                        onClick={() => navigate(href)}
                        disabled={isNavigating}
                        aria-current={isActive ? 'page' : undefined}
                        aria-busy={isNavigating}
                        className={`min-w-[84px] rounded-[18px] border px-3 py-2.5 text-left transition-all md:min-w-[152px] md:rounded-[24px] md:px-4 md:py-4 ${
                            isActive
                                ? `bg-gradient-to-br ${meta.accentClassName} shadow-[0_12px_24px_rgba(15,23,42,0.08)]`
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        } ${
                            isNavigating
                                ? 'cursor-progress scale-[0.98] opacity-80'
                                : 'active:scale-[0.98]'
                        } relative overflow-hidden disabled:pointer-events-none`}
                    >
                        {isNavigating && (
                            <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm">
                                <Loader2 size={11} className="animate-spin" />
                            </span>
                        )}
                        <div className={`h-[10px] truncate whitespace-nowrap text-[8px] font-black uppercase tracking-[0.12em] md:h-auto md:text-[9px] md:tracking-[0.14em] ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                            {meta.eyebrow}
                        </div>
                        <div className="mt-1.5 min-h-[30px] text-[12px] font-semibold leading-[1.25] text-slate-900 md:mt-2 md:min-h-0 md:text-[18px]">
                            {meta.label}
                        </div>
                        <p className="mt-1.5 hidden text-[12px] leading-5 text-slate-500 md:block">
                            {meta.description}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}
