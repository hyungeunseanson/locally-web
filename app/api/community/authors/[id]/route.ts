import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { COMMUNITY_OPEN } from '@/app/community/categoryMeta';
import { getHostPublicProfile, getProfileDisplayName, normalizeLanguageList } from '@/app/utils/profile';
import { isMissingAnonymousColumnError } from '@/app/community/anonymousColumn';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';

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
      .select('id, title, category, created_at, is_anonymous')
      .eq('user_id', id)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!COMMUNITY_OPEN) {
      recentQuery = recentQuery.eq('category', 'locally_content');
    }

    if (excludePostId) {
      recentQuery = recentQuery.neq('id', excludePostId);
    }

    const recentResult = await recentQuery;
    let recentPosts = (recentResult.data ?? []) as Array<{
      id: string;
      title: string;
      category: string;
      created_at: string;
      is_anonymous?: boolean;
    }>;

    if (recentResult.error && isMissingAnonymousColumnError(recentResult.error)) {
      let legacyQuery = supabase
        .from('community_posts')
        .select('id, title, category, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!COMMUNITY_OPEN) {
        legacyQuery = legacyQuery.eq('category', 'locally_content');
      }

      if (excludePostId) {
        legacyQuery = legacyQuery.neq('id', excludePostId);
      }

      const legacyResult = await legacyQuery;
      if (legacyResult.error) {
        return NextResponse.json({ error: legacyResult.error.message }, { status: 500 });
      }

      recentPosts = (legacyResult.data ?? []).map((post) => ({ ...post, is_anonymous: false }));
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
      recentPosts: recentPosts.filter((post) => !post.is_anonymous),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
