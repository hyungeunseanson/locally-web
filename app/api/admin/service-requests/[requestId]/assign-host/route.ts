import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type AssignResult = { request_id: string; host_id: string; host_hourly_rate: number; host_payout_amount: number; host_inquiry_id: string; already_assigned: boolean };

function assignmentError(error: { message?: string | null; details?: string | null } | null) {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  if (message.includes('SVC_HOST_AGREEMENT_REQUIRED')) return { status: 400, error: '호스트의 일정·보수 동의 확인이 필요합니다.' };
  if (message.includes('SVC_HOST_NOT_APPROVED')) return { status: 400, error: '승인된 호스트만 배정할 수 있습니다.' };
  if (message.includes('SVC_HOST_IS_CUSTOMER')) return { status: 400, error: '고객 본인을 호스트로 배정할 수 없습니다.' };
  if (message.includes('SVC_HOST_SCHEDULE_CONFLICT')) return { status: 409, error: '이 호스트의 기존 예약과 시간이 겹칩니다. 다른 호스트 또는 일정을 확인해주세요.' };
  if (message.includes('SVC_INVALID_HOST_RATE')) return { status: 400, error: '호스트 시간당 보수를 확인해주세요.' };
  if (message.includes('SVC_ASSIGN_INVALID_STATUS')) return { status: 409, error: '결제 확인 후 배정 대기 상태에서만 배정할 수 있습니다.' };
  if (message.includes('SVC_ALREADY_ASSIGNED')) return { status: 409, error: '이미 다른 호스트가 배정되었습니다. 목록을 새로고침해주세요.' };
  if (message.includes('SVC_ASSIGN_FORBIDDEN')) return { status: 403, error: '호스트 배정 권한이 없습니다.' };
  return { status: 500, error: '호스트 배정 중 오류가 발생했습니다.' };
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await context.params;
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, { userId: user.id, email: user.email });
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const body = await request.json() as { hostId?: unknown; hostHourlyRate?: unknown; hostAgreementConfirmed?: unknown };
  const hostId = typeof body.hostId === 'string' ? body.hostId.trim() : '';
  const hostHourlyRate = Number(body.hostHourlyRate);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(requestId) || !uuidPattern.test(hostId) || !Number.isInteger(hostHourlyRate) || hostHourlyRate <= 0 || body.hostAgreementConfirmed !== true) {
    return NextResponse.json({ success: false, error: '호스트, 보수, 동의 확인을 모두 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('assign_service_concierge_host_atomic', {
    p_admin_id: user.id,
    p_request_id: requestId,
    p_host_id: hostId,
    p_host_hourly_rate: hostHourlyRate,
    p_host_agreement_confirmed: true,
  }).maybeSingle<AssignResult>();
  if (error || !data) {
    console.error('[admin/service assignment] RPC failed:', error);
    const mapped = assignmentError(error);
    return NextResponse.json({ success: false, error: mapped.error }, { status: mapped.status });
  }

  const { data: serviceRequest } = await supabaseAdmin
    .from('service_requests')
    .select('title, user_id')
    .eq('id', requestId)
    .maybeSingle();
  if (serviceRequest && !data.already_assigned) {
    try {
      const [customerNotice, hostNotice] = await Promise.all([
        buildLocalizedNotificationInsert({ supabaseAdmin, userId: serviceRequest.user_id, type: 'service_host_selected', link: `/guest/inbox?inquiryId=${encodeURIComponent(data.host_inquiry_id)}`, key: 'service.host_selected', copyParams: { requestTitle: serviceRequest.title } }),
        buildLocalizedNotificationInsert({ supabaseAdmin, userId: hostId, type: 'service_host_selected', link: `/host/dashboard?tab=inquiries&inquiryId=${encodeURIComponent(data.host_inquiry_id)}`, key: 'service.host_selected', copyParams: { requestTitle: serviceRequest.title } }),
      ]);
      await supabaseAdmin.from('notifications').insert([customerNotice, hostNotice]);
      void Promise.allSettled([
        sendImmediateGenericEmail({ recipientUserId: serviceRequest.user_id, subject: '', title: '', message: '', templatedEmail: { templateId: 'notice.copy', audience: 'guest', payload: { copyKey: 'service.host_selected', copyParams: { requestTitle: serviceRequest.title }, ctaUrl: `/guest/inbox?inquiryId=${encodeURIComponent(data.host_inquiry_id)}` } } }),
        sendImmediateGenericEmail({ recipientUserId: hostId, subject: '', title: '', message: '', templatedEmail: { templateId: 'notice.copy', audience: 'host', payload: { copyKey: 'service.host_selected', copyParams: { requestTitle: serviceRequest.title }, ctaUrl: `/host/dashboard?tab=inquiries&inquiryId=${encodeURIComponent(data.host_inquiry_id)}` } } }),
      ]).catch((emailError) => console.error('[admin/service assignment] email failed:', emailError));
    } catch (notificationError) {
      console.error('[admin/service assignment] notification failed:', notificationError);
    }
  }

  if (!data.already_assigned) {
    await recordAuditLog({ admin_id: user.id, admin_email: user.email, action_type: 'ADMIN_SERVICE_HOST_ASSIGN', target_type: 'service_request', target_id: requestId, details: { host_id: hostId, host_hourly_rate: data.host_hourly_rate, host_payout_amount: data.host_payout_amount, host_agreement_confirmed: true } });
  }
  return NextResponse.json({ success: true, data: { hostId: data.host_id, hostHourlyRate: data.host_hourly_rate, hostPayoutAmount: data.host_payout_amount, hostInquiryId: data.host_inquiry_id, alreadyAssigned: data.already_assigned } });
}
