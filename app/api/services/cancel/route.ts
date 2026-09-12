import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { refundPayPalCapture } from '@/app/utils/paypal/server';
import { notifyServiceCancellationCompleted, notifyServiceCancellationRequested } from '@/app/utils/serviceNotificationFlows';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type BeginResult = { operation_id: string; booking_id: string; previous_status: string; already_started: boolean };

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { order_id?: unknown; cancel_reason?: unknown; idempotency_key?: unknown };
    const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
    const reason = typeof body.cancel_reason === 'string' ? body.cancel_reason.trim().slice(0, 500) : '고객 요청 취소';
    const idempotencyKey = typeof body.idempotency_key === 'string' && /^[A-Za-z0-9:_-]{16,128}$/.test(body.idempotency_key)
      ? body.idempotency_key
      : `customer:${randomUUID()}`;
    if (!orderId) return NextResponse.json({ success: false, error: '주문 번호가 필요합니다.' }, { status: 400 });

    const supabaseAdmin = createAdminClient();
    const { data: booking } = await supabaseAdmin
      .from('service_bookings')
      .select('id, order_id, request_id, customer_id, host_id, amount, tid, status, payment_method, service_requests(title, status)')
      .eq('order_id', orderId)
      .maybeSingle();
    if (!booking) return NextResponse.json({ success: false, error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    if (booking.customer_id !== user.id && booking.host_id !== user.id) return NextResponse.json({ success: false, error: '취소 권한이 없습니다.' }, { status: 403 });

    const requestInfo = (Array.isArray(booking.service_requests) ? booking.service_requests[0] : booking.service_requests) as { title?: string; status?: string } | null;
    const requestTitle = requestInfo?.title || '맞춤 서비스';
    if (booking.status === 'cancelled') return NextResponse.json({ success: false, error: '이미 취소된 예약입니다.' }, { status: 409 });

    if (booking.status === 'PENDING') {
      const { error } = await supabaseAdmin.rpc('cancel_pending_service_concierge_atomic', { p_actor_id: user.id, p_order_id: orderId, p_cancel_reason: reason });
      if (error) return NextResponse.json({ success: false, error: '결제 전 취소를 처리하지 못했습니다.' }, { status: 409 });
      await notifyServiceCancellationCompleted({ supabaseAdmin, requestId: booking.request_id, requestTitle, customerId: booking.customer_id, hostId: booking.host_id, refundAmount: 0 });
      return NextResponse.json({ success: true, status: 'cancelled', message: '결제 전 의뢰가 취소되었습니다.' });
    }

    const preAssignment = booking.status === 'PAID' && !booking.host_id && ['assigning', 'open'].includes(requestInfo?.status || '');
    if (preAssignment && booking.payment_method !== 'bank') {
      const refundAmount = Number(booking.amount || 0);
      const { data: begin, error: beginError } = await supabaseAdmin.rpc('begin_service_refund_operation_atomic', {
        p_admin_id: user.id,
        p_order_id: orderId,
        p_refund_amount: refundAmount,
        p_host_compensation_amount: 0,
        p_idempotency_key: idempotencyKey,
      }).maybeSingle<BeginResult>();
      if (beginError || !begin || begin.already_started) return NextResponse.json({ success: false, error: '이미 취소·환불 처리 중입니다.' }, { status: 409 });
      await supabaseAdmin.from('service_bookings').update({ cancel_reason: reason }).eq('id', booking.id);

      let providerReference: string | null = null;
      try {
        if (refundAmount > 0 && booking.payment_method === 'paypal') {
          if (!booking.tid) throw new Error('Definitive Config Error: PayPal capture ID missing');
          const refund = await refundPayPalCapture(booking.tid, refundAmount, 'KRW');
          providerReference = refund.refundId || booking.tid;
          if (refund.status === 'PENDING') {
            await supabaseAdmin.rpc('finish_service_refund_operation_atomic', { p_operation_id: begin.operation_id, p_outcome: 'unknown', p_provider_reference: providerReference, p_error_message: 'PayPal refund pending' });
            void insertAdminAlerts({ title: '서비스 환불 대조 필요', message: `'${requestTitle}' PayPal 환불이 대기 중입니다.`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
            return NextResponse.json({ success: true, pending: true, status: 'cancellation_requested', message: '환불이 접수되어 완료 여부를 확인 중입니다.' });
          }
          if (refund.status !== 'COMPLETED') throw new Error(`Definitive Provider Rejection: ${refund.status || 'unknown'}`);
        } else if (refundAmount > 0) {
          if (!booking.tid) throw new Error('Definitive Config Error: card transaction ID missing');
          const result = await cancelCardPayment({ providerTransactionId: booking.tid, orderId, cancelAmount: refundAmount, cancelReason: reason, totalAmount: refundAmount, requireMerchantKey: true, acceptedResultCodes: ['2001', '2030'] });
          providerReference = result.resultCode;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const definitive = message.startsWith('Server Config Error') || message.startsWith('Definitive Config Error') || message.startsWith('Definitive Provider Rejection') || message.startsWith('PG Cancel Failed');
        await supabaseAdmin.rpc('finish_service_refund_operation_atomic', { p_operation_id: begin.operation_id, p_outcome: definitive ? 'failed' : 'unknown', p_provider_reference: providerReference, p_error_message: message.slice(0, 1000) });
        if (!definitive) void insertAdminAlerts({ title: '서비스 환불 결과 대조 필요', message: `'${requestTitle}' 환불 결과가 불확실합니다. 재시도하지 마세요.`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
        return NextResponse.json({ success: false, status: definitive ? begin.previous_status : 'cancellation_requested', code: definitive ? 'REFUND_FAILED' : 'REFUND_RECONCILIATION_REQUIRED', error: definitive ? '환불이 거절되었습니다. 현지 담당자에게 문의해 주세요.' : '환불 결과를 결제사와 대조 중입니다. 재요청하지 마세요.' }, { status: definitive ? 400 : 503 });
      }

      const { error: finishError } = await supabaseAdmin.rpc('finish_service_refund_operation_atomic', { p_operation_id: begin.operation_id, p_outcome: 'succeeded', p_provider_reference: providerReference, p_error_message: null });
      if (finishError) {
        void insertAdminAlerts({ title: '서비스 환불 DB 마감 필요', message: `'${requestTitle}' 환불은 성공했으나 DB 마감이 필요합니다. 재환불 금지.`, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
        return NextResponse.json({ success: false, status: 'cancellation_requested', code: 'REFUND_DB_RECONCILIATION_REQUIRED', error: '환불은 완료되었으나 상태 확인이 필요합니다.' }, { status: 500 });
      }
      await notifyServiceCancellationCompleted({ supabaseAdmin, requestId: booking.request_id, requestTitle, customerId: booking.customer_id, hostId: booking.host_id, refundAmount });
      return NextResponse.json({ success: true, status: 'cancelled', message: '호스트 배정 전 취소로 전액 환불되었습니다.' });
    }

    const { data: reviewData, error: reviewError } = await supabaseAdmin.rpc('request_service_cancellation_review_atomic', { p_actor_id: user.id, p_order_id: orderId, p_cancel_reason: reason }).maybeSingle<{ already_requested: boolean }>();
    if (reviewError) return NextResponse.json({ success: false, error: '취소 요청을 접수하지 못했습니다.' }, { status: 409 });
    if (!reviewData?.already_requested) await notifyServiceCancellationRequested({ supabaseAdmin, requestId: booking.request_id, requestTitle, customerId: booking.customer_id, hostId: booking.host_id });
    const adminMessage = preAssignment && booking.payment_method === 'bank'
      ? `'${requestTitle}' 호스트 배정 전 무통장 전액 환불 요청입니다.`
      : `'${requestTitle}' 배정 후 취소 검토 요청입니다.`;
    void insertAdminAlerts({ title: '서비스 취소 검토 필요', message: adminMessage, link: '/admin/dashboard?tab=SERVICE_REQUESTS' });
    void sendAdminAlertEmails({ subject: '[Locally Admin] 서비스 취소 검토', title: '서비스 취소 검토 필요', message: adminMessage, link: '/admin/dashboard?tab=SERVICE_REQUESTS', ctaLabel: '취소 검토' });
    return NextResponse.json({ success: true, status: 'cancellation_requested', message: preAssignment ? '전액 환불 요청이 접수되었습니다. 현지 담당자가 이체 후 안내합니다.' : '취소 요청이 접수되었습니다. 환불과 호스트 보상을 분리해 검토합니다.' });
  } catch (error) {
    captureServerException(error, { route: '/api/services/cancel', method: 'POST' });
    console.error('[service cancel] unexpected error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
