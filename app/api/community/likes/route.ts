import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

// POST /api/community/likes  { post_id }  → toggle like
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { post_id } = await request.json();
        if (!post_id) return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });

        // Check existing like
        const { data: existing } = await supabase
            .from('community_likes')
            .select('id')
            .eq('post_id', post_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existing) {
            // Unlike
            await supabase.from('community_likes').delete().eq('id', existing.id);
            return NextResponse.json({ liked: false });
        } else {
            // Like
            await supabase.from('community_likes').insert({ post_id, user_id: user.id });
            return NextResponse.json({ liked: true });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
