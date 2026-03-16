'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const SORT_OPTIONS = [
    { id: 'latest' as const, label: '최신순' },
    { id: 'popular' as const, label: '인기순' },
];

interface MobileSortBarProps {
    currentCategory: string;
    currentQuery: string;
    currentSort: 'latest' | 'popular';
}

/**
 * 모바일 전용 최신순/인기순 정렬 버튼
 * MobileWidgetStrip 아래, 피드 리스트 바로 위에 렌더
 */
export default function MobileSortBar({ currentCategory, currentQuery, currentSort }: MobileSortBarProps) {
    const router = useRouter();

    const handleSort = (nextSort: 'latest' | 'popular') => {
        const params = new URLSearchParams();
        params.set('category', currentCategory);
        if (currentQuery.trim()) params.set('q', currentQuery.trim());
        if (nextSort !== 'latest') params.set('sort', nextSort);
        router.push(`/community?${params.toString()}`);
    };

    return (
        <div className="lg:hidden mb-4">
            <div className="grid grid-cols-2 gap-2 rounded-full border border-[#E7E7E7] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                {SORT_OPTIONS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSort(item.id)}
                        className={`h-9 rounded-full text-[12px] font-semibold transition-colors ${
                            currentSort === item.id
                                ? 'bg-[#F5F5F5] text-[#222222]'
                                : 'text-[#6B6B6B]'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
