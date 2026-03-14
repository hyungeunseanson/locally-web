import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamAdminContext, teamError } from '@/app/api/admin/team/_shared';
import { recordAuditLog } from '@/app/utils/supabase/admin';

function normalizeEmail(rawEmail: unknown) {
  if (typeof rawEmail !== 'string') return '';
  return rawEmail.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTeamAdminContext();
    if ('response' in context) {
      return context.response;
    }

    const body = await request.json();
    const email = normalizeEmail(body?.email);

    if (!email) {
      return teamError('이메일을 입력해주세요.', 400);
    }

    const { data, error } = await context.supabaseAdmin
      .from('admin_whitelist')
      .insert({ email })
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return teamError('이미 화이트리스트에 존재하는 이메일입니다.', 409);
      }
      console.error('[admin/team/whitelist] create error:', error);
      return teamError('화이트리스트 추가에 실패했습니다.', 500);
    }

    await recordAuditLog({
      admin_id: context.user.id,
      admin_email: context.user.email,
      action_type: 'TEAM_WHITELIST_ADD',
      target_type: 'admin_whitelist',
      target_id: String(data?.id || email),
      details: { email },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('[admin/team/whitelist] unexpected error:', error);
    return teamError('Server error', 500);
  }
}
