import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isAdminSupportInquiry } from '@/app/utils/inquiry';

const ALLOWED_STATUSES = new Set(['open', 'in_progress', 'resolved']);

type InquiryStatusRow = {
  id: number | string;
  type: string | null;
  status: string | null;
  user_id: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

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

    const { id } = await params;
    const inquiryId = Number(id);
    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ success: false, error: '유효하지 않은 문의 ID입니다.' }, { status: 400 });
    }

    const body = await request.json();
    const nextStatus = typeof body?.status === 'string' ? body.status : '';

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 상태값입니다.' }, { status: 400 });
    }

    const { data: inquiry, error: inquiryError } = await supabaseAdmin
      .from('inquiries')
      .select('id, type, status, user_id')
      .eq('id', inquiryId)
      .maybeSingle<InquiryStatusRow>();

    if (inquiryError) {
      console.error('[admin/inquiries/[id]/status] fetch error:', inquiryError);
      return NextResponse.json({ success: false, error: '문의 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!inquiry) {
      return NextResponse.json({ success: false, error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!isAdminSupportInquiry(inquiry.type)) {
      return NextResponse.json({ success: false, error: '관리자 1:1 문의만 상태를 변경할 수 있습니다.' }, { status: 409 });
    }

    if (inquiry.status === nextStatus) {
      return NextResponse.json({ success: true, data: { id: inquiryId, status: nextStatus } });
    }

    const { data: updatedInquiry, error: updateError } = await supabaseAdmin
      .from('inquiries')
      .update({ status: nextStatus })
      .eq('id', inquiryId)
      .select('id, status')
      .maybeSingle();

    if (updateError) {
      console.error('[admin/inquiries/[id]/status] update error:', updateError);
      return NextResponse.json({ success: false, error: '문의 상태 변경에 실패했습니다.' }, { status: 500 });
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_INQUIRY_STATUS_UPDATE',
      target_type: 'inquiries',
      target_id: String(inquiryId),
      details: {
        inquiry_type: inquiry.type,
        guest_id: inquiry.user_id,
        before_status: inquiry.status || 'open',
        after_status: nextStatus,
      },
    });

    return NextResponse.json({ success: true, data: updatedInquiry });
  } catch (error) {
    console.error('[admin/inquiries/[id]/status] unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
