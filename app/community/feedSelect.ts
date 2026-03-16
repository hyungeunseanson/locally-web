import type { Experience, Profile } from '@/app/types';
import type { CommunityPost } from '@/app/types/community';

export const COMMUNITY_FEED_POST_SELECT = [
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

export const COMMUNITY_FEED_PROFILE_SELECT = 'id, name, full_name, avatar_url';
export const COMMUNITY_FEED_EXPERIENCE_SELECT = 'id, title, image_url, price';

export type CommunityFeedProfile = Pick<Profile, 'id' | 'name' | 'full_name' | 'avatar_url'>;
export type CommunityFeedExperience = Pick<Experience, 'id' | 'title' | 'image_url' | 'price'>;
export type CommunityFeedPostRow = Pick<
  CommunityPost,
  | 'id'
  | 'user_id'
  | 'category'
  | 'title'
  | 'content'
  | 'images'
  | 'companion_date'
  | 'companion_city'
  | 'linked_exp_id'
  | 'view_count'
  | 'like_count'
  | 'comment_count'
  | 'created_at'
  | 'updated_at'
>;
export type CommunityFeedPost = CommunityFeedPostRow & {
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

  return posts.map((post) => ({
    ...post,
    profiles: profileMap.get(post.user_id) ?? null,
    linked_experience: post.linked_exp_id ? experienceMap.get(post.linked_exp_id) ?? null : null,
  }));
}
