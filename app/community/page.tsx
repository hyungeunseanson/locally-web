import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import CommunityCategoryTabs from './components/CommunityCategoryTabs';
import CommunityFeed from './CommunityFeed';
import RightSidebar from './components/RightSidebar';
import MobileWidgetStrip from './components/MobileWidgetStrip';
import MobileSortBar from './components/MobileSortBar';
import CommunitySearchControls from './components/CommunitySearchControls';
import SiteHeader from '@/app/components/SiteHeader';
import { Edit3 } from 'lucide-react';
import Link from 'next/link';
import type { CommunityCategory, CommunityFilterCategory } from '@/app/types/community';
import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
    buildCommunityFeedPosts,
    COMMUNITY_FEED_EXPERIENCE_SELECT,
    type CommunityFeedExperience,
    type CommunityFeedPost,
    type CommunityFeedPostRow,
    COMMUNITY_FEED_POST_SELECT_LEGACY,
    COMMUNITY_FEED_POST_SELECT,
    COMMUNITY_FEED_PROFILE_SELECT,
    type CommunityFeedProfile,
} from './feedSelect';
import { isMissingAnonymousColumnError } from './anonymousColumn';

// ✅ Vercel 엣지 캐시 비활성화 — 새 글 등록 후 피드가 구 버전 캐시를 서빙하는 버그 방지
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
    const params = await searchParams;
    const categoryQuery = params?.category as string;

    let title = '커뮤니티';
    if (categoryQuery === 'qna') title = '질문과 답변 - 커뮤니티';
    else if (categoryQuery === 'companion') title = '동행 찾기 - 커뮤니티';
    else if (categoryQuery === 'info') title = '여행 꿀팁 - 커뮤니티';
    else if (categoryQuery === 'locally_content') title = '로컬리 콘텐츠 - 커뮤니티';

    const description = '현지인과 여행자들이 생생한 정보를 나누고 동행을 구하는 로컬리 커뮤니티';
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

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const supabase = await createClient();
    const params = await searchParams;
    const { data: { user } } = await supabase.auth.getUser();

    // 기본 디폴트 탭 (값이 없거나 이상하면 qna)
    let category = (params?.category as string) || 'all';
    if (!['all', 'qna', 'companion', 'info', 'locally_content'].includes(category)) {
        category = 'all';
    }
    const queryText = ((params?.q as string) || '').trim().replace(/,/g, ' ');
    const sort = (params?.sort as string) === 'popular' ? 'popular' : 'latest';

    const limit = 15;

    // ① community_posts 단독 조회 (join 에러로 initialData가 빈값→피드 공백 버그 방지)
    const buildQuery = (selectClause: string) => {
        let query = supabase
            .from('community_posts')
            .select(selectClause)
            .range(0, limit - 1);

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        if (queryText) {
            query = query.or(`title.ilike.%${queryText}%,content.ilike.%${queryText}%`);
        }

        if (sort === 'popular') {
            query = query
                .order('like_count', { ascending: false })
                .order('comment_count', { ascending: false })
                .order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        return query;
    };

    const initialResult = await buildQuery(COMMUNITY_FEED_POST_SELECT);
    let postsError = initialResult.error;
    let postsData = (initialResult.data ?? null) as unknown as CommunityFeedPostRow[] | null;

    if (postsError && isMissingAnonymousColumnError(postsError)) {
        const legacyResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_LEGACY);
        postsData = ((legacyResult.data ?? []) as unknown as CommunityFeedPostRow[]).map((post) => ({
            ...post,
            is_anonymous: false,
        }));
        postsError = legacyResult.error;
    }

    if (postsError) {
        console.error('[CommunityPage] feed query failed:', postsError);
    }

    const typedPosts = postsData ?? [];

    // ② profiles 별도 조회 (실패해도 피드 유지)
    let initialData: CommunityFeedPost[] = [];
    if (typedPosts.length > 0) {
        const userIds = [...new Set(typedPosts.map((post) => post.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select(COMMUNITY_FEED_PROFILE_SELECT)
            .in('id', userIds);
        const typedProfiles: CommunityFeedProfile[] = profiles ?? [];

        // ③ experiences 조건부 조회
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

    const writeCategory = category === 'all' ? 'qna' : category;
    let canWriteLocallyContent = false;

    if (user) {
        const adminAccess = await resolveAdminAccess(supabase, {
            userId: user.id,
            email: user.email,
        });
        canWriteLocallyContent = adminAccess.isAdmin;
    }

    const showFloatingWriteCta = category !== 'locally_content' || canWriteLocallyContent;

    return (
        <>
            <SiteHeader />
            {/* 페이지 배경 */}
            <div className="min-h-screen bg-[#F7F7F9]">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* 반응형 2단 그리드: 좌측 8칸 + 우측 4칸 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* ─── 좌측 메인 피드 (8/12) ─── */}
                        <div className="col-span-1 lg:col-span-8">
                            {/* 상단 헤더: 카테고리 탭 */}
                            <div className="mb-4">
                                <CommunityCategoryTabs />
                            </div>

                            <CommunitySearchControls
                                currentCategory={category as CommunityFilterCategory}
                                currentQuery={queryText}
                                currentSort={sort}
                            />

                            {/* 모바일 전용 위젯 스트립: 실시간 업데이트 + 지금 뜨는 라운지 글 */}
                            {category !== 'locally_content' && (
                                <MobileWidgetStrip />
                            )}

                            {/* 모바일 전용 정렬 버튼 (위젯 아래, 피드 위) */}
                            <MobileSortBar
                                currentCategory={category}
                                currentQuery={queryText}
                                currentSort={sort}
                            />

                            {/* 피드 */}
                            <CommunityFeed
                                initialData={initialData || []}
                                initialNextOffset={initialNextOffset}
                                category={category}
                                query={queryText}
                                sort={sort}
                                canWriteLocallyContent={canWriteLocallyContent}
                            />
                        </div>

                        {/* ─── 우측 사이드바 (4/12, 모바일 hidden) ─── */}
                        <div className="col-span-1 lg:col-span-4 hidden lg:flex flex-col">
                            <RightSidebar
                                category={writeCategory as CommunityCategory}
                                canWriteLocallyContent={canWriteLocallyContent}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {showFloatingWriteCta && (
                <Link
                    href={`/community/write?category=${writeCategory}`}
                    className="block lg:hidden fixed bottom-20 right-4 w-12 h-12 bg-[#FF385C] text-white rounded-full shadow-lg z-50 flex items-center justify-center hover:bg-[#e0314f] active:scale-95 transition-all"
                    aria-label="글쓰기"
                >
                    <Edit3 size={20} strokeWidth={2.5} />
                </Link>
            )}
        </>
    );
}
