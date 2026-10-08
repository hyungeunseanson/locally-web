import 'server-only';

import { unstable_cache } from 'next/cache';

import type { CommunityBoard, CommunityHubFilter } from '@/app/types/community';
import { createPublicServerClient } from '@/app/utils/supabase/public-server';
import {
  COMMUNITY_FEED_LINKED_EXPERIENCE_SELECT,
  filterVisibleCommunityLinkedExperiences,
  type CommunityFeedLinkedExperienceRow,
} from './feedSelect';
import { getLegacyHubSeedForBoard } from './boardMeta';
import { getMissingCommunityCompatibilityColumn, normalizeCommunityPost } from './indexability';

export type CommunityDetailPostRow = {
  id: string;
  user_id: string;
  category: 'qna' | 'companion' | 'info' | 'locally_content';
  destination_hub: 'tokyo' | 'osaka_kyoto' | 'fukuoka' | 'jp_other' | 'seoul' | 'busan' | 'jeju' | null;
  board_country: 'japan' | 'korea' | null;
  title: string;
  content: string;
  images: string[] | null;
  is_anonymous: boolean | null;
  companion_date: string | null;
  companion_city: string | null;
  linked_exp_id: number | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  created_at: string;
  updated_at: string | null;
};

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

type PublicHostApplicationRow = {
  id?: string | number | null;
  user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
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

const COMMUNITY_DETAIL_REVALIDATE_SECONDS = 300;
const COMMUNITY_POST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getCommunityDetailPostUncached(id: string) {
  const supabase = createPublicServerClient();

  const buildPostQuery = (selectClause: string) =>
    supabase.from('community_posts').select(selectClause).eq('id', id).maybeSingle();

  let columns = COMMUNITY_DETAIL_POST_SELECT.split(', ');
  let result = await buildPostQuery(columns.join(', '));
  let usedPreBoardFallback = false;
  // At most one retry per missing optional column; retain every available privacy/board field.
  while (result.error) {
    const missingColumn = getMissingCommunityCompatibilityColumn(result.error);
    if (!missingColumn || !columns.includes(missingColumn)) throw result.error;
    columns = columns.filter((column) => column !== missingColumn);
    if (missingColumn === 'board_country') usedPreBoardFallback = true;
    result = await buildPostQuery(columns.join(', '));
  }
  const post = result.data
    ? normalizeCommunityPost(result.data as unknown as CommunityDetailPostRow)
    : null;

  if (!post) {
    return {
      post: null,
      profile: null,
      linkedExperience: null,
      usedPreBoardFallback,
    };
  }

  const [profileResult, experienceResult] = await Promise.all([
    post.is_anonymous === true ? Promise.resolve({ data: null, error: null }) : supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url')
      .eq('id', post.user_id)
      .maybeSingle(),
    post.linked_exp_id
      ? supabase
          .from('experiences')
          .select(COMMUNITY_FEED_LINKED_EXPERIENCE_SELECT)
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

  let linkedExperience: CommunityDetailExperience = null;
  const linkedExperienceRow = (experienceResult.data ?? null) as CommunityFeedLinkedExperienceRow | null;
  if (linkedExperienceRow?.host_id) {
    const { data: hostRows, error: hostRowsError } = await supabase
      .from('public_host_applications')
      .select('id, user_id, status, created_at')
      .eq('user_id', linkedExperienceRow.host_id);

    if (hostRowsError) {
      throw hostRowsError;
    }

    const visibleLinkedExperiences = filterVisibleCommunityLinkedExperiences(
      [linkedExperienceRow],
      (hostRows ?? []) as PublicHostApplicationRow[]
    );
    linkedExperience = (visibleLinkedExperiences[0] ?? null) as CommunityDetailExperience;
  }

  return {
    post,
    profile: (profileResult.data ?? null) as CommunityDetailProfile,
    linkedExperience,
    usedPreBoardFallback,
  };
}

export async function getCommunityDetailPost(id: string) {
  if (!COMMUNITY_POST_ID_RE.test(id)) {
    return {
      post: null,
      profile: null,
      linkedExperience: null,
      usedPreBoardFallback: false,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return getCommunityDetailPostUncached(id);
  }

  return unstable_cache(
    () => getCommunityDetailPostUncached(id),
    ['community-detail-indexability-v2', id],
    {
      revalidate: COMMUNITY_DETAIL_REVALIDATE_SECONDS,
      tags: ['community-detail', `community-detail-${id}`],
    }
  )();
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
