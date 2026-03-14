import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';

function sanitizeReactions(rawReactions: unknown) {
  if (!rawReactions || typeof rawReactions !== 'object' || Array.isArray(rawReactions)) {
    return null;
  }

  const nextReactions: Record<string, string[]> = {};
  for (const [emoji, rawUsers] of Object.entries(rawReactions as Record<string, unknown>)) {
    if (!Array.isArray(rawUsers)) continue;
    const users = Array.from(
      new Set(rawUsers.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))
    );
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
