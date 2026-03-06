'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Search } from 'lucide-react';
import type { CommunityFilterCategory } from '@/app/types/community';

type SortOption = 'latest' | 'popular';
type OpenLayer = 'category' | 'sort' | null;

interface CommunitySearchControlsProps {
    currentCategory: CommunityFilterCategory;
    currentQuery: string;
    currentSort: SortOption;
}

const SEARCH_CATEGORIES: { id: CommunityFilterCategory; label: string }[] = [
    { id: 'all', label: '전체보기' },
    { id: 'qna', label: 'Q&A' },
    { id: 'companion', label: '동행' },
    { id: 'info', label: '꿀팁' },
    { id: 'locally_content', label: '콘텐츠' },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
    { id: 'latest', label: '최신순' },
    { id: 'popular', label: '인기순' },
];

function TriggerButton({
    label,
    value,
    isOpen,
    onClick,
    tone = 'default',
}: {
    label: string;
    value: string;
    isOpen: boolean;
    onClick: () => void;
    tone?: 'default' | 'muted';
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={`flex h-11 items-center gap-2 rounded-full px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF385C]/25 ${
                tone === 'muted'
                    ? 'text-[#4B4B4B] hover:bg-[#F7F7F7]'
                    : 'text-[#222222] hover:bg-[#F7F7F7]'
            }`}
        >
            <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A8A8A]">{label}</div>
                <div className="truncate text-[13px] font-semibold md:text-[14px]">{value}</div>
            </div>
            <ChevronDown
                size={14}
                className={`shrink-0 text-[#8A8A8A] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
        </button>
    );
}

export default function CommunitySearchControls({
    currentCategory,
    currentQuery,
    currentSort,
}: CommunitySearchControlsProps) {
    const router = useRouter();
    const rootRef = useRef<HTMLFormElement>(null);
    const [query, setQuery] = useState(currentQuery);
    const [category, setCategory] = useState<CommunityFilterCategory>(currentCategory);
    const [sort, setSort] = useState<SortOption>(currentSort);
    const [openLayer, setOpenLayer] = useState<OpenLayer>(null);

    useEffect(() => {
        setQuery(currentQuery);
        setCategory(currentCategory);
        setSort(currentSort);
        setOpenLayer(null);
    }, [currentCategory, currentQuery, currentSort]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpenLayer(null);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenLayer(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const selectedCategoryLabel = useMemo(
        () => SEARCH_CATEGORIES.find((item) => item.id === category)?.label || '전체보기',
        [category],
    );

    const selectedSortLabel = useMemo(
        () => SORT_OPTIONS.find((item) => item.id === sort)?.label || '최신순',
        [sort],
    );

    const pushSearch = (nextCategory: CommunityFilterCategory, nextQuery: string, nextSort: SortOption) => {
        const params = new URLSearchParams();
        params.set('category', nextCategory);
        if (nextQuery.trim()) params.set('q', nextQuery.trim());
        if (nextSort !== 'latest') params.set('sort', nextSort);
        router.push(`/community?${params.toString()}`);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        pushSearch(category, query, sort);
        setOpenLayer(null);
    };

    const handleCategorySelect = (nextCategory: CommunityFilterCategory) => {
        setCategory(nextCategory);
        setOpenLayer(null);
        pushSearch(nextCategory, query, sort);
    };

    const handleSortSelect = (nextSort: SortOption) => {
        setSort(nextSort);
        setOpenLayer(null);
        pushSearch(category, query, nextSort);
    };

    return (
        <form ref={rootRef} onSubmit={handleSubmit} className="mb-4 md:mb-5">
            <div className="hidden md:block">
                <div className="relative rounded-full border border-[#E7E7E7] bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] focus-within:shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
                    <div className="flex items-center">
                        <div className="relative shrink-0">
                            <TriggerButton
                                label="카테고리"
                                value={selectedCategoryLabel}
                                isOpen={openLayer === 'category'}
                                onClick={() => setOpenLayer((prev) => (prev === 'category' ? null : 'category'))}
                            />
                            {openLayer === 'category' && (
                                <div className="absolute left-0 top-[calc(100%+10px)] z-20 w-44 rounded-[24px] border border-[#EBEBEB] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                                    <div className="space-y-1" role="listbox" aria-label="카테고리 선택">
                                        {SEARCH_CATEGORIES.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleCategorySelect(item.id)}
                                                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                                                    category === item.id
                                                        ? 'bg-[#FFF1F4] text-[#E31C5F]'
                                                        : 'text-[#3B3B3B] hover:bg-[#F7F7F7]'
                                                }`}
                                            >
                                                <span>{item.label}</span>
                                                {category === item.id && <span className="text-[11px] font-semibold">선택됨</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-8 w-px bg-[#ECECEC]" />

                        <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7F7F7] text-[#6B6B6B]">
                                <Search size={16} />
                            </div>
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="제목 또는 내용 검색"
                                className="h-11 w-full min-w-0 bg-transparent text-[14px] font-medium text-[#222222] placeholder:text-[#9A9A9A] outline-none"
                            />
                        </div>

                        <div className="h-8 w-px bg-[#ECECEC]" />

                        <div className="relative shrink-0">
                            <TriggerButton
                                label="정렬"
                                value={selectedSortLabel}
                                tone="muted"
                                isOpen={openLayer === 'sort'}
                                onClick={() => setOpenLayer((prev) => (prev === 'sort' ? null : 'sort'))}
                            />
                            {openLayer === 'sort' && (
                                <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-36 rounded-[24px] border border-[#EBEBEB] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                                    <div className="space-y-1" role="listbox" aria-label="정렬 선택">
                                        {SORT_OPTIONS.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleSortSelect(item.id)}
                                                className={`block w-full rounded-2xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                                                    sort === item.id
                                                        ? 'bg-[#F5F5F5] text-[#222222]'
                                                        : 'text-[#4B4B4B] hover:bg-[#F7F7F7]'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="ml-1 inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#FF385C] px-6 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(255,56,92,0.22)] transition-all hover:bg-[#E31C5F] hover:shadow-[0_10px_22px_rgba(255,56,92,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF385C]/30"
                        >
                            검색
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3 md:hidden">
                <div className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-[#E7E7E7] bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus-within:shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
                        <Search size={16} className="shrink-0 text-[#6B6B6B]" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="제목 또는 내용 검색"
                            className="h-12 w-full min-w-0 bg-transparent text-[13px] font-medium text-[#222222] placeholder:text-[#9A9A9A] outline-none"
                        />
                    </div>
                    <button
                        type="submit"
                        className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-[#FF385C] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(255,56,92,0.22)] transition-colors hover:bg-[#E31C5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF385C]/30"
                    >
                        검색
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {SEARCH_CATEGORIES.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => handleCategorySelect(item.id)}
                            className={`h-9 shrink-0 rounded-full border px-4 text-[12px] font-semibold transition-colors ${
                                category === item.id
                                    ? 'border-[#222222] bg-[#222222] text-white'
                                    : 'border-[#E2E2E2] bg-white text-[#4B4B4B]'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-full border border-[#E7E7E7] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    {SORT_OPTIONS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSortSelect(item.id)}
                            className={`h-9 rounded-full text-[12px] font-semibold transition-colors ${
                                sort === item.id
                                    ? 'bg-[#F5F5F5] text-[#222222]'
                                    : 'text-[#6B6B6B]'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>
        </form>
    );
}
