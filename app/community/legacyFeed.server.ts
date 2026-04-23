import 'server-only';

import { createPublicServerClient } from '@/app/utils/supabase/public-server';
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
  type CommunityFeedResponse,
} from './feedSelect';
import {
  isMissingAnonymousColumnError,
  isMissingCommunityBoardColumnError,
  isMissingCommunityModelColumnError,
} from './anonymousColumn';
import {
  canUseLegacyCommunityFeedFallback,
  resolvePublicCommunityFeedState,
} from './legacyQueryParams';

const DEFAULT_LEGACY_PAGE_LIMIT = 15;

async function buildLegacyFeedResponse({
  postsData,
  offset,
  limit,
}: {
  postsData: CommunityFeedPostRow[] | null;
  offset: number;
  limit: number;
}): Promise<CommunityFeedResponse> {
  const supabase = createPublicServerClient();

  if (!postsData || postsData.length === 0) {
    return { data: [], nextOffset: null };
  }

  const typedPosts = postsData.map((post) => normalizeCommunityFeedPostRow(post));
  const userIds = [...new Set(typedPosts.filter((post) => !post.is_anonymous).map((post) => post.user_id))];
  const expIds = [
    ...new Set(typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number')),
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
  const data = buildCommunityFeedPosts(typedPosts, typedProfiles, typedExperiences);

  return {
    data,
    nextOffset: data.length === limit ? offset + limit : null,
  };
}

export async function fetchLegacyCommunityFeed(input: {
  category?: string | null;
  format?: string | null;
  hub?: string | null;
  q?: string | null;
  sort?: string | null;
  offset?: number;
  limit?: number;
}): Promise<CommunityFeedResponse> {
  const supabase = createPublicServerClient();
  const {
    category,
    hub,
    queryText,
    sort,
  } = resolvePublicCommunityFeedState({
    category: input.category,
    format: input.format,
    hub: input.hub,
    q: input.q,
    sort: input.sort,
  });
  const offset = input.offset ?? 0;
  const limit = input.limit ?? DEFAULT_LEGACY_PAGE_LIMIT;

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

  if (postsError && isMissingCommunityBoardColumnError(postsError)) {
    const preBoardResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_PRE_BOARD);
    postsError = preBoardResult.error;
    postsData = (preBoardResult.data ?? null) as unknown as CommunityFeedPostRow[] | null;
  }

  if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
    if (!canUseLegacyCommunityFeedFallback(hub)) {
      postsData = [];
      postsError = null;
    } else {
      const legacyResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_LEGACY);
      postsData = ((legacyResult.data ?? []) as unknown as CommunityFeedPostRow[]).map((post) =>
        normalizeCommunityFeedPostRow({
          ...post,
          is_anonymous: false,
        })
      );
      postsError = legacyResult.error;
    }
  }

  if (postsError) {
    throw postsError;
  }

  return buildLegacyFeedResponse({
    postsData,
    offset,
    limit,
  });
}
