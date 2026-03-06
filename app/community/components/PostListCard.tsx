import React from 'react';
import Link from 'next/link';
import { CommunityPost } from '@/app/types/community';
import { MessageSquare, Heart, Eye } from 'lucide-react';

interface PostListCardProps {
    post: CommunityPost;
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

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
    qna: { label: 'Q&A', className: 'bg-amber-50 text-amber-600 border border-amber-200' },
    companion: { label: '동행', className: 'bg-blue-50 text-blue-600 border border-blue-200' },
    info: { label: '꿀팁', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
};

/**
 * 리스트형 피드 카드 — Q&A / 동행 / 꿀팁 탭 전용
 * F-Pattern 스캔 최적화: 좌측 썸네일 + 우측 정보 수평 배치
 */
export default function PostListCard({ post, category, query, sort }: PostListCardProps) {
    const { profiles, category: postCategory } = post;
    const badge = CATEGORY_BADGE[postCategory] ?? { label: postCategory, className: 'bg-gray-100 text-gray-500' };
    const thumbnail = post.images?.[0] ?? null;
    const hasCompanionDate = postCategory === 'companion' && post.companion_date;
    const authorName = profiles?.name || '익명';
    const params = new URLSearchParams();
    params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    if (sort !== 'latest') params.set('sort', sort);

    return (
        <Link href={`/community/${post.id}?${params.toString()}`} className="block">
            <article className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150 cursor-pointer">

                {/* 좌측: 썸네일 (이미지 있을 때만) */}
                {thumbnail && (
                    <div className="w-[68px] h-[68px] rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img
                            src={thumbnail}
                            alt="썸네일"
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                )}

                {/* 우측: 정보 */}
                <div className="flex-1 min-w-0">
                    {/* 뱃지 줄 */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                            {badge.label}
                        </span>
                        {post.companion_city && (
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                📍 {post.companion_city}
                            </span>
                        )}
                        {hasCompanionDate && (
                            <span className="text-[10px] font-semibold text-gray-400">
                                {post.companion_date}
                            </span>
                        )}
                    </div>

                    {/* 제목 */}
                    <p className="text-[14px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1.5">
                        {post.title}
                    </p>

                    {/* 메타: 닉네임 + 시간 + 통계 */}
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                        <span className="font-medium text-gray-500">{authorName}</span>
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
            </article>
        </Link>
    );
}
