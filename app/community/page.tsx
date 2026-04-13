import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Edit3, MessageCircle } from 'lucide-react';

import { createClient } from '@/app/utils/supabase/server';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import SiteHeader from '@/app/components/SiteHeader';
import type { CommunityCategory, CommunityHubFilter } from '@/app/types/community';
import CommunityCategoryTabs from './components/CommunityCategoryTabs';
import CommunityFeed from './CommunityFeed';
import RightSidebar from './components/RightSidebar';
import MobileWidgetStrip from './components/MobileWidgetStrip';
import MobileSortBar from './components/MobileSortBar';
import CommunitySearchControls from './components/CommunitySearchControls';
import CommunityHubTabs from './components/CommunityHubTabs';
import CommunityAdSlot from './components/CommunityAdSlot';
import { COMMUNITY_OPEN, getCommunityCategoryFromFormat, getCommunityFormatFromCategory, getCommunityFormatMeta } from './categoryMeta';
import { getCommunityHubMeta } from './hubMeta';
import {
    buildCommunityFeedPosts,
    COMMUNITY_FEED_EXPERIENCE_SELECT,
    COMMUNITY_FEED_POST_SELECT,
    COMMUNITY_FEED_POST_SELECT_LEGACY,
    COMMUNITY_FEED_PROFILE_SELECT,
    normalizeCommunityFeedPostRow,
    type CommunityFeedExperience,
    type CommunityFeedPost,
    type CommunityFeedPostRow,
    type CommunityFeedProfile,
} from './feedSelect';
import { isMissingAnonymousColumnError, isMissingCommunityModelColumnError } from './anonymousColumn';
import { resolveCommunityCategory, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from './queryParams';
import type { CommunityHighlightPost } from './highlights';

const COMMUNITY_HIGHLIGHT_SELECT = 'id, category, post_format, destination_hub, title, created_at';
const COMMUNITY_HIGHLIGHT_SELECT_LEGACY = 'id, category, title, created_at';

export const dynamic = 'force-dynamic';

type SearchParamMap = { [key: string]: string | string[] | undefined };

function normalizeHighlightPost(post: {
    id: string;
    category: CommunityCategory;
    post_format?: CommunityHighlightPost['post_format'];
    destination_hub?: CommunityHighlightPost['destination_hub'];
    title: string;
    created_at: string;
}): CommunityHighlightPost {
    return {
        id: post.id,
        title: post.title,
        category: post.category,
        post_format: post.post_format || getCommunityFormatFromCategory(post.category),
        destination_hub: post.destination_hub ?? null,
        created_at: post.created_at,
    };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParamMap> }): Promise<Metadata> {
    const params = await searchParams;
    const locale = await getCurrentLocale();
    const currentHub = resolveCommunityHub(params?.hub as string);
    const currentFormat = resolveCommunityFormat(params?.format as string, params?.category as string);

    const hubTitle = currentHub !== 'all' ? getCommunityHubMeta(currentHub).label : '';

    let title: string;
    let description: string;

    if (!COMMUNITY_OPEN) {
        title = hubTitle
            ? `${hubTitle} 로컬리 콘텐츠`
            : '로컬리 콘텐츠';
        description = hubTitle
            ? `${hubTitle} 여행에 대한 Locally 오리지널 콘텐츠 — 루트, 맛집, 현지 추천 정보를 확인하세요.`
            : '로컬이 직접 정리한 여행 콘텐츠 — 루트, 맛집, 현지 추천 정보를 확인하세요.';
    } else {
        const formatTitle = currentFormat !== 'all' ? getCommunityFormatMeta(currentFormat).label : '커뮤니티';
        title = hubTitle
            ? `${hubTitle} ${formatTitle} - 커뮤니티`
            : currentFormat === 'all'
                ? '커뮤니티'
                : `${formatTitle} - 커뮤니티`;
        description = hubTitle
            ? `${hubTitle} 여행자들이 묻고 답하는 Locally 도시 허브 커뮤니티`
            : '여행자들이 도시별 질문, 동행, 여행 꿀팁을 이어보는 Locally 커뮤니티';
    }
    const canonicalPath = '/community';
    const canonicalUrl = buildLocalizedAbsoluteUrl(locale, canonicalPath);

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        alternates: {
            canonical: canonicalUrl,
            languages: {
                ko: buildLocalizedAbsoluteUrl('ko', canonicalPath),
                en: buildLocalizedAbsoluteUrl('en', canonicalPath),
                ja: buildLocalizedAbsoluteUrl('ja', canonicalPath),
                zh: buildLocalizedAbsoluteUrl('zh', canonicalPath),
            },
        },
    };
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<SearchParamMap> }) {
    const supabase = await createClient();
    const params = await searchParams;
    const { data: { user } } = await supabase.auth.getUser();

    const currentHub = resolveCommunityHub(params?.hub as string);
    const requestedCategory = resolveCommunityCategory(params?.category as string);
    let currentFormat = resolveCommunityFormat(params?.format as string, requestedCategory);
    if (!COMMUNITY_OPEN && currentFormat !== 'locally_pick') {
        currentFormat = 'locally_pick';
    }
    const currentCategory = !COMMUNITY_OPEN ? 'locally_content' as CommunityCategory
        : currentFormat === 'all' ? requestedCategory : getCommunityCategoryFromFormat(currentFormat);
    const queryText = ((params?.q as string) || '').trim().replace(/,/g, ' ');
    const sort = resolveCommunitySort(params?.sort as string);
    const limit = 15;

    const buildPostsQuery = ({
        selectClause,
        category,
        hub,
        q,
        sortMode,
        offset = 0,
        queryLimit = limit,
    }: {
        selectClause: string;
        category: CommunityCategory | 'all';
        hub: CommunityHubFilter;
        q: string;
        sortMode: 'latest' | 'popular';
        offset?: number;
        queryLimit?: number;
    }) => {
        let query = supabase
            .from('community_posts')
            .select(selectClause)
            .range(offset, offset + queryLimit - 1);

        if (category !== 'all') {
            query = query.eq('category', category);
        }

        if (hub !== 'all') {
            query = query.eq('destination_hub', hub);
        }

        if (q) {
            query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
        }

        if (sortMode === 'popular') {
            query = query
                .order('like_count', { ascending: false })
                .order('comment_count', { ascending: false })
                .order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        return query;
    };

    const initialResult = await buildPostsQuery({
        selectClause: COMMUNITY_FEED_POST_SELECT,
        category: currentCategory,
        hub: currentHub,
        q: queryText,
        sortMode: sort,
    });

    let postsError = initialResult.error;
    let postsData = (initialResult.data ?? null) as unknown as CommunityFeedPostRow[] | null;

    if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
        const legacyResult = await buildPostsQuery({
            selectClause: COMMUNITY_FEED_POST_SELECT_LEGACY,
            category: currentCategory,
            hub: 'all',
            q: queryText,
            sortMode: sort,
        });
        postsData = ((legacyResult.data ?? []) as unknown as CommunityFeedPostRow[]).map((post) => normalizeCommunityFeedPostRow({
            ...post,
            is_anonymous: false,
        }));
        postsError = legacyResult.error;
    }

    if (postsError) {
        console.error('[CommunityPage] feed query failed:', postsError);
    }

    const typedPosts = (postsData ?? []).map((post) => normalizeCommunityFeedPostRow(post));

    let initialData: CommunityFeedPost[] = [];
    if (typedPosts.length > 0) {
        const userIds = [...new Set(typedPosts.filter((post) => !post.is_anonymous).map((post) => post.user_id))];
        let typedProfiles: CommunityFeedProfile[] = [];
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select(COMMUNITY_FEED_PROFILE_SELECT)
                .in('id', userIds);
            typedProfiles = profiles ?? [];
        }

        const expIds = [...new Set(typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number'))];
        let typedExperiences: CommunityFeedExperience[] = [];
        if (expIds.length > 0) {
            const { data: experiences } = await supabase
                .from('experiences')
                .select(COMMUNITY_FEED_EXPERIENCE_SELECT)
                .in('id', expIds);
            typedExperiences = experiences ?? [];
        }

        initialData = buildCommunityFeedPosts(typedPosts, typedProfiles, typedExperiences);
    }

    const initialNextOffset = typedPosts.length === limit ? limit : null;

    const fetchHighlightPosts = async ({
        category,
        sortMode,
    }: {
        category: CommunityCategory;
        sortMode: 'latest' | 'popular';
    }): Promise<CommunityHighlightPost[]> => {
        const result = await buildPostsQuery({
            selectClause: COMMUNITY_HIGHLIGHT_SELECT,
            category,
            hub: currentHub,
            q: '',
            sortMode,
            queryLimit: 3,
        });

        if (!result.error) {
            return ((result.data ?? []) as unknown as Array<{
                id: string;
                category: CommunityCategory;
                post_format?: CommunityHighlightPost['post_format'];
                destination_hub?: CommunityHighlightPost['destination_hub'];
                title: string;
                created_at: string;
            }>).map((post) => normalizeHighlightPost(post));
        }

        if (!(isMissingAnonymousColumnError(result.error) || isMissingCommunityModelColumnError(result.error))) {
            console.error('[CommunityPage] highlight query failed:', result.error);
            return [];
        }

        const legacyResult = await buildPostsQuery({
            selectClause: COMMUNITY_HIGHLIGHT_SELECT_LEGACY,
            category,
            hub: 'all',
            q: '',
            sortMode,
            queryLimit: 3,
        });

        if (legacyResult.error) {
            console.error('[CommunityPage] legacy highlight query failed:', legacyResult.error);
            return [];
        }

        return ((legacyResult.data ?? []) as unknown as Array<{
            id: string;
            category: CommunityCategory;
            title: string;
            created_at: string;
        }>).map((post) => normalizeHighlightPost(post));
    };

    let weeklyQuestions: CommunityHighlightPost[] = [];
    let companionPulse: CommunityHighlightPost[] = [];
    let locallyPicks: CommunityHighlightPost[] = [];
    if (!queryText) {
        if (COMMUNITY_OPEN) {
            [weeklyQuestions, companionPulse, locallyPicks] = await Promise.all([
                fetchHighlightPosts({ category: 'qna', sortMode: 'popular' }),
                fetchHighlightPosts({ category: 'companion', sortMode: 'latest' }),
                fetchHighlightPosts({ category: 'locally_content', sortMode: 'latest' }),
            ]);
        } else {
            locallyPicks = await fetchHighlightPosts({ category: 'locally_content', sortMode: 'latest' });
        }
    }

    let canWriteLocallyContent = false;
    if (user) {
        const adminAccess = await resolveAdminAccess(supabase, {
            userId: user.id,
            email: user.email,
        });
        canWriteLocallyContent = adminAccess.isAdmin;
    }

    const writeCategory = currentFormat === 'all'
        ? (currentCategory === 'all' ? 'qna' : currentCategory)
        : getCommunityCategoryFromFormat(currentFormat);
    const showFloatingWriteCta = COMMUNITY_OPEN
        ? (writeCategory !== 'locally_content' || canWriteLocallyContent)
        : canWriteLocallyContent;
    const showContentAds = !COMMUNITY_OPEN;
    const writeParams = new URLSearchParams();
    writeParams.set('category', writeCategory);
    if (currentHub !== 'all') writeParams.set('hub', currentHub);
    if (currentFormat !== 'all') writeParams.set('format', currentFormat);
    const writeHref = `/community/write?${writeParams.toString()}`;

    return (
        <>
            <SiteHeader />
            <div className="min-h-screen bg-[#F7F7F9]">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="col-span-1 lg:col-span-8">
                            <div className="mb-4">
                                <CommunityHubTabs />
                            </div>

                            {!COMMUNITY_OPEN && (
                                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:px-5 md:py-4 shadow-sm">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 md:h-10 md:w-10">
                                        <MessageCircle size={18} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-semibold text-slate-800 md:text-[14px]">로컬리 콘텐츠 허브 운영 중</p>
                                        <p className="text-[11px] text-slate-500 md:text-[13px]">도시별 루트, 맛집, 현지 추천 콘텐츠를 먼저 공개하고 있습니다.</p>
                                    </div>
                                </div>
                            )}

                            <div className="mb-4">
                                <CommunityCategoryTabs />
                            </div>

                            <CommunitySearchControls
                                key={`${currentHub}:${currentFormat}:${queryText}:${sort}`}
                                currentHub={currentHub}
                                currentFormat={currentFormat}
                                currentQuery={queryText}
                                currentSort={sort}
                            />

                            {!queryText && (
                                <MobileWidgetStrip
                                    weeklyQuestions={weeklyQuestions}
                                    companionPulse={companionPulse}
                                    locallyPicks={locallyPicks}
                                />
                            )}

                            <MobileSortBar
                                currentHub={currentHub}
                                currentFormat={currentFormat}
                                currentQuery={queryText}
                                currentSort={sort}
                            />

                            <CommunityFeed
                                initialData={initialData}
                                initialNextOffset={initialNextOffset}
                                hub={currentHub}
                                format={currentFormat}
                                query={queryText}
                                sort={sort}
                                canWriteLocallyContent={canWriteLocallyContent}
                            />

                            {showContentAds && (
                                <div className="mt-6">
                                    <CommunityAdSlot
                                        testId="community-list-bottom-ad"
                                        variant="bottom"
                                        title="로컬리 콘텐츠 광고"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="col-span-1 lg:col-span-4 hidden lg:flex flex-col">
                            <RightSidebar
                                category={writeCategory}
                                hub={currentHub}
                                format={currentFormat}
                                canWriteLocallyContent={canWriteLocallyContent}
                                weeklyQuestions={weeklyQuestions}
                                companionPulse={companionPulse}
                                locallyPicks={locallyPicks}
                                footerSlot={showContentAds ? (
                                    <CommunityAdSlot
                                        testId="community-list-sidebar-ad"
                                        variant="sidebar"
                                        title="로컬리 콘텐츠 광고"
                                    />
                                ) : null}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {showFloatingWriteCta && (
                <Link
                    href={writeHref}
                    className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition-all hover:bg-black active:scale-95 lg:hidden"
                    aria-label={!COMMUNITY_OPEN ? '로컬리 콘텐츠 작성' : '글쓰기'}
                >
                    <Edit3 size={20} strokeWidth={2.5} />
                </Link>
            )}
        </>
    );
}
