'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { CommunityCategory } from '@/app/types/community';

type SortOption = 'latest' | 'popular';

interface CommunitySearchControlsProps {
    currentCategory: CommunityCategory;
    currentQuery: string;
    currentSort: SortOption;
}

const SEARCH_CATEGORIES: { id: CommunityCategory; label: string }[] = [
    { id: 'qna', label: 'Q&A' },
    { id: 'companion', label: '동행' },
    { id: 'info', label: '꿀팁' },
    { id: 'locally_content', label: '콘텐츠' },
];

export default function CommunitySearchControls({
    currentCategory,
    currentQuery,
    currentSort,
}: CommunitySearchControlsProps) {
    const router = useRouter();
    const [query, setQuery] = useState(currentQuery);
    const [category, setCategory] = useState<CommunityCategory>(currentCategory);
    const [sort, setSort] = useState<SortOption>(currentSort);

    useEffect(() => {
        setQuery(currentQuery);
        setCategory(currentCategory);
        setSort(currentSort);
    }, [currentCategory, currentQuery, currentSort]);

    const pushSearch = (nextCategory: CommunityCategory, nextQuery: string, nextSort: SortOption) => {
        const params = new URLSearchParams();
        params.set('category', nextCategory);
        if (nextQuery.trim()) params.set('q', nextQuery.trim());
        if (nextSort !== 'latest') params.set('sort', nextSort);
        router.push(`/community?${params.toString()}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        pushSearch(category, query, sort);
    };

    const handleCategoryChange = (nextCategory: CommunityCategory) => {
        setCategory(nextCategory);
        pushSearch(nextCategory, query, sort);
    };

    const handleSortChange = (nextSort: SortOption) => {
        setSort(nextSort);
        pushSearch(category, query, nextSort);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-4 mb-5"
        >
            <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as CommunityCategory)}
                    className="w-full md:w-[140px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] md:text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
                >
                    {SEARCH_CATEGORIES.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.label}
                        </option>
                    ))}
                </select>

                <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                    <Search size={16} className="text-slate-400 shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="제목 또는 내용 검색"
                        className="w-full bg-transparent py-2.5 text-[12px] md:text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                </div>

                <select
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    className="w-full md:w-[120px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] md:text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
                >
                    <option value="latest">최신순</option>
                    <option value="popular">인기순</option>
                </select>

                <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] md:text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                    검색
                </button>
            </div>
        </form>
    );
}
