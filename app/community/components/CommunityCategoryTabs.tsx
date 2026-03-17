'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { COMMUNITY_FORMAT_FILTER_OPTIONS } from '../categoryMeta';
import { buildCommunityListHref, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '../queryParams';
import { usePendingNavigation } from '../hooks/usePendingNavigation';

export default function CommunityCategoryTabs() {
    const searchParams = useSearchParams();
    const currentHub = resolveCommunityHub(searchParams.get('hub'));
    const currentFormat = resolveCommunityFormat(searchParams.get('format'), searchParams.get('category'));
    const currentQuery = searchParams.get('q') || '';
    const currentSort = resolveCommunitySort(searchParams.get('sort'));
    const { navigate, pendingHref } = usePendingNavigation();

    const handleTabClick = (id: string) => {
        navigate(buildCommunityListHref({
            hub: currentHub,
            format: id as typeof currentFormat,
            q: currentQuery,
            sort: currentSort,
        }));
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {COMMUNITY_FORMAT_FILTER_OPTIONS.map((tab) => {
                const href = buildCommunityListHref({
                    hub: currentHub,
                    format: tab.id as typeof currentFormat,
                    q: currentQuery,
                    sort: currentSort,
                });
                const isNavigating = pendingHref === href;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleTabClick(tab.id)}
                        disabled={isNavigating}
                        aria-busy={isNavigating}
                        className={`
                            flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border px-3.5 py-2 text-[12px] font-semibold transition-all duration-200 md:px-5 md:py-3 md:text-[15px]
                            ${currentFormat === tab.id
                                ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]'
                                : 'border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:text-slate-900'
                            }
                            ${isNavigating ? 'cursor-progress scale-[0.98] opacity-80' : 'active:scale-[0.98]'}
                            disabled:pointer-events-none
                        `}
                    >
                        {isNavigating && <Loader2 size={13} className="animate-spin" />}
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
