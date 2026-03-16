import { getProfileDisplayName, getProfileInitial } from '@/app/utils/profile';

type CommunityAuthorProfile = {
  full_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
} | null | undefined;

export const COMMUNITY_ANONYMOUS_LABEL = '익명';

export function getCommunityAuthorName(profile: CommunityAuthorProfile, isAnonymous?: boolean): string {
  if (isAnonymous) return COMMUNITY_ANONYMOUS_LABEL;
  return getProfileDisplayName(profile);
}

export function getCommunityAuthorInitial(profile: CommunityAuthorProfile, isAnonymous?: boolean): string {
  if (isAnonymous) return '익';
  return getProfileInitial(profile);
}

export function getCommunityAuthorAvatar(profile: CommunityAuthorProfile, isAnonymous?: boolean): string | null {
  if (isAnonymous) return null;
  return typeof profile?.avatar_url === 'string' && profile.avatar_url ? profile.avatar_url : null;
}
