import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/server';

async function fetchLikeCount(supabase: SupabaseClient, postId: string) {
    const { count, error } = await supabase
        .from('community_likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);

    if (error) throw error;

    return count ?? 0;
}

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
        const { data: existing, error: existingError } = await supabase
            .from('community_likes')
            .select('id')
            .eq('post_id', post_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }

        if (existing) {
            const { error: deleteError } = await supabase.from('community_likes').delete().eq('id', existing.id);
            if (deleteError) {
                return NextResponse.json({ error: deleteError.message }, { status: 500 });
            }

            const likeCount = await fetchLikeCount(supabase, post_id);
            return NextResponse.json({ liked: false, likeCount });
        } else {
            const { error: insertError } = await supabase.from('community_likes').insert({ post_id, user_id: user.id });
            if (insertError) {
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }

            const likeCount = await fetchLikeCount(supabase, post_id);
            return NextResponse.json({ liked: true, likeCount });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
