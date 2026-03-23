import { NextResponse } from 'next/server';

import { createTeamRequestId, resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';

export async function GET() {
  const requestId = createTeamRequestId('bootstrap');

  try {
    const context = await resolveTeamAdminContext('bootstrap', requestId);
    if ('response' in context) {
      return context.response;
    }

    const { data: tasks, error: tasksError } = await context.supabaseAdmin
      .from('admin_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (tasksError) {
      console.error(`[admin/team/bootstrap][${requestId}] tasks fetch error:`, tasksError);
      return teamError('팀 작업을 불러오지 못했습니다.', 500, requestId);
    }

    const taskIds = (tasks ?? []).map((task) => task.id);

    const [commentsResult, whitelistResult] = await Promise.all([
      taskIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : context.supabaseAdmin
            .from('admin_task_comments')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: true }),
      context.supabaseAdmin
        .from('admin_whitelist')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (commentsResult.error) {
      console.error(`[admin/team/bootstrap][${requestId}] comments fetch error:`, commentsResult.error);
      return teamError('팀 댓글을 불러오지 못했습니다.', 500, requestId);
    }

    if (whitelistResult.error) {
      console.error(`[admin/team/bootstrap][${requestId}] whitelist fetch error:`, whitelistResult.error);
      return teamError('관리자 화이트리스트를 불러오지 못했습니다.', 500, requestId);
    }

    return NextResponse.json({
      success: true,
      currentUser: {
        id: context.user.id,
        name: context.authorName,
      },
      tasks: tasks ?? [],
      comments: commentsResult.data ?? [],
      whitelist: whitelistResult.data ?? [],
    });
  } catch (error) {
    console.error(`[admin/team/bootstrap][${requestId}] unexpected error:`, error);
    return teamError('Server error', 500, requestId);
  }
}
