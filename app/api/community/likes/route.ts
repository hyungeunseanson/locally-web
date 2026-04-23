import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient } from '@/app/utils/supabase/server';

function normalizeKnownLikeCount(value: unknown) {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 0) return null;
    return Math.trunc(count);
}

async function fetchPostLikeCount(postId: string) {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('community_posts')
        .select('like_count')
        .eq('id', postId)
        .maybeSingle();

    if (error) throw error;

    return Number(data?.like_count || 0);
}

async function fetchExactLikeCount(postId: string) {
    const supabaseAdmin = createAdminClient();
    const { count, error } = await supabaseAdmin
        .from('community_likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);

    if (error) throw error;

    return count ?? 0;
}

async function resolveLikeCount(postId: string, optimisticLikeCount: number | null) {
    const aggregateLikeCount = await fetchPostLikeCount(postId);

    if (optimisticLikeCount === null || aggregateLikeCount === optimisticLikeCount) {
        return aggregateLikeCount;
    }

    const exactLikeCount = await fetchExactLikeCount(postId);
    if (aggregateLikeCount !== exactLikeCount) {
        const supabaseAdmin = createAdminClient();
        const { error: repairError } = await supabaseAdmin
            .from('community_posts')
            .update({ like_count: exactLikeCount })
            .eq('id', postId);

        if (repairError) {
            console.warn('[community/likes] aggregate repair failed:', repairError.message);
        }
    }

    return exactLikeCount;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { post_id, knownLikeCount } = await request.json();
        if (!post_id) return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });

        const normalizedKnownLikeCount = normalizeKnownLikeCount(knownLikeCount);

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

            const optimisticLikeCount = normalizedKnownLikeCount === null
                ? null
                : Math.max(normalizedKnownLikeCount - 1, 0);
            const likeCount = await resolveLikeCount(post_id, optimisticLikeCount);
            return NextResponse.json({ liked: false, likeCount });
        } else {
            const { error: insertError } = await supabase.from('community_likes').insert({ post_id, user_id: user.id });
            if (insertError) {
                // [Fix] 23505 = unique_violation — 동시 요청 중복 삽입 시 500 대신 409 반환
                if (insertError.code === '23505') {
                    const optimisticLikeCount = normalizedKnownLikeCount === null
                        ? null
                        : normalizedKnownLikeCount + 1;
                    const likeCount = await resolveLikeCount(post_id, optimisticLikeCount);
                    return NextResponse.json({ liked: true, likeCount }, { status: 409 });
                }
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }

            const optimisticLikeCount = normalizedKnownLikeCount === null
                ? null
                : normalizedKnownLikeCount + 1;
            const likeCount = await resolveLikeCount(post_id, optimisticLikeCount);
            return NextResponse.json({ liked: true, likeCount });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
