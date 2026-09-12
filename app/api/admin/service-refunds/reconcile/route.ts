import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { notifyServiceCancellationCompleted } from '@/app/utils/serviceNotificationFlows';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ReconcileBody = {
  operationId?: unknown;
  outcome?: unknown;
  providerVerified?: unknown;
  providerReference?: unknown;
};

type RefundOperation = {
  id: string;
  booking_id: string;
  status: 'started' | 'succeeded' | 'failed' | 'unknown' | 'applied';
  refund_amount: number;
  host_compensation_amount: number;
  created_at: string;
};

type FinishResult = {
  booking_id: string;
  request_id: string;
  operation_status: string;
};

export async function POST(request: Request) {
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, { userId: user.id, email: user.email });
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as ReconcileBody;
  const operationId = typeof body.operationId === 'string' ? body.operationId.trim() : '';
  const outcome = body.outcome === 'succeeded' || body.outcome === 'failed' ? body.outcome : null;
  const providerReference = typeof body.providerReference === 'string'
    ? body.providerReference.trim().slice(0, 500) || null
    : null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId) || !outcome) {
    return NextResponse.json({ success: false, error: '환불 작업과 확인 결과를 확인해주세요.' }, { status: 400 });
  }
  if (body.providerVerified !== true) {
    return NextResponse.json({ success: false, error: '결제사 관리자 화면 확인이 필요합니다.' }, { status: 400 });
  }

  const { data: operation, error: operationError } = await supabaseAdmin
    .from('service_refund_operations')
    .select('id, booking_id, status, refund_amount, host_compensation_amount, created_at')
    .eq('id', operationId)
    .maybeSingle<RefundOperation>();

  if (operationError || !operation) {
    return NextResponse.json({ success: false, error: '환불 작업을 찾을 수 없습니다.' }, { status: 404 });
  }
  if ((outcome === 'succeeded' && operation.status === 'applied') || (outcome === 'failed' && operation.status === 'failed')) {
    return NextResponse.json({ success: true, alreadyFinalized: true, message: '이미 같은 결과로 마감된 작업입니다.' });
  }
  if (!['started', 'unknown'].includes(operation.status)) {
    return NextResponse.json({ success: false, error: '이미 다른 결과로 마감된 작업입니다.' }, { status: 409 });
  }
  if (operation.status === 'started' && Date.now() - new Date(operation.created_at).getTime() < 10 * 60_000) {
    return NextResponse.json({ success: false, error: '환불 요청이 아직 실행 중일 수 있습니다. 시작 후 10분이 지난 뒤 결제사 결과를 대조해주세요.' }, { status: 409 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('service_bookings')
    .select('id, order_id, request_id, customer_id, host_id')
    .eq('id', operation.booking_id)
    .maybeSingle();
  if (bookingError || !booking) {
    return NextResponse.json({ success: false, error: '연결된 예약을 찾을 수 없습니다.' }, { status: 409 });
  }

  const { data: finishData, error: finishError } = await supabaseAdmin.rpc('finish_service_refund_operation_atomic', {
    p_operation_id: operation.id,
    p_outcome: outcome,
    p_provider_reference: providerReference,
    p_error_message: outcome === 'failed' ? '관리자 결제사 대조 후 실패 확정' : null,
  }).maybeSingle<FinishResult>();

  if (finishError || !finishData) {
    return NextResponse.json({ success: false, error: '환불 작업 마감에 실패했습니다. 재환불하지 말고 기술 확인이 필요합니다.' }, { status: 500 });
  }

  const { data: serviceRequest } = await supabaseAdmin
    .from('service_requests')
    .select('title')
    .eq('id', booking.request_id)
    .maybeSingle();
  const requestTitle = serviceRequest?.title || '맞춤 서비스';

  if (outcome === 'succeeded') {
    await notifyServiceCancellationCompleted({
      supabaseAdmin,
      requestId: booking.request_id,
      requestTitle,
      customerId: booking.customer_id,
      hostId: booking.host_id,
      refundAmount: operation.refund_amount,
    });
  }

  void insertAdminAlerts({
    title: outcome === 'succeeded' ? '서비스 환불 대조 완료' : '서비스 환불 실패 확정',
    message: outcome === 'succeeded'
      ? `'${requestTitle}' 환불 ${operation.refund_amount.toLocaleString()}원 결과를 결제사와 대조해 취소 마감했습니다.`
      : `'${requestTitle}' 환불 실패를 결제사와 대조해 예약 상태를 복구했습니다.`,
    link: '/admin/dashboard?tab=SERVICE_REQUESTS',
  });
  await recordAuditLog({
    admin_id: user.id,
    admin_email: user.email,
    action_type: outcome === 'succeeded' ? 'ADMIN_SERVICE_REFUND_RECONCILED_SUCCESS' : 'ADMIN_SERVICE_REFUND_RECONCILED_FAILED',
    target_type: 'service_booking',
    target_id: booking.order_id || booking.id,
    details: {
      operation_id: operation.id,
      refund_amount: operation.refund_amount,
      host_compensation_amount: operation.host_compensation_amount,
      provider_reference: providerReference,
    },
  });

  return NextResponse.json({
    success: true,
    message: outcome === 'succeeded' ? '환불 성공 결과로 취소 마감했습니다.' : '환불 실패 결과로 예약 상태를 복구했습니다.',
  });
}
