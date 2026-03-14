import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError, TEAM_CHAT_ROOM_ID } from '@/app/api/admin/team/_shared';

function sanitizeCommentMetadata(rawMetadata: unknown) {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return null;
  }

  const metadata = rawMetadata as Record<string, unknown>;
  if (typeof metadata.image_url === 'string' && metadata.image_url.trim()) {
    return { image_url: metadata.image_url.trim() };
  }

  return null;
}

function sanitizeReadBy(rawReadBy: unknown, userId: string) {
  const values = Array.isArray(rawReadBy)
    ? rawReadBy.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  return Array.from(new Set([userId, ...values]));
}

function sanitizeReactions(rawReactions: unknown) {
  if (!rawReactions || typeof rawReactions !== 'object' || Array.isArray(rawReactions)) {
    return {};
  }

  const nextReactions: Record<string, string[]> = {};
  for (const [emoji, rawUsers] of Object.entries(rawReactions as Record<string, unknown>)) {
    if (!Array.isArray(rawUsers)) continue;
    const users = Array.from(new Set(rawUsers.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));
    nextReactions[emoji] = users;
  }

  return nextReactions;
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTeamAdminContext();
    if ('response' in context) {
      return context.response;
    }

    const body = await request.json();
    const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const clientNonce = typeof body?.clientNonce === 'string' ? body.clientNonce : null;
    const metadata = sanitizeCommentMetadata(body?.metadata);
    const readBy = sanitizeReadBy(body?.readBy, context.user.id);
    const reactions = sanitizeReactions(body?.reactions);

    if (!taskId) {
      return teamError('유효하지 않은 작업 ID입니다.', 400);
    }

    if (!content) {
      return teamError('댓글 내용을 입력해주세요.', 400);
    }

    if (taskId !== TEAM_CHAT_ROOM_ID) {
      const { data: task, error: taskError } = await context.supabaseAdmin
        .from('admin_tasks')
        .select('id')
        .eq('id', taskId)
        .maybeSingle();

      if (taskError) {
        console.error('[admin/team/comments] task fetch error:', taskError);
        return teamError('작업 정보를 불러오지 못했습니다.', 500);
      }

      if (!task) {
        return teamError('댓글을 남길 작업을 찾을 수 없습니다.', 404);
      }
    }

    const { data, error } = await context.supabaseAdmin
      .from('admin_task_comments')
      .insert({
        task_id: taskId,
        content,
        author_id: context.user.id,
        author_name: context.authorName,
        client_nonce: clientNonce,
        metadata,
        reactions,
        read_by: readBy,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true });
      }
      console.error('[admin/team/comments] create error:', error);
      return teamError('댓글 작성에 실패했습니다.', 500);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('[admin/team/comments] unexpected error:', error);
    return teamError('Server error', 500);
  }
}
