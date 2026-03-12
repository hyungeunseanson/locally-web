import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

const EDITABLE_SERVICE_REQUEST_STATUSES = new Set(['pending_payment', 'open']);

// PATCH: 어드민이 맞춤 의뢰 제목·내용 수정
export async function PATCH(req: NextRequest) {
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

    const { requestId, title, description } = await req.json();
    if (!requestId || (!title && !description)) {
      return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const { data: currentRequest, error: fetchError } = await supabaseAdmin
      .from('service_requests')
      .select('id, status, title, description')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchError) {
      console.error('[admin/service-requests] fetch error:', fetchError);
      return NextResponse.json({ success: false, error: '의뢰 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!currentRequest) {
      return NextResponse.json({ success: false, error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!EDITABLE_SERVICE_REQUEST_STATUSES.has(currentRequest.status || '')) {
      return NextResponse.json(
        { success: false, error: '이 상태의 의뢰는 수정할 수 없습니다.' },
        { status: 409 }
      );
    }

    const updates: Record<string, string> = {};
    const nextTitle = title?.trim();
    const nextDescription = description?.trim();

    if (nextTitle && nextTitle !== currentRequest.title) updates.title = nextTitle;
    if (typeof nextDescription === 'string' && nextDescription !== (currentRequest.description || '')) {
      updates.description = nextDescription;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: '변경된 내용이 없습니다.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('service_requests')
      .update(updates)
      .eq('id', requestId);

    if (updateError) {
      console.error('[admin/service-requests] update error:', updateError);
      return NextResponse.json({ success: false, error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_SERVICE_REQUEST_UPDATE',
      target_type: 'service_request',
      target_id: requestId,
      details: {
        request_status: currentRequest.status,
        before: {
          title: currentRequest.title,
          description: currentRequest.description || '',
        },
        after: updates,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/service-requests] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
