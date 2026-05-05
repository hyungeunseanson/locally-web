import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

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

    const { id } = await context.params;
    const experienceId = Number(id);

    if (!Number.isInteger(experienceId) || experienceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid experience id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { visible?: unknown };

    if (typeof body.visible !== 'boolean') {
      return NextResponse.json({ success: false, error: 'visible must be boolean' }, { status: 400 });
    }

    const { data: experience, error: updateError } = await supabaseAdmin
      .from('experiences')
      .update({ solo_guarantee_option_visible: body.visible })
      .eq('id', experienceId)
      .select('id, title, solo_guarantee_option_visible')
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!experience) {
      return NextResponse.json({ success: false, error: '체험을 찾을 수 없습니다.' }, { status: 404 });
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'UPDATE_EXPERIENCE_SOLO_GUARANTEE_OPTION_VISIBILITY',
      target_type: 'experiences',
      target_id: String(experienceId),
      details: {
        target_info: experience.title || String(experienceId),
        solo_guarantee_option_visible: body.visible,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: experience.id,
        solo_guarantee_option_visible: experience.solo_guarantee_option_visible,
      },
    });
  } catch (error) {
    console.error('[admin/experiences/:id/solo-guarantee-option] update failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
