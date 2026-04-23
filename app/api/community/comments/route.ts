import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import type { CommunityComment, CommunityProfilePreview } from '@/app/types/community';
import { createClient } from '@/app/utils/supabase/server';
import { sanitizeText } from '@/app/utils/sanitize';

type CommentRow = {
    id: string;
    post_id: string;
    user_id: string;
    parent_id?: string | null;
    content: string;
    created_at: string;
    updated_at: string;
};

type CommentProfileRow = CommunityProfilePreview;

function isMissingParentColumnError(error: { message?: string } | null) {
    return typeof error?.message === 'string' && error.message.includes('parent_id');
}

function buildNestedComments(rows: CommunityComment[]) {
    const commentsById = new Map<string, CommunityComment>();
    const rootComments: CommunityComment[] = [];

    rows.forEach((row) => {
        commentsById.set(row.id, {
            ...row,
            replies: [],
        });
    });

    rows.forEach((row) => {
        const current = commentsById.get(row.id);
        if (!current) return;

        if (row.parent_id && commentsById.has(row.parent_id)) {
            commentsById.get(row.parent_id)?.replies?.push(current);
            return;
        }

        rootComments.push(current);
    });

    return rootComments;
}

// GET /api/community/comments?post_id=...
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const postId = searchParams.get('post_id');

        if (!postId) {
            return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
        }

        const { data: comments, error } = await supabase
            .from('community_comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!comments || comments.length === 0) return NextResponse.json({ data: [], totalCount: 0 });

        const typedComments = comments as CommentRow[];
        const userIds = [...new Set(typedComments.map((comment) => comment.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

        const typedProfiles = (profiles || []) as CommentProfileRow[];
        const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile] as const));

        const mappedComments: CommunityComment[] = typedComments.map((comment) => ({
            id: comment.id,
            post_id: comment.post_id,
            user_id: comment.user_id,
            parent_id: typeof comment.parent_id === 'string' ? comment.parent_id : null,
            content: comment.content,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            profiles: profileMap.get(comment.user_id) ?? null,
            replies: [],
        }));

        return NextResponse.json({
            data: buildNestedComments(mappedComments),
            totalCount: mappedComments.length,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/community/comments
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

        const { post_id, content, parent_id } = await request.json();
        if (!post_id || !content?.trim()) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }
        if (content.trim().length > 2000) {
            return NextResponse.json({ error: '댓글은 2000자를 초과할 수 없습니다.' }, { status: 400 });
        }

        let normalizedParentId: string | null = null;
        if (typeof parent_id === 'string' && parent_id.trim()) {
            const { data: parentComment, error: parentError } = await supabase
                .from('community_comments')
                .select('id, post_id, parent_id')
                .eq('id', parent_id)
                .maybeSingle();

            if (parentError) {
                return NextResponse.json({ error: parentError.message }, { status: 500 });
            }

            if (!parentComment || parentComment.post_id !== post_id) {
                return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 });
            }

            normalizedParentId = parentComment.parent_id || parentComment.id;
        }

        const insertPayload: Record<string, unknown> = {
            post_id,
            user_id: user.id,
            content: sanitizeText(content.trim()),
        };

        if (normalizedParentId) {
            insertPayload.parent_id = normalizedParentId;
        }

        let inserted: CommentRow | null = null;
        const insertResult = await supabase
            .from('community_comments')
            .insert(insertPayload)
            .select('*')
            .maybeSingle();

        if (insertResult.error) {
            if (normalizedParentId && isMissingParentColumnError(insertResult.error)) {
                return NextResponse.json({ error: '답글 기능을 사용하려면 최신 커뮤니티 마이그레이션이 필요합니다.' }, { status: 503 });
            }

            return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
        }

        // [Fix] .maybeSingle() null 체크 — RLS 무음 차단 시 PGRST116 대신 명시적 500 반환
        if (!insertResult.data) {
            return NextResponse.json({ error: '댓글 등록에 실패했습니다.' }, { status: 500 });
        }

        inserted = insertResult.data as CommentRow;

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

        const data: CommunityComment = {
            id: inserted.id,
            post_id: inserted.post_id,
            user_id: inserted.user_id,
            parent_id: typeof inserted.parent_id === 'string' ? inserted.parent_id : null,
            content: inserted.content,
            created_at: inserted.created_at,
            updated_at: inserted.updated_at,
            profiles: profile ?? null,
            replies: [],
        };

        revalidateTag(`community-detail-${post_id}`, 'max');

        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
