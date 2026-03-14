import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';

const ALLOWED_TASK_TYPES = new Set(['DAILY_LOG', 'TODO', 'MEMO']);
const ALLOWED_STATUS_TEXT = new Set(['Done', 'Progress']);

function sanitizeTaskMetadata(rawMetadata: unknown) {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return {};
  }

  const nextMetadata: Record<string, string> = {};
  const metadata = rawMetadata as Record<string, unknown>;

  if (typeof metadata.note === 'string') {
    const note = metadata.note.trim();
    if (note) nextMetadata.note = note;
  }

  if (typeof metadata.status_text === 'string' && ALLOWED_STATUS_TEXT.has(metadata.status_text)) {
    nextMetadata.status_text = metadata.status_text;
  }

  return nextMetadata;
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTeamAdminContext();
    if ('response' in context) {
      return context.response;
    }

    const body = await request.json();
    const type = typeof body?.type === 'string' ? body.type : '';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const isCompleted = typeof body?.isCompleted === 'boolean' ? body.isCompleted : false;
    const metadata = sanitizeTaskMetadata(body?.metadata);

    if (!ALLOWED_TASK_TYPES.has(type)) {
      return teamError('유효하지 않은 팀 작업 유형입니다.', 400);
    }

    if (!content) {
      return teamError('내용을 입력해주세요.', 400);
    }

    const { data, error } = await context.supabaseAdmin
      .from('admin_tasks')
      .insert({
        type,
        content,
        is_completed: isCompleted,
        metadata,
        author_id: context.user.id,
        author_name: context.authorName,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin/team/tasks] create error:', error);
      return teamError('팀 작업 생성에 실패했습니다.', 500);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('[admin/team/tasks] unexpected error:', error);
    return teamError('Server error', 500);
  }
}
