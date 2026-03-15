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
