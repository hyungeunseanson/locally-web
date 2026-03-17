'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { CommunityHubFilter, CommunityPostFormatFilter } from '@/app/types/community';
import { buildCommunityListHref } from '../queryParams';
import { usePendingNavigation } from '../hooks/usePendingNavigation';

const SORT_OPTIONS = [
    { id: 'latest' as const, label: '최신순' },
    { id: 'popular' as const, label: '인기순' },
];

interface MobileSortBarProps {
    currentHub: CommunityHubFilter;
    currentFormat: CommunityPostFormatFilter;
    currentQuery: string;
    currentSort: 'latest' | 'popular';
}

/**
 * 모바일 전용 최신순/인기순 정렬 버튼
 * MobileWidgetStrip 아래, 피드 리스트 바로 위에 렌더
 */
export default function MobileSortBar({ currentHub, currentFormat, currentQuery, currentSort }: MobileSortBarProps) {
    const { navigate, pendingHref } = usePendingNavigation();

    const handleSort = (nextSort: 'latest' | 'popular') => {
        navigate(buildCommunityListHref({
            hub: currentHub,
            format: currentFormat,
            q: currentQuery,
            sort: nextSort,
        }));
    };

    return (
        <div className="lg:hidden mb-4">
            <div className="grid grid-cols-2 gap-2 rounded-full border border-[#E7E7E7] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                {SORT_OPTIONS.map((item) => {
                    const href = buildCommunityListHref({
                        hub: currentHub,
                        format: currentFormat,
                        q: currentQuery,
                        sort: item.id,
                    });
                    const isNavigating = pendingHref === href;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSort(item.id)}
                            disabled={isNavigating}
                            aria-busy={isNavigating}
                            className={`flex h-9 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-all ${
                                currentSort === item.id
                                    ? 'bg-[#111111] text-white shadow-[0_8px_16px_rgba(15,23,42,0.14)]'
                                    : 'text-[#4B4B4B]'
                            } ${
                                isNavigating ? 'cursor-progress scale-[0.98] opacity-80' : 'active:scale-[0.98]'
                            } disabled:pointer-events-none`}
                        >
                            {isNavigating && <Loader2 size={12} className="animate-spin" />}
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
