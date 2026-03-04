import React from 'react';
import Link from 'next/link';
import { CommunityPost } from '@/app/types/community';
import LinkedExperienceChip from './LinkedExperienceChip';
import PostImages from './PostImages';
import { MessageSquare, Heart, Eye, MapPin, CalendarCheck, CheckCircle2 } from 'lucide-react';

interface PostCardProps {
    post: CommunityPost;
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

const CATEGORY_LABEL: Record<string, string> = {
    qna: '💡 Q&A',
    companion: '🤝 동행',
    info: '🗺️ 꿀팁',
};

export default function PostCard({ post }: PostCardProps) {
    const { profiles, linked_experience, category } = post;
    const isCompanion = category === 'companion';
    const isQna = category === 'qna';

    return (
        <Link href={`/community/${post.id}`} className="block">
            <article className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer p-5">

                {/* ── 카드 헤더: 아바타 + 닉네임 + 시간 / 카테고리 뱃지 ── */}
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100 flex-shrink-0">
                            {profiles?.avatar_url ? (
                                <img src={profiles.avatar_url} alt="profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-sm">
                                    {profiles?.name?.[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 text-[14px] leading-tight">
                                {profiles?.name || '로컬리 유저'}
                            </div>
                            <div className="text-sm text-gray-400 mt-0.5">
                                {getTimeAgo(post.created_at)}
                            </div>
                        </div>
                    </div>

                    {/* 카테고리 + QnA 뱃지 */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {category && (
                            <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-medium">
                                {CATEGORY_LABEL[category] || category}
                            </span>
                        )}
                        {isQna && (
                            <span className="flex items-center gap-1 border border-gray-200 text-gray-500 text-xs px-2 py-1 rounded-md font-medium">
                                <CheckCircle2 size={11} /> 답변대기
                            </span>
                        )}
                    </div>
                </div>

                {/* ── 콘텐츠 본문 ── */}
                <div className="group">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 mt-3 leading-snug group-hover:text-[#FF385C] transition-colors">
                        {post.title}
                    </h3>

                    {/* 동행 뱃지 */}
                    {isCompanion && (post.companion_city || post.companion_date) && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {post.companion_city && (
                                <span className="flex items-center gap-1 bg-gray-100 text-gray-700 text-[12px] font-bold px-2 py-1 rounded-md">
                                    <MapPin size={11} strokeWidth={2.5} /> {post.companion_city}
                                </span>
                            )}
                            {post.companion_date && (
                                <span className="flex items-center gap-1 bg-gray-100 text-gray-700 text-[12px] font-bold px-2 py-1 rounded-md">
                                    <CalendarCheck size={11} strokeWidth={2.5} /> {post.companion_date}
                                </span>
                            )}
                        </div>
                    )}

                    <p className="text-gray-600 line-clamp-3 mt-1 text-[15px] leading-relaxed">
                        {post.content}
                    </p>

                    {/* 이미지 */}
                    {post.images && post.images.length > 0 && (
                        <div className="mt-4">
                            <PostImages images={post.images} />
                        </div>
                    )}
                </div>

                {/* 연동 체험 칩 */}
                {post.linked_exp_id && linked_experience && (
                    <div onClick={(e) => e.preventDefault()}>
                        <LinkedExperienceChip exp={linked_experience} />
                    </div>
                )}

                {/* 푸터: 좋아요 / 댓글 / 조회수 */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50 text-gray-400">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Heart size={15} strokeWidth={2} />
                        <span>{post.like_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <MessageSquare size={15} strokeWidth={2} />
                        <span>{post.comment_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold ml-auto">
                        <Eye size={15} strokeWidth={2} />
                        <span>{post.view_count || 0}</span>
                    </div>
                </div>
            </article>
        </Link>
    );
}
