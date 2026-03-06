'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const tabs = [
    { id: 'all', label: '전체보기' },
    { id: 'qna', label: '💡 Q&A' },
    { id: 'companion', label: '🤝 동행 찾기' },
    { id: 'info', label: '🗺️ 현지 꿀팁' },
    { id: 'locally_content', label: '✨ 로컬리 콘텐츠' },
];

export default function CommunityCategoryTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentCategory = searchParams.get('category') || 'all';
    const currentQuery = searchParams.get('q') || '';
    const currentSort = searchParams.get('sort') || 'latest';

    const handleTabClick = (id: string) => {
        const params = new URLSearchParams();
        params.set('category', id);
        if (currentQuery.trim()) params.set('q', currentQuery.trim());
        if (currentSort !== 'latest') params.set('sort', currentSort);
        router.push(`/community?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`
                        whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] md:px-5 md:py-2.5 md:text-[15px] font-medium transition-all duration-200 flex-shrink-0
                        ${currentCategory === tab.id
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
