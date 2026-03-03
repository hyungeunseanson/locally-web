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

        const { data, error } = await supabase
            .from('community_comments')
            .select('*, profiles:user_id(name, avatar_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

        const { data, error } = await supabase
            .from('community_comments')
            .insert({ post_id, user_id: user.id, content: content.trim() })
            .select('*, profiles:user_id(name, avatar_url)')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
