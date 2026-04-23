import 'server-only';

import { unstable_cache } from 'next/cache';

import type { CommunityBoard } from '@/app/types/community';
import { createPublicServerClient } from '@/app/utils/supabase/public-server';
import {
  buildCommunityBoardFeedPosts,
  COMMUNITY_BOARD_FEED_POST_SELECT,
  COMMUNITY_BOARD_FEED_POST_SELECT_LEGACY,
  COMMUNITY_BOARD_FEED_POST_SELECT_PRE_BOARD,
  COMMUNITY_FEED_EXPERIENCE_SELECT,
  COMMUNITY_FEED_PROFILE_SELECT,
  normalizeCommunityBoardFeedPostRow,
  type CommunityBoardFeedPostRow,
  type CommunityFeedExperience,
  type CommunityFeedProfile,
  type CommunityFeedResponse,
} from './feedSelect';
import {
  isMissingAnonymousColumnError,
  isMissingCommunityBoardColumnError,
  isMissingCommunityModelColumnError,
} from './anonymousColumn';
import { getLegacyHubSeedForBoard } from './boardMeta';
import type { CommunitySort } from './queryParams';

const DEFAULT_BOARD_PAGE_LIMIT = 15;
const COMMUNITY_BOARD_FEED_REVALIDATE_SECONDS = 60;

function createBoardQuery({
  board,
  sort,
  offset,
  limit,
  selectClause,
  useLegacyBoardFallback = false,
}: {
  board: CommunityBoard;
  sort: CommunitySort;
  offset: number;
  limit: number;
  selectClause: string;
  useLegacyBoardFallback?: boolean;
}) {
  const supabase = createPublicServerClient();
  let query = supabase
    .from('community_posts')
    .select(selectClause)
    .range(offset, offset + limit - 1);

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
}

async function fetchCommunityBoardFeedUncached({
  board,
  sort,
  offset = 0,
  limit = DEFAULT_BOARD_PAGE_LIMIT,
}: {
  board: CommunityBoard;
  sort: CommunitySort;
  offset?: number;
  limit?: number;
}): Promise<CommunityFeedResponse> {
  const supabase = createPublicServerClient();

  const initialResult = await createBoardQuery({
    board,
    sort,
    offset,
    limit,
    selectClause: COMMUNITY_BOARD_FEED_POST_SELECT,
  });
  let postsError = initialResult.error;
  let postsData = (initialResult.data ?? null) as unknown as CommunityBoardFeedPostRow[] | null;

  if (postsError && isMissingCommunityBoardColumnError(postsError)) {
    const preBoardResult = await createBoardQuery({
      board,
      sort,
      offset,
      limit,
      selectClause: COMMUNITY_BOARD_FEED_POST_SELECT_PRE_BOARD,
      useLegacyBoardFallback: true,
    });
    postsError = preBoardResult.error;
    postsData = (preBoardResult.data ?? null) as unknown as CommunityBoardFeedPostRow[] | null;
  }

  if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
    const legacyResult = await createBoardQuery({
      board,
      sort,
      offset,
      limit,
      selectClause: COMMUNITY_BOARD_FEED_POST_SELECT_LEGACY,
      useLegacyBoardFallback: true,
    });
    postsError = legacyResult.error;
    postsData = ((legacyResult.data ?? []) as unknown as CommunityBoardFeedPostRow[]).map((post) =>
      normalizeCommunityBoardFeedPostRow({
        ...post,
        is_anonymous: false,
      })
    );
  }

  if (postsError) {
    throw postsError;
  }

  const typedPosts = (postsData ?? []).map((post) => normalizeCommunityBoardFeedPostRow(post));
  if (typedPosts.length === 0) {
    return { data: [], nextOffset: null };
  }

  const userIds = [...new Set(typedPosts.filter((post) => !post.is_anonymous).map((post) => post.user_id))];
  const expIds = [
    ...new Set(
      typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number')
    ),
  ];

  const [profilesResult, experiencesResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select(COMMUNITY_FEED_PROFILE_SELECT).in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    expIds.length > 0
      ? supabase.from('experiences').select(COMMUNITY_FEED_EXPERIENCE_SELECT).in('id', expIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (experiencesResult.error) {
    throw experiencesResult.error;
  }

  const typedProfiles = (profilesResult.data ?? []) as unknown as CommunityFeedProfile[];
  const typedExperiences = (experiencesResult.data ?? []) as unknown as CommunityFeedExperience[];
  const data = buildCommunityBoardFeedPosts(typedPosts, typedProfiles, typedExperiences);

  return {
    data,
    nextOffset: typedPosts.length === limit ? offset + limit : null,
  };
}

export async function fetchCommunityBoardFeed({
  board,
  sort,
  offset = 0,
  limit = DEFAULT_BOARD_PAGE_LIMIT,
}: {
  board: CommunityBoard;
  sort: CommunitySort;
  offset?: number;
  limit?: number;
}): Promise<CommunityFeedResponse> {
  if (process.env.NODE_ENV !== 'production') {
    return fetchCommunityBoardFeedUncached({ board, sort, offset, limit });
  }

  return unstable_cache(
    () => fetchCommunityBoardFeedUncached({ board, sort, offset, limit }),
    ['community-board-feed', board, sort, String(offset), String(limit)],
    {
      revalidate: COMMUNITY_BOARD_FEED_REVALIDATE_SECONDS,
      tags: ['community-board-feed', `community-board-feed-${board}`],
    }
  )();
}
