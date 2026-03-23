import { NextResponse } from 'next/server';

import { resolveTeamAdminContext, teamError, TEAM_CHAT_ROOM_ID } from '@/app/api/admin/team/_shared';

export async function GET() {
  try {
    const context = await resolveTeamAdminContext();
    if ('response' in context) {
      return context.response;
    }

    const { data, error } = await context.supabaseAdmin
      .from('admin_task_comments')
      .select('*')
      .eq('task_id', TEAM_CHAT_ROOM_ID)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[admin/team/chat] fetch error:', error);
      return teamError('팀 채팅을 불러오지 못했습니다.', 500);
    }

    return NextResponse.json({
      success: true,
      currentUser: {
        id: context.user.id,
        name: context.authorName,
      },
      messages: data ?? [],
    });
  } catch (error) {
    console.error('[admin/team/chat] unexpected error:', error);
    return teamError('Server error', 500);
  }
}
