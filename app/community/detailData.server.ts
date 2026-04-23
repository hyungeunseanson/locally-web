import 'server-only';

import type { CommunityBoard, CommunityHubFilter } from '@/app/types/community';
import { createPublicServerClient } from '@/app/utils/supabase/public-server';
import {
  isMissingAnonymousColumnError,
  isMissingCommunityBoardColumnError,
  isMissingCommunityModelColumnError,
} from './anonymousColumn';
import { getLegacyHubSeedForBoard, inferCommunityBoardFromLegacyHub } from './boardMeta';

export type CommunityDetailPostRow = {
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

export type CommunityDetailProfile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
} | null;

export type CommunityDetailExperience = {
  id: number;
  title: string;
  image_url: string;
  price: number;
} | null;

export type CommunityAdjacentPostRow = {
  id: string;
  title: string;
  created_at: string;
  destination_hub?: CommunityDetailPostRow['destination_hub'];
};

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

export async function getCommunityDetailPost(id: string) {
  const supabase = createPublicServerClient();

  const buildPostQuery = (selectClause: string) =>
    supabase.from('community_posts').select(selectClause).eq('id', id).maybeSingle();

  const initialPostResult = await buildPostQuery(COMMUNITY_DETAIL_POST_SELECT);
  let post = initialPostResult.data as unknown as CommunityDetailPostRow | null;
  let postError = initialPostResult.error;
  let usedPreBoardFallback = false;

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

  if (postError) {
    throw postError;
  }

  if (!post) {
    return {
      post: null,
      profile: null,
      linkedExperience: null,
      usedPreBoardFallback,
    };
  }

  const [profileResult, experienceResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', post.user_id)
      .maybeSingle(),
    post.linked_exp_id
      ? supabase
          .from('experiences')
          .select('id, title, image_url, price')
          .eq('id', post.linked_exp_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (experienceResult.error) {
    throw experienceResult.error;
  }

  return {
    post,
    profile: (profileResult.data ?? null) as CommunityDetailProfile,
    linkedExperience: (experienceResult.data ?? null) as CommunityDetailExperience,
    usedPreBoardFallback,
  };
}

export async function getAdjacentCommunityPosts({
  post,
  requestedBoard,
  usedPreBoardFallback,
  fallbackHub,
}: {
  post: CommunityDetailPostRow;
  requestedBoard: CommunityBoard | null;
  usedPreBoardFallback: boolean;
  fallbackHub: CommunityHubFilter;
}) {
  const supabase = createPublicServerClient();
  const boardContext = post.board_country ?? requestedBoard;
  const isBoardPost = Boolean(boardContext);

  const buildAdjacentQuery = async (direction: 'prev' | 'next') => {
    let query = supabase
      .from('community_posts')
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
      const result = await query
        .lt('created_at', post.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return result.data as unknown as CommunityAdjacentPostRow | null;
    }

    const result = await query
      .gt('created_at', post.created_at)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return result.data as unknown as CommunityAdjacentPostRow | null;
  };

  const [prevPost, nextPost] = await Promise.all([
    buildAdjacentQuery('prev'),
    buildAdjacentQuery('next'),
  ]);

  return {
    boardContext,
    prevPost,
    nextPost,
  };
}
