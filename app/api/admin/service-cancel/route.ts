import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { refundPayPalCapture } from '@/app/utils/paypal/server';
import { notifyServiceCancellationCompleted } from '@/app/utils/serviceNotificationFlows';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type AdminCancelBody = {
  order_id?: unknown;
  refund_amount?: unknown;
  host_compensation_amount?: unknown;
  cancel_reason?: unknown;
  manual_refund_confirmed?: unknown;
  idempotency_key?: unknown;
};

type BeginResult = { operation_id: string; booking_id: string; previous_status: string; already_started: boolean };

async function finishRefund(supabaseAdmin: ReturnType<typeof createAdminClient>, operationId: string, outcome: 'succeeded' | 'failed' | 'unknown', providerReference: string | null, errorMessage: string | null) {
  return supabaseAdmin.rpc('finish_service_refund_operation_atomic', {
    p_operation_id: operationId,
    p_outcome: outcome,
    p_provider_reference: providerReference,
    p_error_message: errorMessage,
  });
}

export async function POST(request: Request) {
  const supabaseServer = await createServerClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, { userId: user.id, email: user.email });
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const body = await request.json() as AdminCancelBody;
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const reason = typeof body.cancel_reason === 'string' ? body.cancel_reason.trim().slice(0, 500) : '관리자 취소';
  const idempotencyKey = typeof body.idempotency_key === 'string' && /^[A-Za-z0-9:_-]{16,128}$/.test(body.idempotency_key)
    ? body.idempotency_key
    : `admin:${randomUUID()}`;
  if (!orderId) return NextResponse.json({ success: false, error: '주문 번호가 필요합니다.' }, { status: 400 });

  const { data: booking } = await supabaseAdmin
    .from('service_bookings')
    .select('id, order_id, request_id, customer_id, host_id, amount, host_payout_amount, tid, status, payment_method')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!booking) return NextResponse.json({ success: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
  const { data: serviceRequest } = await supabaseAdmin.from('service_requests').select('title').eq('id', booking.request_id).maybeSingle();
  const requestTitle = serviceRequest?.title || '맞춤 서비스';

  if (booking.status === 'PENDING') {
    const { error } = await supabaseAdmin.rpc('cancel_pending_service_concierge_atomic', { p_actor_id: user.id, p_order_id: orderId, p_cancel_reason: reason });
    if (error) return NextResponse.json({ success: false, error: '결제 전 취소 처리에 실패했습니다.' }, { status: 409 });
    await notifyServiceCancellationCompleted({ supabaseAdmin, requestId: booking.request_id, requestTitle, customerId: booking.customer_id, hostId: booking.host_id, refundAmount: 0 });
    await recordAuditLog({ admin_id: user.id, admin_email: user.email, action_type: 'ADMIN_SERVICE_CANCEL_PENDING', target_type: 'service_booking', target_id: orderId, details: { reason } });
    return NextResponse.json({ success: true, message: '결제 전 의뢰가 취소되었습니다.' });
  }

  const refundAmount = body.refund_amount === undefined ? booking.amount : Number(body.refund_amount);
  const hostCompensation = body.host_compensation_amount === undefined ? 0 : Number(body.host_compensation_amount);
  if (!Number.isInteger(refundAmount) || refundAmount < 0 || refundAmount > booking.amount || !Number.isInteger(hostCompensation) || hostCompensation < 0 || hostCompensation > Number(booking.host_payout_amount || 0)) {
    return NextResponse.json({ success: false, error: '환불액 또는 호스트 보상액을 확인해주세요.' }, { status: 400 });
  }
  if (booking.payment_method === 'bank' && refundAmount > 0 && body.manual_refund_confirmed !== true) {
    return NextResponse.json({ success: false, error: '무통장 환불 이체 완료 확인이 필요합니다.' }, { status: 400 });
  }

  const { data: beginData, error: beginError } = await supabaseAdmin.rpc('begin_service_refund_operation_atomic', {
    p_admin_id: user.id,
    p_order_id: orderId,
    p_refund_amount: refundAmount,
    p_host_compensation_amount: hostCompensation,
    p_idempotency_key: idempotencyKey,
  }).maybeSingle<BeginResult>();
  if (beginError || !beginData) {
    const detail = beginError?.message || '';
    const status = detail.includes('SVC_REFUND_IN_PROGRESS') || detail.includes('SVC_ALREADY_CANCELLED') ? 409 : 500;
    return NextResponse.json({ success: false, error: status === 409 ? '이미 환불 처리 중이거나 완료된 주문입니다.' : '환불 작업을 시작하지 못했습니다.' }, { status });
  }
  if (beginData.already_started) {
    return NextResponse.json({ success: false, error: '동일한 환불 요청이 이미 처리되었습니다. 작업 이력을 확인해주세요.' }, { status: 409 });
  }
  await supabaseAdmin.from('service_bookings').update({ cancel_reason: reason }).eq('id', booking.id);

  let providerReference: string | null = null;
  try {
    if (refundAmount > 0 && booking.payment_method === 'paypal') {
      if (!booking.tid) throw new Error('Definitive Config Error: PayPal capture ID missing');
      const refund = await refundPayPalCapture(booking.tid, refundAmount, 'KRW');
      providerReference = refund.refundId || booking.tid;
      if (refund.status === 'PENDING') {
        await finishRefund(supabaseAdmin, beginData.operation_id, 'unknown', providerReference, 'PayPal refund pending');
        void insertAdminAlerts({ title: '서비스 환불 대조 필요', message: `'${requestTitle}' PayPal 환불이 대기 중입니다. 재환불하지 말고 결제사 결과를 확인해주세요.`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
        return NextResponse.json({ success: false, code: 'REFUND_RECONCILIATION_REQUIRED', error: 'PayPal 환불이 대기 중입니다. 작업 이력에서 완료 여부를 확인해주세요.' }, { status: 202 });
      }
      if (refund.status !== 'COMPLETED') throw new Error(`Definitive Provider Rejection: ${refund.status || 'unknown'}`);
    } else if (refundAmount > 0 && booking.payment_method !== 'bank') {
      if (!booking.tid) throw new Error('Definitive Config Error: card transaction ID missing');
      const result = await cancelCardPayment({ providerTransactionId: booking.tid, orderId, cancelAmount: refundAmount, cancelReason: reason, totalAmount: booking.amount, requireMerchantKey: true, acceptedResultCodes: ['2001', '2030'] });
      providerReference = result.resultCode;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const definitive = message.startsWith('Server Config Error') || message.startsWith('Definitive Config Error') || message.startsWith('Definitive Provider Rejection') || message.startsWith('PG Cancel Failed');
    await finishRefund(supabaseAdmin, beginData.operation_id, definitive ? 'failed' : 'unknown', providerReference, message.slice(0, 1000));
    if (!definitive) {
      void insertAdminAlerts({ title: '서비스 환불 결과 대조 필요', message: `'${requestTitle}' 환불 결과가 불확실합니다. 재환불하지 말고 결제사 결과를 확인해주세요.`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
    }
    return NextResponse.json({ success: false, code: definitive ? 'REFUND_FAILED' : 'REFUND_RECONCILIATION_REQUIRED', error: definitive ? '환불이 거절되어 취소 상태를 복구했습니다.' : '환불 결과가 불확실합니다. 재시도하지 말고 결제사 결과를 대조해주세요.' }, { status: definitive ? 400 : 503 });
  }

  const { error: finishError } = await finishRefund(supabaseAdmin, beginData.operation_id, 'succeeded', providerReference, null);
  if (finishError) {
    void insertAdminAlerts({ title: '서비스 환불 DB 마감 필요', message: `'${requestTitle}' 환불은 성공했지만 DB 마감이 필요합니다. 절대 재환불하지 마세요.`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
    return NextResponse.json({ success: false, code: 'REFUND_DB_RECONCILIATION_REQUIRED', error: '환불은 성공했지만 DB 마감이 필요합니다. 절대 재환불하지 마세요.' }, { status: 500 });
  }

  await notifyServiceCancellationCompleted({ supabaseAdmin, requestId: booking.request_id, requestTitle, customerId: booking.customer_id, hostId: booking.host_id, refundAmount });
  void insertAdminAlerts({ title: '서비스 취소·환불 완료', message: `'${requestTitle}' 환불 ${refundAmount.toLocaleString()}원, 호스트 보상 ${hostCompensation.toLocaleString()}원`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
  await recordAuditLog({ admin_id: user.id, admin_email: user.email, action_type: 'ADMIN_SERVICE_REFUND_APPLIED', target_type: 'service_booking', target_id: orderId, details: { operation_id: beginData.operation_id, refund_amount: refundAmount, host_compensation_amount: hostCompensation, provider_reference: providerReference, reason } });
  return NextResponse.json({ success: true, message: '취소·환불 처리가 완료되었습니다.' });
}
