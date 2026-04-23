/* eslint-disable @next/next/no-img-element */
'use client';

// Community list cards render arbitrary post thumbnails directly from stored public URLs.

import React from 'react';
import { MessageSquare, Heart, Eye, Loader2 } from 'lucide-react';
import type { CommunityFeedPost } from '../feedSelect';
import { getCommunityAuthorName } from '../authorDisplay';
import CommunityAuthorTrigger from './CommunityAuthorTrigger';
import type { CommunityBoard } from '@/app/types/community';
import { buildCommunityBoardDetailHref } from '../queryParams';
import { usePendingNavigation } from '../hooks/usePendingNavigation';

interface PostListCardProps {
    post: CommunityFeedPost;
    board: CommunityBoard;
    sort: 'latest' | 'popular';
}

const getTimeAgo = (dateStr: string) => {
    try {
        const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
        const diff = (new Date(dateStr).getTime() - new Date().getTime()) / 1000;
        if (Math.abs(diff) < 60) return '방금 전';
        if (Math.abs(diff) < 3600) return rtf.format(Math.floor(diff / 60), 'minute');
        if (Math.abs(diff) < 86400) return rtf.format(Math.floor(diff / 3600), 'hour');
        return rtf.format(Math.floor(diff / 86400), 'day');
    } catch {
        return dateStr.split('T')[0];
    }
};

export default function PostListCard({ post, board, sort }: PostListCardProps) {
    const thumbnail = post.images?.[0] ?? null;
    const authorName = getCommunityAuthorName(post.profiles, post.is_anonymous);
    const { navigate, pendingHref } = usePendingNavigation();
    const href = buildCommunityBoardDetailHref(post.id, { board, sort });
    const isNavigating = pendingHref === href;

    return (
        <article className={`group relative border-b border-gray-100 last:border-0 transition-all duration-150 ${
            isNavigating ? 'bg-slate-50' : 'hover:bg-gray-50'
        }`}>
            <button
                type="button"
                onClick={() => navigate(href)}
                disabled={isNavigating}
                aria-label={`${post.title} 상세 보기`}
                aria-busy={isNavigating}
                className="absolute inset-0 z-0 cursor-pointer active:scale-[0.998] disabled:pointer-events-none"
            />
            {isNavigating && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                        <Loader2 size={16} className="animate-spin" />
                    </span>
                </div>
            )}

            <div className="relative z-10 flex items-start gap-3 px-5 py-4 pointer-events-none">
                {thumbnail && (
                    <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 flex-shrink-0">
                        <img
                            src={thumbnail}
                            alt={post.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <p className="mb-2 line-clamp-2 break-words text-[14px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere] md:text-[15px]">
                        {post.title}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                        <CommunityAuthorTrigger
                            userId={post.is_anonymous ? null : post.user_id}
                            authorName={authorName}
                            isAnonymous={post.is_anonymous}
                            currentPostId={post.id}
                            className="pointer-events-auto min-w-0 max-w-[10rem] text-left"
                        >
                            <span className="block truncate font-medium text-gray-500">
                                {authorName}
                            </span>
                        </CommunityAuthorTrigger>
                        <span>·</span>
                        <span suppressHydrationWarning>{getTimeAgo(post.created_at)}</span>
                        <span className="ml-auto flex items-center gap-2.5">
                            <span className="flex items-center gap-0.5">
                                <Eye size={10} />
                                {post.view_count ?? 0}
                            </span>
                            <span className="flex items-center gap-0.5">
                                <MessageSquare size={10} />
                                {post.comment_count ?? 0}
                            </span>
                            <span className="flex items-center gap-0.5">
                                <Heart size={10} />
                                {post.like_count ?? 0}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}
