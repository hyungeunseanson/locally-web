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
                        whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] md:px-5 md:py-2.5 md:text-[15px] font-medium transition-all duration-200 flex-shrink-0
                        ${currentFormat === tab.id
                            ? 'border-[#D8D8D8] bg-white text-[#222222] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                            : 'border-transparent bg-transparent text-[#7A7A7A] hover:border-[#E5E5E5] hover:bg-white hover:text-[#222222]'
                        }
                    `}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
