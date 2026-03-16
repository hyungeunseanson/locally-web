import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, CalendarCheck } from 'lucide-react';
import LinkedExperienceChip from '../components/LinkedExperienceChip';
import PostImages from '../components/PostImages';
import CommunityCommentsPanel from '../components/CommunityCommentsPanel';
import BackButton from '../components/BackButton';
import ShareButton from '../components/ShareButton';
import SiteHeader from '@/app/components/SiteHeader';
import CommunityAuthorTrigger from '../components/CommunityAuthorTrigger';
import JsonLd from '@/app/components/seo/JsonLd';
import { getProfileDisplayName } from '@/app/utils/profile';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { buildBreadcrumbJsonLd, buildCommunityArticleJsonLd } from '@/app/utils/structuredData';
import { getCommunityAuthorAvatar, getCommunityAuthorInitial, getCommunityAuthorName } from '../authorDisplay';
import { getCommunityCategoryMeta, isLocallyContentCategory } from '../categoryMeta';

// 🚀 Dynamic Metadata (SSR SEO)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createClient();
    const { data: post } = await supabase.from('community_posts').select('title, content, images, category').eq('id', id).maybeSingle();

    if (!post) {
        return { title: '게시글을 찾을 수 없습니다' };
    }

    const snippet = post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '');
    const defaultImage = post.images && post.images.length > 0 ? post.images[0] : buildAbsoluteUrl('/images/logo.png');
    const pagePath = `/community/${id}`;
    const canonicalUrl = buildLocalizedAbsoluteUrl('ko', pagePath);

    let prefix = '';
    if (post.category === 'qna') prefix = '[Q&A] ';
    else if (post.category === 'companion') prefix = '[동행] ';

    return {
        title: `${prefix}${post.title}`,
        description: snippet,
        openGraph: {
            title: `${prefix}${post.title} | Locally 커뮤니티`,
            description: snippet,
            url: canonicalUrl,
            images: [defaultImage],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${prefix}${post.title}`,
            description: snippet,
            images: [defaultImage],
        },
        alternates: {
            canonical: canonicalUrl,
            languages: {
                ko: buildLocalizedAbsoluteUrl('ko', pagePath),
                en: buildLocalizedAbsoluteUrl('en', pagePath),
                ja: buildLocalizedAbsoluteUrl('ja', pagePath),
                zh: buildLocalizedAbsoluteUrl('zh', pagePath),
            },
        },
    };
}

const getTimeString = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export default async function CommunityPostDetail({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id } = await params;
    const detailSearchParams = await searchParams;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // ① post 단독 조회 (SSR Join 분리 원칙)
    const { data: post, error: postError } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (postError) console.error('[Community Post Detail] Post query error:', postError);
    if (!post) notFound();

    let initialLiked = false;
    if (user) {
        const { data: existingLike, error: existingLikeError } = await supabase
            .from('community_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingLikeError) {
            console.error('[Community Post Detail] Like state query error:', existingLikeError);
        } else {
            initialLiked = Boolean(existingLike);
        }
    }

    // ② profile 별도 조회
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', post.user_id)
        .maybeSingle();

    // ③ 연동 체험 별도 조회
    let linkedExperience: { id: number; title: string; image_url: string; price: number } | null = null;
    if (post.linked_exp_id) {
        const { data: exp } = await supabase
            .from('experiences')
            .select('id, title, image_url, price')
            .eq('id', post.linked_exp_id)
            .maybeSingle();
        linkedExperience = exp ?? null;
    }

    // ④ 이전글/다음글 (같은 카테고리)
    const [{ data: prevPost }, { data: nextPost }] = await Promise.all([
        supabase.from('community_posts')
            .select('id, title, created_at')
            .eq('category', post.category)
            .lt('created_at', post.created_at)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase.from('community_posts')
            .select('id, title, created_at')
            .eq('category', post.category)
            .gt('created_at', post.created_at)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
    ]);

    const isCompanion = post.category === 'companion';
    const isLocallyContent = isLocallyContentCategory(post.category);
    const authorName = getCommunityAuthorName(profile, post.is_anonymous);
    const authorInitial = getCommunityAuthorInitial(profile, post.is_anonymous);
    const authorAvatar = getCommunityAuthorAvatar(profile, post.is_anonymous);
    const categoryMeta = getCommunityCategoryMeta(post.category);
    const pageUrl = buildAbsoluteUrl(`/community/${id}`);
    const articleDescription = post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '');
    const articleImage = post.images && post.images.length > 0 ? post.images[0] : buildAbsoluteUrl('/images/logo.png');
    const fallbackParams = new URLSearchParams();
    fallbackParams.set('category', (detailSearchParams?.category as string) || post.category);
    const fallbackQuery = ((detailSearchParams?.q as string) || '').trim();
    const fallbackSort = (detailSearchParams?.sort as string) === 'popular' ? 'popular' : 'latest';
    if (fallbackQuery) fallbackParams.set('q', fallbackQuery);
    if (fallbackSort !== 'latest') fallbackParams.set('sort', fallbackSort);
    const fallbackHref = `/community?${fallbackParams.toString()}`;

    return (
        <>
            <JsonLd
                data={[
                    buildCommunityArticleJsonLd({
                        title: post.title,
                        description: articleDescription,
                        url: pageUrl,
                        imageUrl: articleImage,
                        authorName,
                        datePublished: post.created_at,
                        dateModified: post.updated_at,
                        section: post.category,
                    }),
                    buildBreadcrumbJsonLd([
                        { name: 'Home', item: buildAbsoluteUrl('/') },
                        { name: '커뮤니티', item: buildAbsoluteUrl('/community') },
                        { name: post.title, item: pageUrl },
                    ]),
                ]}
            />
            <SiteHeader />
            {/* 데스크탑: max-w-7xl 2컬럼 / 모바일: max-w-[768px] 단일 컬럼 */}
            <div className="min-h-screen bg-[#F7F7F9]">
                <div className="max-w-7xl mx-auto lg:px-4 lg:py-8">
                    <div className="lg:grid lg:grid-cols-12 lg:gap-8">

                    {/* ─── 좌측: 게시글 본문 (lg:col-span-8) ─── */}
                    <div className="lg:col-span-8">
                        <main className="max-w-[768px] mx-auto lg:max-w-none min-h-screen bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-100 pb-8">

                            {/* 뒤로가기/공유 바: 모바일만 sticky, 데스크탑은 static */}
                            <div className="sticky top-0 z-50 md:static md:z-auto bg-white/95 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                                <BackButton href={fallbackHref} />
                                <div className="flex items-center gap-3 text-slate-400">
                                    <ShareButton title={post.title} url={pageUrl} />
                                </div>
                            </div>

                            <article className="px-5 py-6">
                                {isLocallyContent && post.images && post.images.length > 0 && (
                                    <div className="mb-6">
                                        <PostImages images={post.images} detail hero />
                                    </div>
                                )}

                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${categoryMeta.detailChipClassName}`}>
                                        {categoryMeta.shortLabel}
                                    </span>
                                </div>

                                <h1 className="mb-4 break-words text-[18px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] md:text-[24px]">
                                    {post.title}
                                </h1>

                                <div className="mb-5">
                                    <CommunityAuthorTrigger
                                        userId={post.user_id}
                                        authorName={authorName}
                                        isAnonymous={post.is_anonymous}
                                        currentPostId={post.id}
                                        className="text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-300">
                                                {authorAvatar ? (
                                                    <img src={authorAvatar} alt={authorName} className="h-full w-full object-cover" />
                                                ) : (
                                                    authorInitial
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block break-words text-[13px] font-semibold leading-tight text-slate-900 [overflow-wrap:anywhere] md:text-[15px] md:font-bold">
                                                    {authorName}
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-400 md:text-[12px]">
                                                    {getTimeString(post.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </CommunityAuthorTrigger>
                                </div>

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

                                <div className="mb-8 break-words whitespace-pre-wrap text-[16px] leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                                    {post.content}
                                </div>

                                {!isLocallyContent && post.images && post.images.length > 0 && (
                                    <div className="mb-8">
                                        <PostImages images={post.images} detail />
                                    </div>
                                )}

                                {linkedExperience && (
                                    <div className="mb-8">
                                        <h4 className="text-[13px] font-bold text-slate-500 mb-2">언급된 로컬리 체험</h4>
                                        <LinkedExperienceChip exp={linkedExperience} />
                                    </div>
                                )}

                            </article>

                            <CommunityCommentsPanel
                                postId={post.id}
                                viewCount={post.view_count || 0}
                                initialLikeCount={post.like_count || 0}
                                initialLiked={initialLiked}
                                initialCommentCount={post.comment_count || 0}
                            />

                            <div className="mx-5 border-t border-slate-100 pb-6 pt-5">
                                <div className="grid grid-cols-3 gap-3">
                                    {prevPost ? (
                                        <Link
                                            href={`/community/${prevPost.id}?${fallbackParams.toString()}`}
                                            data-testid="community-detail-prev-link"
                                            className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                        >
                                            ◀ 이전글
                                        </Link>
                                    ) : (
                                        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-[12px] text-slate-300">
                                            이전글 없음
                                        </div>
                                    )}

                                    <Link
                                        href={fallbackHref}
                                        data-testid="community-detail-list-button"
                                        className="flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black"
                                    >
                                        목록
                                    </Link>

                                    {nextPost ? (
                                        <Link
                                            href={`/community/${nextPost.id}?${fallbackParams.toString()}`}
                                            data-testid="community-detail-next-link"
                                            className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                        >
                                            다음글 ▶
                                        </Link>
                                    ) : (
                                        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-[12px] text-slate-300">
                                            다음글 없음
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 모바일 전용 광고 영역 (댓글 아래) */}
                            <div className="lg:hidden mx-5 mb-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 h-24 flex items-center justify-center">
                                <span className="text-[12px] font-medium text-gray-400">광고 영역</span>
                            </div>
                        </main>
                    </div>

                    {/* ─── 우측: 광고 사이드바 (lg:col-span-4, 모바일 hidden) ─── */}
                    <div className="hidden lg:block lg:col-span-4">
                        <div className="sticky top-8 space-y-4">
                            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 h-64 flex items-center justify-center shadow-sm">
                                <span className="text-[13px] font-medium text-gray-400">광고 영역</span>
                            </div>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 h-48 flex items-center justify-center shadow-sm">
                                <span className="text-[13px] font-medium text-gray-400">광고 영역 2</span>
                            </div>
                        </div>
                    </div>

                    </div>
                </div>
            </div>
        </>
    );
}
