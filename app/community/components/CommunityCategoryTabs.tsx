'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CommunityCategoryTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentCategory = searchParams.get('category') || 'qna';

    const tabs = [
        { id: 'qna', label: '💡 Q&A' },
        { id: 'companion', label: '🤝 동행 찾기' },
        { id: 'info', label: '🗺️ 현지 꿀팁' }
    ];

    const handleTabClick = (id: string) => {
        router.push(`/community?category=${id}`);
    };

    return (
        <div className="flex items-center gap-4 mb-4 mt-2 border-b border-gray-100 pb-0 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`whitespace-nowrap px-2 pb-3 text-[15px] font-bold transition-colors relative ${currentCategory === tab.id
                            ? 'text-gray-900 border-b-2 border-gray-900'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
