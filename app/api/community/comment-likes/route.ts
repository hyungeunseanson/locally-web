import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/app/utils/supabase/server';

async function fetchLikeCount(supabase: SupabaseClient, commentId: string) {
    const { count, error } = await supabase
        .from('community_comment_likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId);

    if (error) throw error;

    return count ?? 0;
}

function isMissingCommentLikesTableError(error: { message?: string } | null) {
    return typeof error?.message === 'string' && error.message.includes('community_comment_likes');
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { comment_id } = await request.json();
        if (!comment_id) {
            return NextResponse.json({ error: 'Missing comment_id' }, { status: 400 });
        }

        const { data: existing, error: existingError } = await supabase
            .from('community_comment_likes')
            .select('id')
            .eq('comment_id', comment_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingError) {
            if (isMissingCommentLikesTableError(existingError)) {
                return NextResponse.json({ error: '댓글 좋아요 기능을 사용하려면 최신 커뮤니티 마이그레이션이 필요합니다.' }, { status: 503 });
            }

            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }

        if (existing) {
            const { error: deleteError } = await supabase
                .from('community_comment_likes')
                .delete()
                .eq('id', existing.id);

            if (deleteError) {
                return NextResponse.json({ error: deleteError.message }, { status: 500 });
            }

            return NextResponse.json({ liked: false, likeCount: await fetchLikeCount(supabase, comment_id) });
        }

        const { error: insertError } = await supabase
            .from('community_comment_likes')
            .insert({ comment_id, user_id: user.id });

        if (insertError) {
            if (isMissingCommentLikesTableError(insertError)) {
                return NextResponse.json({ error: '댓글 좋아요 기능을 사용하려면 최신 커뮤니티 마이그레이션이 필요합니다.' }, { status: 503 });
            }

            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ liked: true, likeCount: await fetchLikeCount(supabase, comment_id) });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
