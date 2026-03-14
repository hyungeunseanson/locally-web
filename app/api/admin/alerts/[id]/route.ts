import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

function parseAlertId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getValidatedAdminAndAlertId(id: string) {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const alertId = parseAlertId(id);
  if (!alertId) {
    return { error: NextResponse.json({ success: false, error: '유효하지 않은 알림 ID입니다.' }, { status: 400 }) };
  }

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
    userId: user.id,
    email: user.email,
  });

  if (!isAdmin) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabaseAdmin, user, alertId };
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getValidatedAdminAndAlertId(id);
    if ('error' in context) return context.error;

    const { supabaseAdmin, user, alertId } = context;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', alertId)
      .eq('user_id', user.id)
      .eq('type', 'admin_alert')
      .select('id, is_read')
      .maybeSingle();

    if (error) {
      console.error('[admin/alerts/[id]] PATCH failed:', error);
      return NextResponse.json({ success: false, error: '알림 읽음 처리에 실패했습니다.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '알림을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[admin/alerts/[id]] PATCH unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getValidatedAdminAndAlertId(id);
    if ('error' in context) return context.error;

    const { supabaseAdmin, user, alertId } = context;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', alertId)
      .eq('user_id', user.id)
      .eq('type', 'admin_alert')
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[admin/alerts/[id]] DELETE failed:', error);
      return NextResponse.json({ success: false, error: '알림 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '알림을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/alerts/[id]] DELETE unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
