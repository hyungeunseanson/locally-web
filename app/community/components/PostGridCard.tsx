'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, MessageSquare } from 'lucide-react';
import type { CommunityFeedPost } from '../feedSelect';
import { getCommunityCategoryMeta } from '../categoryMeta';
import { getCommunityAuthorInitial, getCommunityAuthorName } from '../authorDisplay';
import CommunityAuthorTrigger from './CommunityAuthorTrigger';

interface PostGridCardProps {
    post: CommunityFeedPost;
    category: string;
    query: string;
    sort: 'latest' | 'popular';
}

export default function PostGridCard({ post, category, query, sort }: PostGridCardProps) {
    const thumbnail = post.images?.[0] ?? null;
    const authorName = getCommunityAuthorName(post.profiles, post.is_anonymous);
    const authorInitial = getCommunityAuthorInitial(post.profiles, post.is_anonymous);
    const categoryMeta = getCommunityCategoryMeta(post.category);
    const params = new URLSearchParams();
    params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    if (sort !== 'latest') params.set('sort', sort);
    const href = `/community/${post.id}?${params.toString()}`;

    return (
        <article data-testid="community-content-card" className="group relative aspect-[4/5] overflow-hidden rounded-[28px] bg-neutral-100">
            <Link
                href={href}
                aria-label={`${post.title} 상세 보기`}
                className="absolute inset-0 z-0"
            />

            {thumbnail ? (
                <img
                    src={thumbnail}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] pointer-events-none"
                    loading="lazy"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f4f5_58%,#e4e4e7_100%)] p-6 pointer-events-none">
                    <img
                        src="/images/logo-black-transparent.png"
                        alt="Locally 로고"
                        className="h-20 w-20 object-contain opacity-65"
                        loading="lazy"
                    />
                </div>
            )}

            {/* 배지: 모바일 -20% (text-[8px] px-2), 데스크탑 기존 유지 */}
            <div className="absolute inset-x-0 top-0 z-10 flex justify-start p-3 md:p-4 pointer-events-none">
                <span className={`rounded-full px-2 py-0.5 text-[8px] md:px-3 md:py-1 md:text-[10px] font-bold shadow-sm ${categoryMeta.badgeClassName}`}>
                    {categoryMeta.shortLabel}
                </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pb-3 pt-10 md:px-4 md:pb-4 md:pt-12 pointer-events-none">
                {/* 데스크탑: 작성자 + 통계 */}
                <div className="hidden md:flex items-center justify-between gap-3">
                    <CommunityAuthorTrigger
                        userId={post.user_id}
                        authorName={authorName}
                        isAnonymous={post.is_anonymous}
                        currentPostId={post.id}
                        className="pointer-events-auto min-w-0 max-w-[60%] text-left"
                    >
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[12px] font-bold text-white backdrop-blur-sm">
                                {authorInitial}
                            </div>
                            <span className="truncate text-[12px] font-semibold text-white/95">
                                {authorName}
                            </span>
                        </div>
                    </CommunityAuthorTrigger>

                    <div className="flex items-center gap-3 text-[12px] font-semibold text-white/90">
                        <span className="flex items-center gap-1">
                            <Heart size={14} />
                            {post.like_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageSquare size={14} />
                            {post.comment_count ?? 0}
                        </span>
                    </div>
                </div>

                {/* 모바일: 통계만 우측 하단, -20% 크기 */}
                <div className="flex md:hidden justify-end">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-white/90">
                        <span className="flex items-center gap-0.5">
                            <Heart size={11} />
                            {post.like_count ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                            <MessageSquare size={11} />
                            {post.comment_count ?? 0}
                        </span>
                    </div>
                </div>
            </div>

        </article>
    );
}
