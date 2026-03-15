import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import {
    COMMUNITY_FEED_EXPERIENCE_SELECT,
    COMMUNITY_FEED_POST_SELECT,
    COMMUNITY_FEED_PROFILE_SELECT,
} from '@/app/community/feedSelect';
import type { CommunityPost } from '@/app/types/community';
import type { Experience, Profile } from '@/app/types';

type CommunityFeedPostRow = CommunityPost;
type CommunityFeedProfileRow = Pick<Profile, 'id' | 'name' | 'full_name' | 'avatar_url'>;
type CommunityFeedExperienceRow = Pick<Experience, 'id' | 'title' | 'image_url' | 'price'>;

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const queryText = (searchParams.get('q') || '').trim().replace(/,/g, ' ');
        const sort = searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const limit = 15;

        // ① community_posts 단독 조회 (join 없음 — join 에러로 전체 피드가 빈값이 되는 버그 방지)
        let query = supabase
            .from('community_posts')
            .select(COMMUNITY_FEED_POST_SELECT)
            .range(offset, offset + limit - 1);

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        if (queryText) {
            query = query.or(`title.ilike.%${queryText}%,content.ilike.%${queryText}%`);
        }

        if (sort === 'popular') {
            query = query
                .order('like_count', { ascending: false })
                .order('comment_count', { ascending: false })
                .order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: posts, error } = await query;

        if (error) {
            console.error('API Error fetching community posts:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!posts || posts.length === 0) {
            return NextResponse.json({ data: [], nextOffset: null });
        }

        // ② profiles 별도 조회 (실패해도 피드는 유지됨)
        const typedPosts = (posts ?? []) as unknown as CommunityFeedPostRow[];
        const userIds = [...new Set(typedPosts.map((post) => post.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select(COMMUNITY_FEED_PROFILE_SELECT)
            .in('id', userIds);
        const typedProfiles = (profiles ?? []) as unknown as CommunityFeedProfileRow[];

        const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile] as const));

        // ③ experiences 별도 조회 (linked_exp_id가 있는 포스트만)
        const expIds = [...new Set(typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number'))];
        let expMap = new Map<number, CommunityFeedExperienceRow>();
        if (expIds.length > 0) {
            const { data: experiences } = await supabase
                .from('experiences')
                .select(COMMUNITY_FEED_EXPERIENCE_SELECT)
                .in('id', expIds);
            const typedExperiences = (experiences ?? []) as unknown as CommunityFeedExperienceRow[];
            expMap = new Map(typedExperiences.map((experience) => [experience.id, experience] as const));
        }

        // ④ 조립
        const data = typedPosts.map((post) => ({
            ...post,
            profiles: profileMap.get(post.user_id) ?? null,
            linked_experience: post.linked_exp_id ? (expMap.get(post.linked_exp_id) ?? null) : null,
        }));

        const nextOffset = data.length === limit ? offset + limit : null;

        return NextResponse.json({ data, nextOffset });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
