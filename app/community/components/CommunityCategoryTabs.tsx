'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { COMMUNITY_FORMAT_FILTER_OPTIONS } from '../categoryMeta';
import { buildCommunityListHref, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '../queryParams';

export default function CommunityCategoryTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentHub = resolveCommunityHub(searchParams.get('hub'));
    const currentFormat = resolveCommunityFormat(searchParams.get('format'), searchParams.get('category'));
    const currentQuery = searchParams.get('q') || '';
    const currentSort = resolveCommunitySort(searchParams.get('sort'));

    const handleTabClick = (id: string) => {
        router.push(buildCommunityListHref({
            hub: currentHub,
            format: id as typeof currentFormat,
            q: currentQuery,
            sort: currentSort,
        }));
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {COMMUNITY_FORMAT_FILTER_OPTIONS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`
                        whitespace-nowrap rounded-2xl border px-3.5 py-2 text-[12px] md:px-5 md:py-3 md:text-[15px] font-semibold transition-all duration-200 flex-shrink-0
                        ${currentFormat === tab.id
                            ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }
                    `}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
