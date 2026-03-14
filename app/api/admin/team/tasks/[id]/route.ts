import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';

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
      return teamError('유효하지 않은 작업 ID입니다.', 400);
    }

    const { data: existingTask, error: fetchError } = await context.supabaseAdmin
      .from('admin_tasks')
      .select('id, metadata')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[admin/team/tasks/[id]] fetch error:', fetchError);
      return teamError('작업 정보를 불러오지 못했습니다.', 500);
    }

    if (!existingTask) {
      return teamError('작업을 찾을 수 없습니다.', 404);
    }

    const body = await request.json();
    const payload: Record<string, unknown> = {};

    if (typeof body?.content === 'string') {
      const content = body.content.trim();
      if (!content) {
        return teamError('내용을 입력해주세요.', 400);
      }
      payload.content = content;
    }

    if (typeof body?.isCompleted === 'boolean') {
      payload.is_completed = body.isCompleted;
    }

    const metadataPatch = sanitizeTaskMetadata(body?.metadata);
    if (Object.keys(metadataPatch).length > 0) {
      const existingMetadata =
        existingTask.metadata && typeof existingTask.metadata === 'object'
          ? (existingTask.metadata as Record<string, unknown>)
          : {};
      payload.metadata = {
        ...existingMetadata,
        ...metadataPatch,
      };
    }

    if (Object.keys(payload).length === 0) {
      return teamError('변경할 내용이 없습니다.', 400);
    }

    const { data, error } = await context.supabaseAdmin
      .from('admin_tasks')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin/team/tasks/[id]] update error:', error);
      return teamError('팀 작업 수정에 실패했습니다.', 500);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[admin/team/tasks/[id]] unexpected PATCH error:', error);
    return teamError('Server error', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTeamAdminContext();
    if ('response' in context) {
      return context.response;
    }

    const { id } = await params;
    if (!id) {
      return teamError('유효하지 않은 작업 ID입니다.', 400);
    }

    const { error } = await context.supabaseAdmin
      .from('admin_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[admin/team/tasks/[id]] delete error:', error);
      return teamError('팀 작업 삭제에 실패했습니다.', 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/team/tasks/[id]] unexpected DELETE error:', error);
    return teamError('Server error', 500);
  }
}
