import React from 'react';
import Link from 'next/link';
import { MessageSquare, Heart, Eye } from 'lucide-react';
import type { CommunityFeedPost } from '../feedSelect';
import { getCommunityCategoryMeta } from '../categoryMeta';
import { getCommunityAuthorName } from '../authorDisplay';
import CommunityAuthorTrigger from './CommunityAuthorTrigger';

interface PostListCardProps {
    post: CommunityFeedPost;
    category: string;
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

export default function PostListCard({ post, category, query, sort }: PostListCardProps) {
    const badge = getCommunityCategoryMeta(post.category);
    const thumbnail = post.images?.[0] ?? null;
    const hasCompanionDate = post.category === 'companion' && post.companion_date;
    const authorName = getCommunityAuthorName(post.profiles, post.is_anonymous);
    const params = new URLSearchParams();
    params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    if (sort !== 'latest') params.set('sort', sort);
    const href = `/community/${post.id}?${params.toString()}`;

    return (
        <article className="group relative border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150">
            <Link
                href={href}
                aria-label={`${post.title} 상세 보기`}
                className="absolute inset-0 z-0"
            />

            <div className="relative z-10 flex items-start gap-3 px-5 py-4 pointer-events-none">
                <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 flex-shrink-0">
                    {thumbnail ? (
                        <img
                            src={thumbnail}
                            alt="썸네일"
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-50">
                            <img
                                src="/images/logo-black-transparent.png"
                                alt="Locally 로고"
                                className="h-10 w-10 object-contain opacity-70"
                                loading="lazy"
                            />
                        </div>
                    )}
                </div>

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
                            userId={post.user_id}
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
