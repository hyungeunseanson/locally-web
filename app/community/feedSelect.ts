import type { Experience, Profile } from '@/app/types';
import type { CommunityPost } from '@/app/types/community';
import {
  getCommunityCategoryFromFormat,
  getCommunityFormatFromCategory,
} from './categoryMeta';
import { inferCommunityBoardFromLegacyHub, resolveCommunityBoard } from './boardMeta';

export const COMMUNITY_FEED_POST_SELECT = [
  'id',
  'user_id',
  'category',
  'post_format',
  'destination_hub',
  'source_locale',
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

export const COMMUNITY_FEED_POST_SELECT_PRE_BOARD = [
  'id',
  'user_id',
  'category',
  'post_format',
  'destination_hub',
  'source_locale',
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

export const COMMUNITY_FEED_POST_SELECT_LEGACY = [
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

export const COMMUNITY_BOARD_FEED_POST_SELECT = [
  'id',
  'user_id',
  'category',
  'board_country',
  'title',
  'images',
  'is_anonymous',
  'linked_exp_id',
  'view_count',
  'like_count',
  'comment_count',
  'created_at',
].join(', ');

export const COMMUNITY_BOARD_FEED_POST_SELECT_PRE_BOARD = [
  'id',
  'user_id',
  'category',
  'destination_hub',
  'title',
  'images',
  'is_anonymous',
  'linked_exp_id',
  'view_count',
  'like_count',
  'comment_count',
  'created_at',
].join(', ');

export const COMMUNITY_BOARD_FEED_POST_SELECT_LEGACY = [
  'id',
  'user_id',
  'category',
  'destination_hub',
  'title',
  'images',
  'linked_exp_id',
  'view_count',
  'like_count',
  'comment_count',
  'created_at',
].join(', ');

export const COMMUNITY_FEED_PROFILE_SELECT = 'id, full_name, avatar_url';
export const COMMUNITY_FEED_EXPERIENCE_SELECT = 'id, title, image_url, price';

export type CommunityFeedProfile = Pick<Profile, 'id' | 'full_name' | 'avatar_url'> & {
  name?: string | null;
};
export type CommunityFeedExperience = Pick<Experience, 'id' | 'title' | 'image_url' | 'price'>;
export type CommunityBoardFeedPostRow = Pick<
  CommunityPost,
  | 'id'
  | 'user_id'
  | 'category'
  | 'destination_hub'
  | 'board_country'
  | 'title'
  | 'images'
  | 'is_anonymous'
  | 'linked_exp_id'
  | 'view_count'
  | 'like_count'
  | 'comment_count'
  | 'created_at'
>;
export type CommunityFeedPostRow = Pick<
  CommunityPost,
  | 'id'
  | 'user_id'
  | 'category'
  | 'post_format'
  | 'destination_hub'
  | 'source_locale'
  | 'board_country'
  | 'title'
  | 'content'
  | 'images'
  | 'is_anonymous'
  | 'companion_date'
  | 'companion_city'
  | 'linked_exp_id'
  | 'view_count'
  | 'like_count'
  | 'comment_count'
  | 'created_at'
  | 'updated_at'
>;
export type CommunityFeedPost = {
  id: string;
  user_id: string | null;
  category: CommunityPost['category'];
  destination_hub?: CommunityPost['destination_hub'];
  board_country: CommunityPost['board_country'];
  title: string;
  images: string[];
  is_anonymous: boolean;
  linked_exp_id: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  profiles?: CommunityFeedProfile | null;
  linked_experience?: CommunityFeedExperience | null;
};

export type CommunityFeedResponse = {
  data: CommunityFeedPost[];
  nextOffset: number | null;
};

export function parseCommunityFeedResponse(payload: unknown): CommunityFeedResponse {
  const record = payload as Record<string, unknown> | null;
  const data = Array.isArray(record?.data) ? (record?.data as CommunityFeedPost[]) : [];
  const nextOffset = typeof record?.nextOffset === 'number' ? record.nextOffset : null;

  return {
    data,
    nextOffset,
  };
}

export function buildCommunityFeedPosts(
  posts: CommunityFeedPostRow[],
  profiles: CommunityFeedProfile[],
  experiences: CommunityFeedExperience[]
): CommunityFeedPost[] {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile] as const));
  const experienceMap = new Map(experiences.map((experience) => [experience.id, experience] as const));

  return posts.map((post) => {
    const normalizedPost = normalizeCommunityFeedPostRow(post);
    const publicUserId = normalizedPost.is_anonymous ? null : normalizedPost.user_id;

    return {
      id: normalizedPost.id,
      user_id: publicUserId,
      category: normalizedPost.category,
      destination_hub: normalizedPost.destination_hub,
      board_country: normalizedPost.board_country,
      title: normalizedPost.title,
      images: normalizedPost.images,
      is_anonymous: normalizedPost.is_anonymous,
      linked_exp_id: normalizedPost.linked_exp_id ?? null,
      view_count: normalizedPost.view_count,
      like_count: normalizedPost.like_count,
      comment_count: normalizedPost.comment_count,
      created_at: normalizedPost.created_at,
      profiles: normalizedPost.is_anonymous ? null : profileMap.get(normalizedPost.user_id) ?? null,
      linked_experience: normalizedPost.linked_exp_id ? experienceMap.get(normalizedPost.linked_exp_id) ?? null : null,
    };
  });
}

export function buildCommunityBoardFeedPosts(
  posts: CommunityBoardFeedPostRow[],
  profiles: CommunityFeedProfile[],
  experiences: CommunityFeedExperience[]
): CommunityFeedPost[] {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile] as const));
  const experienceMap = new Map(experiences.map((experience) => [experience.id, experience] as const));

  return posts.map((post) => {
    const normalizedPost = normalizeCommunityBoardFeedPostRow(post);
    const publicUserId = normalizedPost.is_anonymous ? null : normalizedPost.user_id;

    return {
      id: normalizedPost.id,
      user_id: publicUserId,
      category: normalizedPost.category,
      destination_hub: normalizedPost.destination_hub,
      board_country: normalizedPost.board_country,
      title: normalizedPost.title,
      images: normalizedPost.images,
      is_anonymous: normalizedPost.is_anonymous,
      linked_exp_id: normalizedPost.linked_exp_id ?? null,
      view_count: normalizedPost.view_count,
      like_count: normalizedPost.like_count,
      comment_count: normalizedPost.comment_count,
      created_at: normalizedPost.created_at,
      profiles: normalizedPost.is_anonymous ? null : profileMap.get(normalizedPost.user_id) ?? null,
      linked_experience: normalizedPost.linked_exp_id ? experienceMap.get(normalizedPost.linked_exp_id) ?? null : null,
    };
  });
}

export function normalizeCommunityBoardFeedPostRow(
  post: Partial<CommunityBoardFeedPostRow> & Pick<CommunityBoardFeedPostRow, 'id' | 'user_id' | 'category' | 'title'>
): CommunityBoardFeedPostRow {
  return {
    id: post.id,
    user_id: post.user_id,
    category: post.category,
    destination_hub: normalizeCommunityHub(post.destination_hub),
    board_country: normalizeCommunityBoard(post.board_country, post.destination_hub),
    title: post.title,
    images: Array.isArray(post.images) ? post.images : [],
    is_anonymous: Boolean(post.is_anonymous),
    linked_exp_id: typeof post.linked_exp_id === 'number' ? post.linked_exp_id : null,
    view_count: Number(post.view_count || 0),
    like_count: Number(post.like_count || 0),
    comment_count: Number(post.comment_count || 0),
    created_at: post.created_at || new Date(0).toISOString(),
  };
}

export function normalizeCommunityFeedPostRow(
  post: Partial<CommunityFeedPostRow> & Pick<CommunityFeedPostRow, 'id' | 'user_id' | 'category' | 'title' | 'content'>
): CommunityFeedPostRow {
  const normalizedFormat = normalizeCommunityPostFormat(post.post_format, post.category);

  return {
    id: post.id,
    user_id: post.user_id,
    category: post.category,
    post_format: normalizedFormat,
    destination_hub: normalizeCommunityHub(post.destination_hub),
    source_locale: normalizeCommunityLocale(post.source_locale),
    board_country: normalizeCommunityBoard(post.board_country, post.destination_hub),
    title: post.title,
    content: post.content,
    images: Array.isArray(post.images) ? post.images : [],
    is_anonymous: Boolean(post.is_anonymous),
    companion_date: post.companion_date,
    companion_city: post.companion_city,
    linked_exp_id: typeof post.linked_exp_id === 'number' ? post.linked_exp_id : null,
    view_count: Number(post.view_count || 0),
    like_count: Number(post.like_count || 0),
    comment_count: Number(post.comment_count || 0),
    created_at: post.created_at || new Date(0).toISOString(),
    updated_at: post.updated_at || post.created_at || new Date(0).toISOString(),
  };
}

function normalizeCommunityHub(value: unknown): CommunityPost['destination_hub'] {
  if (
    value === 'tokyo'
    || value === 'osaka_kyoto'
    || value === 'fukuoka'
    || value === 'jp_other'
    || value === 'seoul'
    || value === 'busan'
    || value === 'jeju'
  ) {
    return value;
  }

  return null;
}

function normalizeCommunityLocale(value: unknown): CommunityPost['source_locale'] {
  if (value === 'ja' || value === 'en' || value === 'zh') return value;
  return 'ko';
}

function normalizeCommunityBoard(value: unknown, legacyHub: unknown): CommunityPost['board_country'] {
  if (value === 'japan' || value === 'korea') return value;
  return inferCommunityBoardFromLegacyHub(legacyHub);
}

function normalizeCommunityPostFormat(value: unknown, category: CommunityPost['category']): CommunityPost['post_format'] {
  if (value === 'question' || value === 'companion' || value === 'live_tip' || value === 'locally_pick') {
    return value;
  }

  return getCommunityFormatFromCategory(category);
}

export function createCommunityInsertPayload(input: {
  userId: string;
  category: CommunityPost['category'];
  title: string;
  content: string;
  images: string[];
  isAnonymous: boolean;
  companionDate?: string | null;
  companionCity?: string | null;
  linkedExpId?: number | null;
  destinationHub?: CommunityPost['destination_hub'];
  postFormat?: CommunityPost['post_format'];
  sourceLocale?: CommunityPost['source_locale'];
  boardCountry?: CommunityPost['board_country'];
}) {
  const postFormat = normalizeCommunityPostFormat(input.postFormat, input.category);

  return {
    user_id: input.userId,
    category: getCommunityCategoryFromFormat(postFormat),
    post_format: postFormat,
    destination_hub: normalizeCommunityHub(input.destinationHub),
    source_locale: normalizeCommunityLocale(input.sourceLocale),
    board_country: input.boardCountry ? resolveCommunityBoard(input.boardCountry) : null,
    title: input.title,
    content: input.content,
    images: input.images,
    is_anonymous: input.isAnonymous,
    companion_date: input.companionDate || null,
    companion_city: input.companionCity || null,
    linked_exp_id: input.linkedExpId || null,
  };
}
