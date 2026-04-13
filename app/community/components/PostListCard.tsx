/* eslint-disable @next/next/no-img-element */
'use client';

// Community list cards render arbitrary post thumbnails directly from stored public URLs.

import React from 'react';
import { MessageSquare, Heart, Eye, Loader2 } from 'lucide-react';
import type { CommunityFeedPost } from '../feedSelect';
import { getCommunityCategoryMeta } from '../categoryMeta';
import { getCommunityAuthorName } from '../authorDisplay';
import CommunityAuthorTrigger from './CommunityAuthorTrigger';
import type { CommunityHubFilter, CommunityPostFormatFilter } from '@/app/types/community';
import { buildCommunityDetailHref } from '../queryParams';
import { getCommunityHubMeta } from '../hubMeta';
import { usePendingNavigation } from '../hooks/usePendingNavigation';

interface PostListCardProps {
    post: CommunityFeedPost;
    hub: CommunityHubFilter;
    format: CommunityPostFormatFilter;
    query: string;
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

export default function PostListCard({ post, hub, format, query, sort }: PostListCardProps) {
    const badge = getCommunityCategoryMeta(post.category);
    const thumbnail = post.images?.[0] ?? null;
    const hasCompanionDate = post.category === 'companion' && post.companion_date;
    const authorName = getCommunityAuthorName(post.profiles, post.is_anonymous);
    const { navigate, pendingHref } = usePendingNavigation();
    const href = buildCommunityDetailHref(post.id, {
        hub,
        format,
        category: post.category,
        q: query,
        sort,
    });
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
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.badgeClassName}`}>
                            {badge.shortLabel}
                        </span>
                        {post.companion_city && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 break-words [overflow-wrap:anywhere]">
                                📍 {post.companion_city}
                            </span>
                        )}
                        {post.destination_hub && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 break-words [overflow-wrap:anywhere]">
                                {getCommunityHubMeta(post.destination_hub).shortLabel}
                            </span>
                        )}
                        {hasCompanionDate && (
                            <span className="text-[10px] font-semibold text-gray-400 break-words [overflow-wrap:anywhere]">
                                {post.companion_date}
                            </span>
                        )}
                    </div>

                    <p className="mb-2 line-clamp-2 break-words text-[14px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">
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
