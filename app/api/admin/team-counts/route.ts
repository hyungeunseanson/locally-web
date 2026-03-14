import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

// 팀 채팅방 전용 허수 ID (admin_task_comments 내에 채팅 메시지를 구분하는 고정 UUID)
const TEAM_CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawLastViewed = searchParams.get('lastViewed') || new Date(0).toISOString();
    const parsedLastViewed = Number.isNaN(new Date(rawLastViewed).getTime())
      ? new Date(0).toISOString()
      : rawLastViewed;

    const [tasksRes, commentsRes] = await Promise.all([
      supabaseAdmin
        .from('admin_tasks')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', parsedLastViewed),
      supabaseAdmin
        .from('admin_task_comments')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', parsedLastViewed)
        // 🔧 Fix: 팀 채팅방 메시지는 Task 뱃지 카운트에서 제외
        .neq('task_id', TEAM_CHAT_ROOM_ID),
    ]);

    const newTasksCount = tasksRes.count || 0;
    const newCommentsCount = commentsRes.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        newTasksCount,
        newCommentsCount,
        newWorkspaceCount: newTasksCount + newCommentsCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/team-counts error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
