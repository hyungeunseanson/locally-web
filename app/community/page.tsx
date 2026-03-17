import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Edit3 } from 'lucide-react';

import { createClient } from '@/app/utils/supabase/server';
import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { getCurrentLocale } from '@/app/utils/locale';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import SiteHeader from '@/app/components/SiteHeader';
import type { CommunityCategory, CommunityHubFilter, CommunityPostFormatFilter } from '@/app/types/community';
import CommunityCategoryTabs from './components/CommunityCategoryTabs';
import CommunityFeed from './CommunityFeed';
import RightSidebar from './components/RightSidebar';
import MobileWidgetStrip from './components/MobileWidgetStrip';
import MobileSortBar from './components/MobileSortBar';
import CommunitySearchControls from './components/CommunitySearchControls';
import CommunityHubTabs from './components/CommunityHubTabs';
import { getCommunityCategoryFromFormat, getCommunityFormatFromCategory, getCommunityFormatMeta } from './categoryMeta';
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
import { buildCommunityListHref, resolveCommunityCategory, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from './queryParams';
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
    const currentHub = resolveCommunityHub(params?.hub as string);
    const currentFormat = resolveCommunityFormat(params?.format as string, params?.category as string);

    const hubTitle = currentHub !== 'all' ? getCommunityHubMeta(currentHub).label : '';
    const formatTitle = currentFormat !== 'all' ? getCommunityFormatMeta(currentFormat).label : '커뮤니티';
    const title = hubTitle
        ? `${hubTitle} ${formatTitle} - 커뮤니티`
        : currentFormat === 'all'
            ? '커뮤니티'
            : `${formatTitle} - 커뮤니티`;
    const description = hubTitle
        ? `${hubTitle} 여행자들이 묻고 답하는 Locally 도시 허브 커뮤니티`
        : '인스타그램에서 넘어온 여행자들이 도시별 질문, 동행, 실시간 팁을 이어보는 Locally 커뮤니티';
    const canonicalPath = '/community';
    const canonicalUrl = buildLocalizedAbsoluteUrl('ko', canonicalPath);

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
    const locale = await getCurrentLocale();
    const params = await searchParams;
    const { data: { user } } = await supabase.auth.getUser();

    const currentHub = resolveCommunityHub(params?.hub as string);
    const requestedCategory = resolveCommunityCategory(params?.category as string);
    const currentFormat = resolveCommunityFormat(params?.format as string, requestedCategory);
    const currentCategory = currentFormat === 'all' ? requestedCategory : getCommunityCategoryFromFormat(currentFormat);
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
        const userIds = [...new Set(typedPosts.map((post) => post.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select(COMMUNITY_FEED_PROFILE_SELECT)
            .in('id', userIds);
        const typedProfiles: CommunityFeedProfile[] = profiles ?? [];

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

    const [weeklyQuestions, companionPulse, locallyPicks] = queryText
        ? [[], [], []] as [CommunityHighlightPost[], CommunityHighlightPost[], CommunityHighlightPost[]]
        : await Promise.all([
            fetchHighlightPosts({ category: 'qna', sortMode: 'popular' }),
            fetchHighlightPosts({ category: 'companion', sortMode: 'latest' }),
            fetchHighlightPosts({ category: 'locally_content', sortMode: 'latest' }),
        ]);

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
    const showFloatingWriteCta = writeCategory !== 'locally_content' || canWriteLocallyContent;
    const activeHubMeta = currentHub !== 'all' ? getCommunityHubMeta(currentHub) : null;
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
                    <section className="mb-6 overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(255,241,244,0.86)_42%,_rgba(255,255,255,0.92)_100%)] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8">
                        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF385C]">Locally City Hubs</div>
                                <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em] text-slate-900 md:text-[40px]">
                                    릴스에서 보고 왔다면, 도시부터 고르세요.
                                </h1>
                                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
                                    인스타그램에서 본 도시 질문, 동행, 실시간 팁을 허브별로 바로 이어보는 커뮤니티입니다.
                                    {activeHubMeta ? ` 지금은 ${activeHubMeta.label} 허브를 보고 있습니다.` : ' 먼저 허브를 고르면 같은 도시의 맥락으로 질문과 답변이 모입니다.'}
                                </p>
                                <div className="mt-5 flex flex-wrap gap-2">
                                    <Link
                                        href={buildCommunityListHref({ hub: 'tokyo', format: 'question' })}
                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                                    >
                                        도쿄 질문 보기
                                    </Link>
                                    <Link
                                        href={buildCommunityListHref({ hub: 'osaka_kyoto', format: 'companion' })}
                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                                    >
                                        오사카·교토 동행 보기
                                    </Link>
                                    <Link
                                        href={buildCommunityListHref({ hub: 'fukuoka', format: 'live_tip' })}
                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                                    >
                                        후쿠오카 실시간 팁
                                    </Link>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">STEP 1</div>
                                    <div className="mt-2 text-[16px] font-semibold text-slate-900">허브 선택</div>
                                    <p className="mt-1 text-[13px] leading-6 text-slate-500">도쿄, 오사카·교토, 후쿠오카처럼 도시를 먼저 고릅니다.</p>
                                </div>
                                <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">STEP 2</div>
                                    <div className="mt-2 text-[16px] font-semibold text-slate-900">포맷 선택</div>
                                    <p className="mt-1 text-[13px] leading-6 text-slate-500">질문, 동행, 실시간 팁, 로컬리 픽 중 목적에 맞게 좁힙니다.</p>
                                </div>
                                <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">LANGUAGE</div>
                                    <div className="mt-2 text-[16px] font-semibold text-slate-900">
                                        원문 언어는 {locale === 'ja' ? '일본어' : locale === 'en' ? '영어' : locale === 'zh' ? '중국어' : '한국어'}로 시작
                                    </div>
                                    <p className="mt-1 text-[13px] leading-6 text-slate-500">기본 작성 언어를 현재 앱 언어에 맞춰 자동 제안합니다.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="col-span-1 lg:col-span-8">
                            <div className="mb-4">
                                <CommunityHubTabs />
                            </div>

                            <div className="mb-4">
                                <CommunityCategoryTabs />
                            </div>

                            <CommunitySearchControls
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
                            />
                        </div>
                    </div>
                </div>
            </div>

            {showFloatingWriteCta && (
                <Link
                    href={writeHref}
                    className="block lg:hidden fixed bottom-20 right-4 w-12 h-12 bg-[#FF385C] text-white rounded-full shadow-lg z-50 flex items-center justify-center hover:bg-[#e0314f] active:scale-95 transition-all"
                    aria-label="글쓰기"
                >
                    <Edit3 size={20} strokeWidth={2.5} />
                </Link>
            )}
        </>
    );
}
