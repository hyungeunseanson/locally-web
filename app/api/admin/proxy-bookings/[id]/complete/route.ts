import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { validPhoneId, validPhoneRequestId, validPhoneSnapshot } from '@/app/utils/phoneFollowup';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ success: false }, { status: 401 });
    const admin = createAdminClient();
    if (!(await resolveAdminAccess(admin, { userId: user.id, email: user.email })).isAdmin) {
      return NextResponse.json({ success: false }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!validPhoneRequestId(id) || !validPhoneId(body?.inquiryId) || !validPhoneSnapshot(body?.seenCustomerMessageIds)) {
      return NextResponse.json({ success: false, error: '대화를 다시 확인한 후 처리해주세요.' }, { status: 400 });
    }
    const { data, error: completionError } = await admin.rpc('complete_phone_request', {
      p_request_id: id, p_inquiry_id: body.inquiryId, p_message_ids: body.seenCustomerMessageIds, p_admin_id: user.id,
    });
    if (completionError || !data) {
      const status = completionError?.code === '42501' ? 403 : ['22023', 'P0001'].includes(completionError?.code ?? '') ? 409 : 500;
      return NextResponse.json({ success: false, error: '완료 처리하지 못했습니다. 새로고침 후 상태와 연결된 대화를 확인해주세요.' }, { status });
    }
    return NextResponse.json({ success: true, ...data });
  } catch {
    return NextResponse.json({ success: false, error: '완료 처리 결과를 확인하지 못했습니다. 새로고침 후 다시 확인해주세요.' }, { status: 500 });
  }
}
