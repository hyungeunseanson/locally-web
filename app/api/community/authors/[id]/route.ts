import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { getHostPublicProfile, getProfileDisplayName, normalizeLanguageList } from '@/app/utils/profile';
import { isMissingAnonymousColumnError } from '@/app/community/anonymousColumn';

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
        .select('id, created_at, full_name, avatar_url, bio, introduction, nationality, gender, mbti, languages')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('host_applications')
        .select('name, profile_photo, self_intro, languages, profession, host_nationality, status')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
    }

    const profileData = profileResult.data;
    const hostData = hostResult.data;
    const hostApproved = hostData?.status === 'approved' || hostData?.status === 'active';

    let recentQuery = supabase
      .from('community_posts')
      .select('id, title, category, created_at, is_anonymous')
      .eq('user_id', id)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(6);

    if (excludePostId) {
      recentQuery = recentQuery.neq('id', excludePostId);
    }

    let recentResult = await recentQuery;
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
          const hostPublicProfile = getHostPublicProfile(profileData, hostData, 'Locally Host');
          return {
            joinedAt: profileData.created_at ?? null,
            displayName: hostPublicProfile.name,
            avatarUrl: hostPublicProfile.avatarUrl,
            bio: hostPublicProfile.bio,
            location: hostPublicProfile.location,
            mbti: profileData.mbti ?? null,
            languages: normalizeLanguageList(hostPublicProfile.languages),
            gender: profileData.gender ?? null,
            role: 'host' as const,
          };
        })()
      : {
          joinedAt: profileData.created_at ?? null,
          displayName: getProfileDisplayName(profileData),
          avatarUrl: profileData.avatar_url ?? null,
          bio: profileData.bio || profileData.introduction || null,
          location: profileData.nationality ?? null,
          mbti: profileData.mbti ?? null,
          languages: normalizeLanguageList(profileData.languages),
          gender: profileData.gender ?? null,
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
