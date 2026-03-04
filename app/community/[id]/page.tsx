import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, CalendarCheck, Share2, MoreVertical, CheckCircle2 } from 'lucide-react';
import LinkedExperienceChip from '../components/LinkedExperienceChip';
import CommentSection from '../components/CommentSection';
import LikeButton from '../components/LikeButton';

// 🚀 Dynamic Metadata (SSR SEO)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createClient();
    const { data: post } = await supabase.from('community_posts').select('title, content, images, category').eq('id', id).maybeSingle();

    if (!post) {
        return { title: '게시글을 찾을 수 없습니다 | Locally' };
    }

    const snippet = post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '');
    const defaultImage = post.images && post.images.length > 0 ? post.images[0] : 'https://locally.com/images/og-default.jpg';

    let prefix = '';
    if (post.category === 'qna') prefix = '[Q&A] ';
    else if (post.category === 'companion') prefix = '[동행] ';

    return {
        title: `${prefix}${post.title} | Locally`,
        description: snippet,
        openGraph: {
            title: `${prefix}${post.title} | Locally 커뮤니티`,
            description: snippet,
            images: [defaultImage],
            type: 'article',
        }
    };
}

const getTimeString = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export default async function CommunityPostDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    // ────────────────────────────────────────────────────────────
    // ① post 자체만 먼저 조회 (join 없음 — 가장 안정적)
    //    join을 포함한 단일 쿼리는 profiles/experiences 스키마 문제 시
    //    전체 data = null이 되어 notFound() 호출되는 버그가 있었음.
    // ────────────────────────────────────────────────────────────
    const { data: post, error: postError } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (postError) {
        console.error('[Community Post Detail] Post query error:', postError);
    }

    if (!post) {
        notFound();
    }

    // ② profile 별도 조회 (실패해도 post 렌더에 영향 없음)
    const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', post.user_id)
        .maybeSingle();

    // ③ 연동 체험 별도 조회 (linked_exp_id가 있을 때만)
    let linkedExperience: { id: number; title: string; image_url: string; price: number } | null = null;
    if (post.linked_exp_id) {
        const { data: exp } = await supabase
            .from('experiences')
            .select('id, title, image_url, price')
            .eq('id', post.linked_exp_id)
            .maybeSingle();
        linkedExperience = exp ?? null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const isOwner = user?.id === post.user_id;
    const isCompanion = post.category === 'companion';
    const isQna = post.category === 'qna';

    // (조회수는 Client 훅에서 올리거나, Redis Queue를 쓰는 것이 OOM 방어에 탁월하므로 SSR에서는 읽기만 수행합니다)

    return (
        <main className="max-w-[768px] mx-auto min-h-screen bg-white md:border-x md:border-slate-100 pb-32">
            {/* Header */}
            <div className="sticky top-[80px] z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                <Link href="/community" className="text-slate-600 hover:text-slate-900 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex items-center gap-3 text-slate-400">
                    <button className="hover:text-slate-900 transition-colors"><Share2 size={20} /></button>
                    {isOwner && <button className="hover:text-slate-900 transition-colors"><MoreVertical size={20} /></button>}
                </div>
            </div>

            <article className="px-5 py-6">
                {/* User Profile */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-sm">?</div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-1">
                                <span className="text-[15px] font-bold text-slate-900 leading-tight">
                                    {profile?.name || '로컬리 유저'}
                                </span>
                            </div>
                            <div className="text-[12px] font-medium text-slate-400 mt-0.5">
                                {getTimeString(post.created_at)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Title and Category Badges */}
                <h1 className="text-[22px] md:text-[24px] font-bold text-slate-900 leading-snug mb-4">
                    {post.title}
                </h1>

                {isCompanion && (post.companion_city || post.companion_date) && (
                    <div className="flex items-center gap-2 mb-6">
                        {post.companion_city && (
                            <div className="flex items-center gap-1.5 bg-rose-50 text-[#FF385C] text-[13px] font-bold px-3 py-1.5 rounded-lg border border-rose-100">
                                <MapPin size={14} strokeWidth={2.5} /> {post.companion_city}
                            </div>
                        )}
                        {post.companion_date && (
                            <div className="flex items-center gap-1.5 bg-slate-50 text-slate-700 text-[13px] font-bold px-3 py-1.5 rounded-lg border border-slate-200">
                                <CalendarCheck size={14} strokeWidth={2.5} /> {post.companion_date}
                            </div>
                        )}
                    </div>
                )}

                {isQna && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[13px] font-bold mb-6">
                        <CheckCircle2 size={16} className="text-slate-400" /> 답변대기
                    </div>
                )}

                {/* Content */}
                <div className="text-[16px] text-slate-800 leading-relaxed whitespace-pre-wrap mb-8">
                    {post.content}
                </div>

                {/* Images */}
                {post.images && post.images.length > 0 && (
                    <div className="space-y-3 mb-8">
                        {post.images.map((img: string, idx: number) => (
                            <img key={idx} src={img} alt={`첨부 이미지 ${idx + 1}`} className="w-full rounded-2xl bg-slate-50" loading="lazy" />
                        ))}
                    </div>
                )}

                {/* Linked Experience Embed */}
                {linkedExperience && (
                    <div className="mb-8">
                        <h4 className="text-[13px] font-bold text-slate-500 mb-2">언급된 로컬리 상품</h4>
                        <LinkedExperienceChip exp={linkedExperience} />
                    </div>
                )}

                {/* Stats + Like Button */}
                <div className="flex items-center gap-4 text-slate-400 text-sm font-semibold border-t border-slate-100 pt-5 mt-5">
                    <span>조회 {post.view_count || 0}</span>
                    <span>댓글 {post.comment_count || 0}</span>
                    <div className="ml-auto">
                        <LikeButton postId={post.id} initialCount={post.like_count || 0} />
                    </div>
                </div>
            </article>

            {/* Comments Divider */}
            <div className="w-full h-2 bg-slate-50 border-y border-slate-100"></div>

            <section className="px-5 py-6">
                <h3 className="text-[17px] font-bold text-slate-900 mb-6">댓글 {post.comment_count || 0}</h3>
                <CommentSection postId={post.id} initialCount={post.comment_count || 0} />
            </section>
        </main>
    );
}
