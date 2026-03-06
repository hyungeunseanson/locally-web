'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const tabs = [
    { id: 'qna', label: '💡 Q&A' },
    { id: 'companion', label: '🤝 동행 찾기' },
    { id: 'info', label: '🗺️ 현지 꿀팁' },
    { id: 'locally_content', label: '✨ 로컬리 콘텐츠' },
];

export default function CommunityCategoryTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentCategory = searchParams.get('category') || 'qna';
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
                        whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] md:px-5 md:py-2.5 md:text-[15px] font-medium transition-all duration-200 flex-shrink-0
                        ${currentCategory === tab.id
                            ? 'bg-black text-white shadow-sm scale-[1.02]'
                            : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                        }
                    `}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
