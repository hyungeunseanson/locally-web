import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';
import { recordAuditLog } from '@/app/utils/supabase/admin';

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
      return teamError('유효하지 않은 화이트리스트 ID입니다.', 400);
    }

    const { data: existingEntry, error: fetchError } = await context.supabaseAdmin
      .from('admin_whitelist')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[admin/team/whitelist/[id]] fetch error:', fetchError);
      return teamError('화이트리스트 정보를 불러오지 못했습니다.', 500);
    }

    if (!existingEntry) {
      return teamError('화이트리스트 항목을 찾을 수 없습니다.', 404);
    }

    const { error } = await context.supabaseAdmin
      .from('admin_whitelist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[admin/team/whitelist/[id]] delete error:', error);
      return teamError('화이트리스트 삭제에 실패했습니다.', 500);
    }

    await recordAuditLog({
      admin_id: context.user.id,
      admin_email: context.user.email,
      action_type: 'TEAM_WHITELIST_DELETE',
      target_type: 'admin_whitelist',
      target_id: id,
      details: { email: existingEntry.email || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/team/whitelist/[id]] unexpected error:', error);
    return teamError('Server error', 500);
  }
}
