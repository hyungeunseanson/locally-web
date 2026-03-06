import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

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
            .select('*')
            .range(offset, offset + limit - 1);

        if (category) {
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
        const userIds = [...new Set(posts.map((p: any) => p.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        // ③ experiences 별도 조회 (linked_exp_id가 있는 포스트만)
        const expIds = [...new Set(posts.map((p: any) => p.linked_exp_id).filter(Boolean))];
        let expMap = new Map();
        if (expIds.length > 0) {
            const { data: experiences } = await supabase
                .from('experiences')
                .select('id, title, image_url, price')
                .in('id', expIds);
            expMap = new Map((experiences || []).map((e: any) => [e.id, e]));
        }

        // ④ 조립
        const data = posts.map((post: any) => ({
            ...post,
            profiles: profileMap.get(post.user_id) ?? null,
            linked_experience: post.linked_exp_id ? (expMap.get(post.linked_exp_id) ?? null) : null,
        }));

        const nextOffset = data.length === limit ? offset + limit : null;

        return NextResponse.json({ data, nextOffset });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
