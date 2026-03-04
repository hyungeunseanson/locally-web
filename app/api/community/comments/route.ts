import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

// GET /api/community/comments?post_id=...
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const postId = searchParams.get('post_id');

        if (!postId) {
            return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
        }

        // ① comments 단독 조회 (join 없음 — profiles FK join이 "profiles_1.name" 오류 유발)
        const { data: comments, error } = await supabase
            .from('community_comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!comments || comments.length === 0) return NextResponse.json({ data: [] });

        // ② profiles 별도 조회
        const userIds = [...new Set(comments.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        const data = comments.map((c: any) => ({
            ...c,
            profiles: profileMap.get(c.user_id) ?? null,
        }));

        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/community/comments
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { post_id, content } = await request.json();
        if (!post_id || !content?.trim()) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // ① insert (join 없음)
        const { data: inserted, error: insertError } = await supabase
            .from('community_comments')
            .insert({ post_id, user_id: user.id, content: content.trim() })
            .select('*')
            .single();

        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

        // ② profile 별도 조회
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

        const data = { ...inserted, profiles: profile ?? null };

        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
