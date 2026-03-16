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

export type CommunityFeedResponse = {
  data: CommunityPost[];
  nextOffset: number | null;
};

export function parseCommunityFeedResponse(payload: unknown): CommunityFeedResponse {
  const record = payload as Record<string, unknown> | null;
  const data = Array.isArray(record?.data) ? (record?.data as CommunityPost[]) : [];
  const nextOffset = typeof record?.nextOffset === 'number' ? record.nextOffset : null;

  return {
    data,
    nextOffset,
  };
}
