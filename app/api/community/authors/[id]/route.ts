import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { getHostPublicProfile, getProfileDisplayName, normalizeLanguageList } from '@/app/utils/profile';
import {
  isMissingAnonymousColumnError,
  isMissingCommunityBoardColumnError,
} from '@/app/community/anonymousColumn';
import { inferCommunityBoardFromLegacyHub } from '@/app/community/boardMeta';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';
import type { CommunityBoard } from '@/app/types/community';

type PublicHostApplicationRow = {
  id: string | number;
  user_id: string | null;
  status: string | null;
  name?: string | null;
  profile_photo?: string | null;
  self_intro?: string | null;
  languages?: string[] | null;
  created_at?: string | null;
};

type RecentCommunityPostRow = {
  id: string;
  title: string;
  category: string;
  board_country?: CommunityBoard | null;
  destination_hub?: string | null;
  created_at: string;
  is_anonymous?: boolean;
};

const RECENT_POST_LIMIT = 12;

function isVisibleRecentPost(post: Pick<RecentCommunityPostRow, 'category' | 'board_country' | 'destination_hub'>) {
  const inferredBoard = post.board_country ?? inferCommunityBoardFromLegacyHub(post.destination_hub);
  return post.category === 'locally_content' || inferredBoard === 'japan' || inferredBoard === 'korea';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const excludePostId = request.nextUrl.searchParams.get('exclude_post_id');
    const supabase = createAdminClient();

    const [profileResult, hostResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('created_at, full_name, avatar_url, bio, introduction, nationality, languages')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('public_host_applications')
        .select('id, user_id, status, name, profile_photo, self_intro, languages, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(2),
    ]);

    if (profileResult.error) {
      return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
    }
    if (hostResult.error) {
      return NextResponse.json({ error: hostResult.error.message }, { status: 500 });
    }

    const profileData = profileResult.data;
    const latestHostApplication = pickLatestPublicHostApplication(
      (hostResult.data ?? []) as PublicHostApplicationRow[]
    );
    const hostApproved = isPublicHostApplicationStatus(latestHostApplication?.status);

    let recentQuery = supabase
      .from('community_posts')
      .select('id, title, category, board_country, destination_hub, created_at, is_anonymous')
      .eq('user_id', id)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(RECENT_POST_LIMIT);

    if (excludePostId) {
      recentQuery = recentQuery.neq('id', excludePostId);
    }

    const recentResult = await recentQuery;
    let recentPosts = (recentResult.data ?? []) as RecentCommunityPostRow[];

    if (recentResult.error && isMissingCommunityBoardColumnError(recentResult.error)) {
      let legacyQuery = supabase
        .from('community_posts')
        .select('id, title, category, destination_hub, created_at, is_anonymous')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(RECENT_POST_LIMIT);

      if (excludePostId) {
        legacyQuery = legacyQuery.neq('id', excludePostId);
      }

      const legacyResult = await legacyQuery;
      if (legacyResult.error && isMissingAnonymousColumnError(legacyResult.error)) {
        let legacyNoAnonymousQuery = supabase
          .from('community_posts')
          .select('id, title, category, destination_hub, created_at')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(RECENT_POST_LIMIT);

        if (excludePostId) {
          legacyNoAnonymousQuery = legacyNoAnonymousQuery.neq('id', excludePostId);
        }

        const legacyNoAnonymousResult = await legacyNoAnonymousQuery;
        if (legacyNoAnonymousResult.error) {
          return NextResponse.json({ error: legacyNoAnonymousResult.error.message }, { status: 500 });
        }

        recentPosts = (legacyNoAnonymousResult.data ?? []).map((post) => ({
          ...post,
          board_country: null,
          is_anonymous: false,
        })) as RecentCommunityPostRow[];
      } else if (legacyResult.error) {
        return NextResponse.json({ error: legacyResult.error.message }, { status: 500 });
      } else {
        recentPosts = (legacyResult.data ?? []).map((post) => ({
          ...post,
          board_country: null,
        })) as RecentCommunityPostRow[];
      }
    } else if (recentResult.error && isMissingAnonymousColumnError(recentResult.error)) {
      let legacyAnonymousQuery = supabase
        .from('community_posts')
        .select('id, title, category, board_country, destination_hub, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(RECENT_POST_LIMIT);

      if (excludePostId) {
        legacyAnonymousQuery = legacyAnonymousQuery.neq('id', excludePostId);
      }

      const legacyAnonymousResult = await legacyAnonymousQuery;
      if (legacyAnonymousResult.error) {
        return NextResponse.json({ error: legacyAnonymousResult.error.message }, { status: 500 });
      }

      recentPosts = (legacyAnonymousResult.data ?? []).map((post) => ({
        ...post,
        is_anonymous: false,
      })) as RecentCommunityPostRow[];
    } else if (recentResult.error) {
      return NextResponse.json({ error: recentResult.error.message }, { status: 500 });
    }

    if (!profileData) {
      return NextResponse.json({
        profile: null,
        recentPosts: [],
      });
    }

    const responseProfile = hostApproved
      ? (() => {
          const hostPublicProfile = getHostPublicProfile(profileData, latestHostApplication, 'Locally Host');
          return {
            joinedAt: profileData.created_at ?? null,
            displayName: hostPublicProfile.name,
            avatarUrl: hostPublicProfile.avatarUrl,
            bio: hostPublicProfile.bio,
            location: hostPublicProfile.location,
            languages: normalizeLanguageList(hostPublicProfile.languages),
            role: 'host' as const,
          };
        })()
      : {
          joinedAt: profileData.created_at ?? null,
          displayName: getProfileDisplayName(profileData),
          avatarUrl: profileData.avatar_url ?? null,
          bio: profileData.bio || profileData.introduction || null,
          location: profileData.nationality ?? null,
          languages: normalizeLanguageList(profileData.languages),
          role: 'guest' as const,
        };

    return NextResponse.json({
      profile: responseProfile,
      recentPosts: recentPosts
        .filter((post) => !post.is_anonymous)
        .filter((post) => isVisibleRecentPost(post))
        .slice(0, 6)
        .map((post) => ({
          id: post.id,
          title: post.title,
          category: post.category,
          board_country: post.board_country ?? inferCommunityBoardFromLegacyHub(post.destination_hub),
          created_at: post.created_at,
          is_anonymous: false,
        })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
