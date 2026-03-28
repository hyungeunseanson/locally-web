import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import {
    buildCommunityFeedPosts,
    COMMUNITY_FEED_EXPERIENCE_SELECT,
    normalizeCommunityFeedPostRow,
    type CommunityFeedExperience,
    type CommunityFeedPostRow,
    COMMUNITY_FEED_POST_SELECT_LEGACY,
    COMMUNITY_FEED_POST_SELECT,
    COMMUNITY_FEED_PROFILE_SELECT,
    type CommunityFeedProfile,
} from '@/app/community/feedSelect';
import { isMissingAnonymousColumnError, isMissingCommunityModelColumnError } from '@/app/community/anonymousColumn';
import { getCommunityCategoryFromFormat } from '@/app/community/categoryMeta';
import { resolveCommunityCategory, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '@/app/community/queryParams';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const requestedCategory = resolveCommunityCategory(searchParams.get('category'));
        const format = resolveCommunityFormat(searchParams.get('format'), requestedCategory);
        const category = format === 'all' ? requestedCategory : getCommunityCategoryFromFormat(format);
        const hub = resolveCommunityHub(searchParams.get('hub'));
        const queryText = (searchParams.get('q') || '').trim().replace(/,/g, ' ');
        const sort = resolveCommunitySort(searchParams.get('sort'));
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const limit = 15;

        // ① community_posts 단독 조회 (join 없음 — join 에러로 전체 피드가 빈값이 되는 버그 방지)
        const buildQuery = (selectClause: string) => {
            let query = supabase
                .from('community_posts')
                .select(selectClause)
                .range(offset, offset + limit - 1);

            if (category && category !== 'all') {
                query = query.eq('category', category);
            }

            if (hub !== 'all') {
                query = query.eq('destination_hub', hub);
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

        if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
            const legacyResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_LEGACY);
            postsData = ((legacyResult.data ?? []) as unknown as CommunityFeedPostRow[]).map((post) => normalizeCommunityFeedPostRow({
                ...post,
                is_anonymous: false,
            }));
            postsError = legacyResult.error;
        }

        if (postsError) {
            console.error('API Error fetching community posts:', postsError);
            return NextResponse.json({ error: postsError.message }, { status: 500 });
        }

        if (!postsData || postsData.length === 0) {
            return NextResponse.json({ data: [], nextOffset: null });
        }

        // ② profiles 별도 조회 (실패해도 피드는 유지됨)
        const typedPosts = postsData.map((post) => normalizeCommunityFeedPostRow(post));
        const userIds = [...new Set(typedPosts.filter((post) => !post.is_anonymous).map((post) => post.user_id))];
        let typedProfiles: CommunityFeedProfile[] = [];
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select(COMMUNITY_FEED_PROFILE_SELECT)
                .in('id', userIds);
            typedProfiles = (profiles ?? []) as unknown as CommunityFeedProfile[];
        }

        // ③ experiences 별도 조회 (linked_exp_id가 있는 포스트만)
        const expIds = [...new Set(typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number'))];
        let typedExperiences: CommunityFeedExperience[] = [];
        if (expIds.length > 0) {
            const { data: experiences } = await supabase
                .from('experiences')
                .select(COMMUNITY_FEED_EXPERIENCE_SELECT)
                .in('id', expIds);
            typedExperiences = (experiences ?? []) as unknown as CommunityFeedExperience[];
        }

        // ④ 조립
        const data = buildCommunityFeedPosts(typedPosts, typedProfiles, typedExperiences);

        const nextOffset = data.length === limit ? offset + limit : null;

        return NextResponse.json({ data, nextOffset });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
