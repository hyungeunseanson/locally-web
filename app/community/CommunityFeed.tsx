'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommunityPost } from '@/app/types/community';
import PostListCard from './components/PostListCard';
import PostGridCard from './components/PostGridCard';
import { Loader2, MessageSquareDashed } from 'lucide-react';
import Link from 'next/link';

interface CommunityFeedProps {
    initialData: CommunityPost[];
    initialNextOffset: number | null;
    category: string;
    query: string;
    sort: 'latest' | 'popular';
}

// ─── Shimmer Skeleton: 리스트형 ──────────────────────────────────────────────
function PostListSkeleton() {
    return (
        <div className="flex items-start gap-3 py-4 border-b border-gray-100 animate-pulse">
            <div className="w-[68px] h-[68px] rounded-lg bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="flex gap-1.5">
                    <div className="h-4 w-10 bg-gray-200 rounded-full" />
                    <div className="h-4 w-14 bg-gray-100 rounded-full" />
                </div>
                <div className="h-4 w-3/4 bg-gray-200 rounded-full" />
                <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
            </div>
        </div>
    );
}

// ─── Shimmer Skeleton: 그리드형 ──────────────────────────────────────────────
function PostGridSkeleton() {
    return (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
            {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 animate-pulse" />
            ))}
        </div>
    );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ category, query }: { category: string; query: string }) {
    const writeHref = category ? `/community/write?category=${category}` : '/community/write?category=qna';
    const isSearchMode = Boolean(query.trim());

    return (
        <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center border border-dashed border-gray-300 text-center">
            <MessageSquareDashed className="w-12 h-12 text-gray-300 mb-4" strokeWidth={1.5} />
            <p className="text-gray-500 font-semibold text-[16px] mb-1">
                {isSearchMode ? '검색 결과가 없어요' : '아직 게시글이 없어요'}
            </p>
            <p className="text-gray-400 text-sm mb-6">
                {isSearchMode ? '다른 키워드나 정렬로 다시 찾아보세요.' : '첫 글의 주인공이 되어보세요!'}
            </p>
            {category !== 'locally_content' && !isSearchMode && (
                <Link
                    href={writeHref}
                    className="px-6 py-2.5 bg-black text-white text-[14px] font-bold rounded-full hover:bg-gray-800 active:scale-95 transition-all"
                >
                    글 작성하기
                </Link>
            )}
        </div>
    );
}

export default function CommunityFeed({ initialData, initialNextOffset, category, query, sort }: CommunityFeedProps) {
    const [posts, setPosts] = useState<CommunityPost[]>(initialData);
    const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(false);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // 카테고리 전환 시 초깃값으로 강제 리셋 (SSR에서 넘어온 데이터)
    useEffect(() => {
        setIsInitialLoading(true);
        setPosts(initialData);
        setNextOffset(initialNextOffset);
        // 짧은 딜레이로 스켈레톤 UX 시뮬레이션
        const t = setTimeout(() => setIsInitialLoading(false), 200);
        return () => clearTimeout(t);
    }, [category, initialData, initialNextOffset, query, sort]);

    const loadMore = useCallback(async () => {
        if (isLoading || nextOffset === null) return;

        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (query.trim()) params.set('q', query.trim());
            if (sort !== 'latest') params.set('sort', sort);
            params.set('offset', String(nextOffset));
            const url = `/api/community?${params.toString()}`;

            const res = await fetch(url);
            const { data, nextOffset: newOffset } = await res.json();

            if (data && data.length > 0) {
                setPosts(prev => {
                    // Prevent duplicate keys due to React strict mode double invocation
                    const prevIds = new Set(prev.map(p => p.id));
                    const newUniqueData = data.filter((p: CommunityPost) => !prevIds.has(p.id));
                    return [...prev, ...newUniqueData];
                });
            }
            setNextOffset(newOffset);
        } catch (error) {
            console.error('Failed to load more posts', error);
        } finally {
            setIsLoading(false);
        }
    }, [category, nextOffset, isLoading, query, sort]);

    useEffect(() => {
        const currentRef = loadMoreRef.current;
        if (!currentRef) return;

        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && nextOffset !== null && !isLoading) {
                loadMore();
            }
        }, { threshold: 0.1 });

        observerRef.current.observe(currentRef);

        return () => {
            if (observerRef.current && currentRef) {
                observerRef.current.unobserve(currentRef);
            }
        };
    }, [loadMore, nextOffset, isLoading]);

    // 초기 로딩 스켈레톤 — 카테고리에 따라 분기
    if (isInitialLoading) {
        if (category === 'locally_content') {
            return <div className="pb-24"><PostGridSkeleton /></div>;
        }
        return (
            <div className="pb-24">
                {[...Array(5)].map((_, i) => <PostListSkeleton key={i} />)}
            </div>
        );
    }

    return (
        <div className="pb-24">
            {/* 지웴립니다 콘텐츠: 인스타그램 3/4콼 그리드 */}
            {category === 'locally_content' ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
                    {posts.map((post) => (
                        <PostGridCard key={`${post.id}`} post={post} category={category} query={query} sort={sort} />
                    ))}
                </div>
            ) : (
                /* 일반 탭: 리스트형 피드 — 원 블록 화이트 보드 */
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {posts.map((post) => (
                        <PostListCard key={`${post.id}`} post={post} category={category} query={query} sort={sort} />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {posts.length === 0 && !isLoading && (
                <EmptyState category={category} query={query} />
            )}

            {/* 무한 스크롤 트리거 + 로딩 인디케이터 */}
            <div ref={loadMoreRef} className="h-14 flex items-center justify-center mt-4">
                {isLoading && (
                    <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="text-sm font-medium">불러오는 중...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
