import React from 'react';
import Link from 'next/link';
import { CommunityPost } from '@/app/types/community';
import LinkedExperienceChip from './LinkedExperienceChip';
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
    } catch (e) {
        return dateStr.split('T')[0];
    }
};

export default function PostCard({ post }: PostCardProps) {
    const { profiles, linked_experience, category } = post;
    const isCompanion = category === 'companion';
    const isQna = category === 'qna';

    return (
        <div className="bg-white border-b border-gray-100 py-6">
            {/* Header: User & Time */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                        {profiles?.avatar_url ? (
                            <img src={profiles.avatar_url} alt="profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-sm">?</div>
                        )}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-900 leading-tight">
                            {profiles?.name || '로컬리 유저'}
                        </div>
                        <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                            {getTimeAgo(post.created_at)}
                        </div>
                    </div>
                </div>
                {/* Status Badges */}
                {isQna && (
                    <div className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-slate-400" /> 답변대기
                    </div>
                )}
            </div>

            {/* Content Link */}
            <Link href={`/community/${post.id}`}>
                <div className="group cursor-pointer">
                    <h3 className="text-[17px] font-bold text-slate-900 mb-1 group-hover:text-[#FF385C] transition-colors leading-snug">
                        {post.title}
                    </h3>

                    {/* Companion Badges */}
                    {isCompanion && (post.companion_city || post.companion_date) && (
                        <div className="flex items-center gap-1.5 mb-2.5 mt-2 flex-wrap">
                            {post.companion_city && (
                                <span className="flex items-center gap-1 bg-slate-100 text-slate-700 text-[12px] font-bold px-2 py-1 rounded-md">
                                    <MapPin size={12} strokeWidth={2.5} /> {post.companion_city}
                                </span>
                            )}
                            {post.companion_date && (
                                <span className="flex items-center gap-1 bg-slate-100 text-slate-700 text-[12px] font-bold px-2 py-1 rounded-md">
                                    <CalendarCheck size={12} strokeWidth={2.5} /> {post.companion_date}
                                </span>
                            )}
                        </div>
                    )}

                    <p className="text-[15px] text-slate-600 line-clamp-2 mt-1 mb-4 leading-relaxed tracking-tight">{post.content}</p>

                    {/* Image Grid (Max 3) */}
                    {post.images && post.images.length > 0 && (
                        <div className={`grid gap-1 mb-4 rounded-xl overflow-hidden ${post.images.length === 1 ? 'grid-cols-1 aspect-[2/1] max-h-[300px]' :
                                post.images.length === 2 ? 'grid-cols-2 aspect-[2/1] max-h-[250px]' :
                                    'grid-cols-3 aspect-[2/1] max-h-[200px]'
                            }`}>
                            {post.images.slice(0, 3).map((img, idx) => (
                                <div key={idx} className="w-full h-full bg-slate-100">
                                    <img src={img} alt={`이미지 ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Link>

            {/* Linked Experience Embed */}
            {post.linked_exp_id && linked_experience && (
                <LinkedExperienceChip exp={linked_experience} />
            )}

            {/* Footer Stats */}
            <div className="flex items-center gap-4 mt-3 text-slate-400">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Heart size={16} strokeWidth={2.5} /> <span>{post.like_count || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <MessageSquare size={16} strokeWidth={2.5} /> <span>{post.comment_count || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold ml-auto">
                    <Eye size={16} strokeWidth={2.5} /> <span>{post.view_count || 0}</span>
                </div>
            </div>
        </div>
    );
}
