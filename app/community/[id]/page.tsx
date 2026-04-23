/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, CalendarCheck } from 'lucide-react';
import LinkedExperienceChip from '../components/LinkedExperienceChip';
import PostImages from '../components/PostImages';
import CommunityCommentsPanel from '../components/CommunityCommentsPanel';
import CommunityAdSlot from '../components/CommunityAdSlot';
import BackButton from '../components/BackButton';
import ShareButton from '../components/ShareButton';
import SiteHeader from '@/app/components/SiteHeader';
import CommunityAuthorTrigger from '../components/CommunityAuthorTrigger';
import JsonLd from '@/app/components/seo/JsonLd';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { buildBreadcrumbJsonLd, buildCommunityArticleJsonLd } from '@/app/utils/structuredData';
import { getCommunityAuthorAvatar, getCommunityAuthorInitial, getCommunityAuthorName } from '../authorDisplay';
import { getCommunityCategoryMeta, isLocallyContentCategory } from '../categoryMeta';
import { getLegacyHubSeedForBoard, inferCommunityBoardFromLegacyHub, resolveCommunityBoard } from '../boardMeta';
import { getCommunityHubMeta } from '../hubMeta';
import { getCommunityCategoryFromFormat } from '../categoryMeta';
import {
    isMissingAnonymousColumnError,
    isMissingCommunityBoardColumnError,
    isMissingCommunityModelColumnError,
} from '../anonymousColumn';
import { buildCommunityBoardDetailHref, buildCommunityBoardListHref, resolveCommunityCategory, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '../queryParams';

// Community detail avatars render stored public profile URLs directly and keep server-rendered article markup free of image transforms.
type CommunityDetailPostRow = {
    id: string;
    user_id: string;
    category: 'qna' | 'companion' | 'info' | 'locally_content';
    destination_hub: 'tokyo' | 'osaka_kyoto' | 'fukuoka' | 'jp_other' | 'seoul' | 'busan' | 'jeju' | null;
    board_country: 'japan' | 'korea' | null;
    title: string;
    content: string;
    images: string[] | null;
    is_anonymous: boolean;
    companion_date: string | null;
    companion_city: string | null;
    linked_exp_id: number | null;
    view_count: number | null;
    like_count: number | null;
    comment_count: number | null;
    created_at: string;
    updated_at: string | null;
};
type CommunityDetailPreBoardPostRow = Omit<CommunityDetailPostRow, 'board_country'>;
type CommunityDetailLegacyPostRow = Omit<CommunityDetailPostRow, 'destination_hub' | 'is_anonymous' | 'board_country'>;

const COMMUNITY_DETAIL_POST_SELECT = [
    'id',
    'user_id',
    'category',
    'destination_hub',
    'board_country',
    'title',
    'content',
    'images',
    'is_anonymous',
    'companion_date',
    'companion_city',
    'linked_exp_id',
    'view_count',
    'like_count',
    'comment_count',
    'created_at',
    'updated_at',
].join(', ');
const COMMUNITY_DETAIL_POST_SELECT_PRE_BOARD = [
    'id',
    'user_id',
    'category',
    'destination_hub',
    'title',
    'content',
    'images',
    'is_anonymous',
    'companion_date',
    'companion_city',
    'linked_exp_id',
    'view_count',
    'like_count',
    'comment_count',
    'created_at',
    'updated_at',
].join(', ');
const COMMUNITY_DETAIL_POST_SELECT_LEGACY = [
    'id',
    'user_id',
    'category',
    'title',
    'content',
    'images',
    'companion_date',
    'companion_city',
    'linked_exp_id',
    'view_count',
    'like_count',
    'comment_count',
    'created_at',
    'updated_at',
].join(', ');

// 🚀 Dynamic Metadata (SSR SEO)
export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
    const { id } = await params;
    const detailSearchParams = await searchParams;
    const locale = await getCurrentLocale();
    const supabase = await createClient();
    const initialResult = await supabase
        .from('community_posts')
        .select('title, content, images, category, board_country, destination_hub')
        .eq('id', id)
        .maybeSingle();
    let post = initialResult.data as {
        title: string;
        content: string;
        images: string[] | null;
        category: 'qna' | 'companion' | 'info' | 'locally_content';
        board_country?: 'japan' | 'korea' | null;
        destination_hub?: 'tokyo' | 'osaka_kyoto' | 'fukuoka' | 'jp_other' | 'seoul' | 'busan' | 'jeju' | null;
    } | null;

    if (initialResult.error && isMissingCommunityBoardColumnError(initialResult.error)) {
        const preBoardResult = await supabase
            .from('community_posts')
            .select('title, content, images, category, destination_hub')
            .eq('id', id)
            .maybeSingle();
        post = preBoardResult.data
            ? {
                ...preBoardResult.data,
                board_country: inferCommunityBoardFromLegacyHub(preBoardResult.data.destination_hub),
              }
            : null;
    }

    if (!post) {
        return { title: '게시글을 찾을 수 없습니다' };
    }

    const cleaned = post.content.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const snippet = cleaned.substring(0, 160) + (cleaned.length > 160 ? '…' : '');
    const defaultImage = post.images && post.images.length > 0 ? post.images[0] : buildAbsoluteUrl('/images/logo.png');
    const pagePath = `/community/${id}`;
    const canonicalUrl = buildLocalizedAbsoluteUrl(locale, pagePath);
    const requestedBoard = typeof detailSearchParams?.board === 'string'
        ? resolveCommunityBoard(detailSearchParams.board as string)
        : null;
    const boardContext = post.board_country ?? requestedBoard;
    const isSearchIndexable = Boolean(boardContext) || isLocallyContentCategory(post.category);
    const communitySurfaceLabel = 'Locally 커뮤니티';

    let prefix = '';
    if (!boardContext) {
        if (post.category === 'qna') prefix = '[Q&A] ';
        else if (post.category === 'companion') prefix = '[동행] ';
    }

    return {
        title: `${prefix}${post.title}`,
        description: snippet,
        openGraph: {
            title: `${prefix}${post.title} | ${communitySurfaceLabel}`,
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
        robots: isSearchIndexable ? undefined : {
            index: false,
            follow: false,
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
    const fallbackSort = resolveCommunitySort(detailSearchParams?.sort as string);
    const requestedBoard = typeof detailSearchParams?.board === 'string'
        ? resolveCommunityBoard(detailSearchParams.board as string)
        : null;
    let usedPreBoardFallback = false;

    // ① post 단독 조회 (SSR Join 분리 원칙)
    const buildPostQuery = (selectClause: string) => supabase
        .from('community_posts')
        .select(selectClause)
        .eq('id', id)
        .maybeSingle();

    const initialPostResult = await buildPostQuery(COMMUNITY_DETAIL_POST_SELECT);
    let post = initialPostResult.data as CommunityDetailPostRow | null;
    let postError = initialPostResult.error;

    if (postError && isMissingCommunityBoardColumnError(postError)) {
        const preBoardResult = await buildPostQuery(COMMUNITY_DETAIL_POST_SELECT_PRE_BOARD);
        const preBoardPost = preBoardResult.data as unknown as CommunityDetailPreBoardPostRow | null;
        post = preBoardPost
            ? {
                ...preBoardPost,
                board_country: inferCommunityBoardFromLegacyHub(preBoardPost.destination_hub),
            }
            : null;
        postError = preBoardResult.error;
        usedPreBoardFallback = true;
    }

    if (postError && (isMissingAnonymousColumnError(postError) || isMissingCommunityModelColumnError(postError))) {
        const legacyPostResult = await buildPostQuery(COMMUNITY_DETAIL_POST_SELECT_LEGACY);
        const legacyPost = legacyPostResult.data as unknown as CommunityDetailLegacyPostRow | null;
        post = legacyPost
            ? {
                ...legacyPost,
                destination_hub: null,
                board_country: null,
                is_anonymous: false,
            }
            : null;
        postError = legacyPostResult.error;
    }

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
    const isCompanion = post.category === 'companion';
    const isLocallyContent = isLocallyContentCategory(post.category);
    const boardContext = post.board_country ?? requestedBoard;
    const isBoardPost = Boolean(boardContext);
    const isSearchIndexable = isBoardPost || isLocallyContent;
    const authorName = getCommunityAuthorName(profile, post.is_anonymous);
    const authorInitial = getCommunityAuthorInitial(profile, post.is_anonymous);
    const authorAvatar = getCommunityAuthorAvatar(profile, post.is_anonymous);
    const authorProfileUrl = !post.is_anonymous && post.user_id
        ? buildAbsoluteUrl(`/users/${post.user_id}`)
        : null;
    const categoryMeta = getCommunityCategoryMeta(post.category);
    const hubMeta = post.destination_hub ? getCommunityHubMeta(post.destination_hub) : null;
    const pageUrl = buildAbsoluteUrl(`/community/${id}`);
    const articleDescription = post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '');
    const articleImage = post.images && post.images.length > 0 ? post.images[0] : buildAbsoluteUrl('/images/logo.png');
    const hasVisibleUpdatedAt = Boolean(
        post.updated_at
        && post.created_at
        && new Date(post.updated_at).getTime() > new Date(post.created_at).getTime()
    );
    const fallbackHub = resolveCommunityHub(detailSearchParams?.hub as string);
    const fallbackRequestedCategory = resolveCommunityCategory((detailSearchParams?.category as string) || post.category);
    const fallbackFormat = resolveCommunityFormat(
        detailSearchParams?.format as string,
        fallbackRequestedCategory === 'all' ? post.category : fallbackRequestedCategory
    );
    const fallbackParams = new URLSearchParams();
    if (fallbackHub !== 'all') fallbackParams.set('hub', fallbackHub);
    if (fallbackFormat !== 'all') {
        fallbackParams.set('format', fallbackFormat);
        fallbackParams.set('category', getCommunityCategoryFromFormat(fallbackFormat));
    } else if ((detailSearchParams?.category as string) || post.category) {
        fallbackParams.set('category', (detailSearchParams?.category as string) || post.category);
    }
    const fallbackQuery = ((detailSearchParams?.q as string) || '').trim();
    if (fallbackQuery) fallbackParams.set('q', fallbackQuery);
    if (fallbackSort !== 'latest') fallbackParams.set('sort', fallbackSort);
    const fallbackHref = isBoardPost && boardContext
        ? buildCommunityBoardListHref({ board: boardContext, sort: fallbackSort })
        : '/community';

    const buildAdjacentQuery = (direction: 'prev' | 'next') => {
        let query = supabase.from('community_posts')
            .select(usedPreBoardFallback ? 'id, title, created_at, destination_hub' : 'id, title, created_at');

        if (isBoardPost && boardContext) {
            if (usedPreBoardFallback) {
                query = query
                    .eq('category', 'qna')
                    .eq('destination_hub', getLegacyHubSeedForBoard(boardContext));
            } else {
                query = query.eq('board_country', boardContext);
            }
        } else {
            query = query.eq('category', post.category);
        }

        if (!isBoardPost && fallbackHub !== 'all' && post.destination_hub) {
            query = query.eq('destination_hub', post.destination_hub);
        }

        if (direction === 'prev') {
            return query
                .lt('created_at', post.created_at)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
        }

        return query
            .gt('created_at', post.created_at)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
    };

    const [{ data: prevPost }, { data: nextPost }] = await Promise.all([
        buildAdjacentQuery('prev'),
        buildAdjacentQuery('next'),
    ]);

    return (
        <>
            <JsonLd
                data={[
                    ...(isSearchIndexable ? [
                        buildCommunityArticleJsonLd({
                            title: post.title,
                            description: articleDescription,
                            url: pageUrl,
                            imageUrl: articleImage,
                            authorName,
                            authorUrl: authorProfileUrl,
                            datePublished: post.created_at,
                            dateModified: post.updated_at,
                            section: post.category,
                        }),
                    ] : []),
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
                                        <PostImages images={post.images} detail hero title={post.title} />
                                    </div>
                                )}

                                {!isBoardPost && (
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${categoryMeta.detailChipClassName}`}>
                                            {categoryMeta.shortLabel}
                                        </span>
                                        {hubMeta && (
                                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600">
                                                {hubMeta.label}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <h1 className="mb-4 break-words text-[18px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] md:text-[24px]">
                                    {post.title}
                                </h1>

                                <div className="mb-5">
                                    <CommunityAuthorTrigger
                                        userId={post.is_anonymous ? null : post.user_id}
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
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-400 md:text-[12px]">
                                                    <span>{getTimeString(post.created_at)}</span>
                                                    {hasVisibleUpdatedAt && (
                                                        <span data-testid="community-detail-updated-at">
                                                            수정됨 {getTimeString(post.updated_at || post.created_at)}
                                                        </span>
                                                    )}
                                                </div>
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
                                        <PostImages images={post.images} detail title={post.title} />
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
                                key={post.id}
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
                                            href={isBoardPost && boardContext
                                                ? buildCommunityBoardDetailHref(prevPost.id, { board: boardContext, sort: fallbackSort })
                                                : `/community/${prevPost.id}`}
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
                                            href={isBoardPost && boardContext
                                                ? buildCommunityBoardDetailHref(nextPost.id, { board: boardContext, sort: fallbackSort })
                                                : `/community/${nextPost.id}`}
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

                            {(isBoardPost || isLocallyContent) && (
                                <div className="mx-5 mb-6">
                                    <CommunityAdSlot
                                        testId="community-detail-bottom-ad"
                                        variant="bottom"
                                        placement="community-detail-bottom"
                                        title="로컬리 커뮤니티 광고"
                                    />
                                </div>
                            )}
                        </main>
                    </div>

                    </div>
                </div>
            </div>
        </>
    );
}
