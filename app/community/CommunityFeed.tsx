'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommunityPost } from '@/app/types/community';
import PostCard from './components/PostCard';
import { Loader2 } from 'lucide-react';

interface CommunityFeedProps {
    initialData: CommunityPost[];
    initialNextOffset: number | null;
    category: string;
}

export default function CommunityFeed({ initialData, initialNextOffset, category }: CommunityFeedProps) {
    const [posts, setPosts] = useState<CommunityPost[]>(initialData);
    const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset);
    const [isLoading, setIsLoading] = useState(false);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // 카테고리 전환 시 초깃값으로 강제 리셋 (SSR에서 넘어온 데이터)
    useEffect(() => {
        setPosts(initialData);
        setNextOffset(initialNextOffset);
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

    return (
        <div className="pb-24">
            {posts.map((post) => (
                <PostCard key={`${post.id}`} post={post} />
            ))}

            {posts.length === 0 && (
                <div className="py-20 text-center text-slate-500 font-medium">
                    아직 등록된 게시글이 없습니다. 첫 글을 남겨주세요!
                </div>
            )}

            <div ref={loadMoreRef} className="h-14 flex items-center justify-center mt-2">
                {isLoading && <Loader2 className="animate-spin text-slate-400" size={24} />}
            </div>
        </div>
    );
}
