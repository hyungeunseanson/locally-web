'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommunityPost } from '@/app/types/community';
import PostCard from './components/PostCard';
import PostListCard from './components/PostListCard';
import PostGridCard from './components/PostGridCard';
import { Loader2, MessageSquareDashed } from 'lucide-react';
import Link from 'next/link';

interface CommunityFeedProps {
    initialData: CommunityPost[];
    initialNextOffset: number | null;
    category: string;
}

// ─── Shimmer Skeleton ───────────────────────────────────────────────────────
function PostSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-20 bg-gray-200 rounded-full" />
                        <div className="h-2.5 w-12 bg-gray-100 rounded-full" />
                    </div>
                </div>
                <div className="h-6 w-16 bg-gray-100 rounded-md" />
            </div>
            {/* 제목 */}
            <div className="h-5 w-3/4 bg-gray-200 rounded-full mt-3" />
            {/* 본문 */}
            <div className="space-y-2 mt-3">
                <div className="h-3.5 w-full bg-gray-100 rounded-full" />
                <div className="h-3.5 w-5/6 bg-gray-100 rounded-full" />
                <div className="h-3.5 w-2/3 bg-gray-100 rounded-full" />
            </div>
            {/* 푸터 */}
            <div className="flex gap-4 mt-5 pt-4 border-t border-gray-50">
                <div className="h-3 w-10 bg-gray-100 rounded-full" />
                <div className="h-3 w-10 bg-gray-100 rounded-full" />
                <div className="h-3 w-10 bg-gray-100 rounded-full ml-auto" />
            </div>
        </div>
    );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center border border-dashed border-gray-300 text-center">
            <MessageSquareDashed className="w-12 h-12 text-gray-300 mb-4" strokeWidth={1.5} />
            <p className="text-gray-500 font-semibold text-[16px] mb-1">아직 게시글이 없어요</p>
            <p className="text-gray-400 text-sm mb-6">첫 글의 주인공이 되어보세요!</p>
            <Link
                href="/community/write"
                className="px-6 py-2.5 bg-black text-white text-[14px] font-bold rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
                글 작성하기
            </Link>
        </div>
    );
}

export default function CommunityFeed({ initialData, initialNextOffset, category }: CommunityFeedProps) {
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
    }, [category, initialData, initialNextOffset]);

    const loadMore = useCallback(async () => {
        if (isLoading || nextOffset === null) return;

        setIsLoading(true);
        try {
            const url = category
                ? `/api/community?category=${category}&offset=${nextOffset}`
                : `/api/community?offset=${nextOffset}`;

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
    }, [category, nextOffset, isLoading]);

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

    // 초기 로딩 스켈레톤
    if (isInitialLoading) {
        return (
            <div className="space-y-4 pb-24">
                {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
            </div>
        );
    }

    return (
        <div className="pb-24">
            {/* 지웴립니다 콘텐츠: 인스타그램 3/4콼 그리드 */}
            {category === 'locally_content' ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
                    {posts.map((post) => (
                        <PostGridCard key={`${post.id}`} post={post} />
                    ))}
                </div>
            ) : (
                /* 일반 탭: 리스트형 피드 */
                <div>
                    {posts.map((post) => (
                        <PostListCard key={`${post.id}`} post={post} />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {posts.length === 0 && !isLoading && (
                <EmptyState />
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
