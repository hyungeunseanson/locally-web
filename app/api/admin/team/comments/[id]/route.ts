import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';

function sanitizeReactions(rawReactions: unknown) {
  if (!rawReactions || typeof rawReactions !== 'object' || Array.isArray(rawReactions)) {
    return null;
  }

  const nextReactions: Record<string, string[]> = {};
  for (const [emoji, rawUsers] of Object.entries(rawReactions as Record<string, unknown>)) {
    // [Security] 이모지 키 수/길이 제한 + 유저 배열 상한 — JSONB 컬럼 블로팅/DoS 방어
    if (Object.keys(nextReactions).length >= 20) break;
    if (emoji.length > 10) continue;
    if (!Array.isArray(rawUsers)) continue;
    const users = Array.from(
      new Set(rawUsers.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))
    ).slice(0, 100);
    nextReactions[emoji] = users;
  }

  return nextReactions;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTeamAdminContext();
    if ('response' in context) {
      return context.response;
    }

    const { id } = await params;
    if (!id) {
      return teamError('유효하지 않은 댓글 ID입니다.', 400);
    }

    const body = await request.json();
    const reactions = sanitizeReactions(body?.reactions);

    if (!reactions) {
      return teamError('유효하지 않은 reaction 데이터입니다.', 400);
    }

    // [Security] 수평 권한 상승 방지 — 본인 댓글만 reaction 수정 가능
    const { data: existingComment, error: fetchError } = await context.supabaseAdmin
      .from('admin_task_comments')
      .select('id, author_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[admin/team/comments/[id]] fetch error:', fetchError);
      return teamError('댓글 정보를 불러오지 못했습니다.', 500);
    }
    if (!existingComment) {
      return teamError('댓글을 찾을 수 없습니다.', 404);
    }
    if (existingComment.author_id !== context.user.id) {
      return teamError('본인이 작성한 댓글만 수정할 수 있습니다.', 403);
    }

    const { data, error } = await context.supabaseAdmin
      .from('admin_task_comments')
      .update({ reactions })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin/team/comments/[id]] update error:', error);
      return teamError('댓글 reaction 저장에 실패했습니다.', 500);
    }

    if (!data) {
      return teamError('댓글을 찾을 수 없습니다.', 404);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[admin/team/comments/[id]] unexpected error:', error);
    return teamError('Server error', 500);
  }
}
