import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/app/utils/supabase/server';
import {
    buildCommunityFeedPosts,
    COMMUNITY_FEED_EXPERIENCE_SELECT,
    COMMUNITY_FEED_POST_SELECT,
    COMMUNITY_FEED_POST_SELECT_LEGACY,
    COMMUNITY_FEED_POST_SELECT_PRE_BOARD,
    COMMUNITY_FEED_PROFILE_SELECT,
    normalizeCommunityFeedPostRow,
    type CommunityFeedExperience,
    type CommunityFeedProfile,
    type CommunityFeedPostRow,
} from '@/app/community/feedSelect';
import {
    isMissingAnonymousColumnError,
    isMissingCommunityBoardColumnError,
    isMissingCommunityModelColumnError,
} from '@/app/community/anonymousColumn';
import { getLegacyHubSeedForBoard, resolveCommunityBoard } from '@/app/community/boardMeta';
import {
    canUseLegacyCommunityFeedFallback,
    resolvePublicCommunityFeedState,
    resolveCommunitySort,
} from '@/app/community/queryParams';

const PAGE_LIMIT = 15;

async function buildFeedResponse(postsData: CommunityFeedPostRow[] | null, supabase: Awaited<ReturnType<typeof createClient>>, offset: number) {
    if (!postsData || postsData.length === 0) {
        return NextResponse.json({ data: [], nextOffset: null });
    }

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

    const expIds = [...new Set(typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number'))];
    let typedExperiences: CommunityFeedExperience[] = [];
    if (expIds.length > 0) {
        const { data: experiences } = await supabase
            .from('experiences')
            .select(COMMUNITY_FEED_EXPERIENCE_SELECT)
            .in('id', expIds);
        typedExperiences = (experiences ?? []) as unknown as CommunityFeedExperience[];
    }

    const data = buildCommunityFeedPosts(typedPosts, typedProfiles, typedExperiences);
    const nextOffset = data.length === PAGE_LIMIT ? offset + PAGE_LIMIT : null;
    return NextResponse.json({ data, nextOffset });
}
async function handleBoardFeed(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const board = resolveCommunityBoard(searchParams.get('board'));
    const sort = resolveCommunitySort(searchParams.get('sort'));
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const buildQuery = (selectClause: string, useLegacyBoardFallback = false) => {
        let query = supabase
            .from('community_posts')
            .select(selectClause)
            .range(offset, offset + PAGE_LIMIT - 1);

        if (useLegacyBoardFallback) {
            query = query
                .eq('category', 'qna')
                .eq('destination_hub', getLegacyHubSeedForBoard(board));
        } else {
            query = query.eq('board_country', board);
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
    let postsData = (initialResult.data ?? null) as CommunityFeedPostRow[] | null;

    if (postsError && isMissingCommunityBoardColumnError(postsError)) {
        const preBoardResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_PRE_BOARD, true);
        postsError = preBoardResult.error;
        postsData = (preBoardResult.data ?? null) as CommunityFeedPostRow[] | null;
    }

    if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
        const legacyResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_LEGACY, true);
        postsError = legacyResult.error;
        postsData = ((legacyResult.data ?? []) as CommunityFeedPostRow[]).map((post) => normalizeCommunityFeedPostRow({
            ...post,
            is_anonymous: false,
        }));
    }

    if (postsError) {
        console.error('API Error fetching board community posts:', postsError);
        return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return buildFeedResponse(postsData, supabase, offset);
}

async function handleLegacyFeed(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const {
        category,
        hub,
        queryText,
        sort,
    } = resolvePublicCommunityFeedState({
        category: searchParams.get('category'),
        format: searchParams.get('format'),
        hub: searchParams.get('hub'),
        q: searchParams.get('q'),
        sort: searchParams.get('sort'),
    });
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const buildQuery = (selectClause: string) => {
        let query = supabase
            .from('community_posts')
            .select(selectClause)
            .range(offset, offset + PAGE_LIMIT - 1);

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
    let postsData = (initialResult.data ?? null) as CommunityFeedPostRow[] | null;

    if (postsError && isMissingCommunityBoardColumnError(postsError)) {
        const preBoardResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_PRE_BOARD);
        postsError = preBoardResult.error;
        postsData = (preBoardResult.data ?? null) as CommunityFeedPostRow[] | null;
    }

    if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
        if (!canUseLegacyCommunityFeedFallback(hub)) {
            postsData = [];
            postsError = null;
        } else {
            const legacyResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_LEGACY);
            postsData = ((legacyResult.data ?? []) as CommunityFeedPostRow[]).map((post) => normalizeCommunityFeedPostRow({
                ...post,
                is_anonymous: false,
            }));
            postsError = legacyResult.error;
        }
    }

    if (postsError) {
        console.error('API Error fetching legacy community posts:', postsError);
        return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return buildFeedResponse(postsData, supabase, offset);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const hasLegacyParams = ['category', 'format', 'hub', 'q'].some((key) => searchParams.has(key));

        if (!hasLegacyParams) {
            return handleBoardFeed(request);
        }

        return handleLegacyFeed(request);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
