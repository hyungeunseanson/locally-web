import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { refundPayPalCapture } from '@/app/utils/paypal/server';
import { notifyServiceCancellationCompleted } from '@/app/utils/serviceNotificationFlows';

type AdminCancelBody = {
  order_id?: string;
  refund_amount?: number;
  cancel_reason?: string;
};

export async function POST(request: Request) {
  try {
    // 1. Auth check
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

    const body = (await request.json()) as AdminCancelBody;
    const { order_id, refund_amount, cancel_reason = '관리자 강제 취소' } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: '주문 번호가 필요합니다.' }, { status: 400 });
    }


    // 3. Fetch booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select('id, order_id, request_id, customer_id, host_id, amount, tid, status, payment_method')
      .eq('order_id', order_id)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: false, error: '이미 취소된 예약입니다.' }, { status: 409 });
    }

    // Fetch service request title for notifications
    const { data: serviceRequest } = await supabaseAdmin
      .from('service_requests')
      .select('title')
      .eq('id', booking.request_id)
      .maybeSingle();
    const requestTitle = serviceRequest?.title || '맞춤 서비스';

    // 4. PENDING booking: DB cancel only, no PG call needed
    if (booking.status === 'PENDING') {
      // [Safety] PENDING 취소도 상태 조건 guard — 동시 요청에서 이중 처리 방어
      const { error: pendingCancelErr } = await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancelled', cancel_reason })
        .eq('order_id', order_id)
        .eq('status', 'PENDING');
      if (pendingCancelErr) {
        return NextResponse.json({ success: false, error: '취소 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }

      await supabaseAdmin
        .from('service_requests')
        .update({ status: 'cancelled' })
        .eq('id', booking.request_id);

      await recordAuditLog({
        admin_id: user.id,
        admin_email: user.email,
        action_type: 'ADMIN_SERVICE_CANCEL',
        target_type: 'service_booking',
        target_id: order_id,
        details: { cancel_reason, refund_amount: 0, pg_called: false },
      });

      await notifyServiceCancellationCompleted({
        supabaseAdmin,
        requestId: booking.request_id,
        requestTitle,
        customerId: booking.customer_id || null,
        hostId: booking.host_id || null,
        refundAmount: 0,
      });

      const adminMessage = `'${requestTitle}' 서비스 의뢰가 관리자에 의해 취소되었습니다. 주문번호: ${order_id}`;
      insertAdminAlerts({
        title: '서비스 의뢰가 강제 취소되었습니다',
        message: adminMessage,
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
      }).catch((adminAlertError) => {
        console.error('[ADMIN] service cancel admin alert error:', adminAlertError);
      });

      sendAdminAlertEmails({
        subject: '[Locally Admin] 서비스 강제 취소 완료',
        title: '서비스 의뢰가 강제 취소되었습니다',
        message: adminMessage,
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
        ctaLabel: '서비스 요청 보기',
      }).catch((adminEmailError) => {
        console.error('[ADMIN] service cancel admin email error:', adminEmailError);
      });

      return NextResponse.json({ success: true, message: '의뢰가 취소되었습니다 (결제 전).' });
    }

    // 5. PAID booking: call NicePay cancel FIRST — only update DB if PG succeeds

    // [Validation] refund_amount 범위 검증 — 음수 또는 booking.amount 초과 방어
    if (refund_amount !== undefined && (refund_amount < 0 || refund_amount > booking.amount)) {
      return NextResponse.json({ success: false, error: '환불 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const actualRefundAmount = refund_amount ?? booking.amount;

    // [Race Guard] PG 환불 전 atomic sentinel lock — 동시 어드민 요청의 이중 환불 차단
    // booking 상태를 cancellation_requested로 먼저 변경. 이미 변경됐으면 409 반환.
    const { data: lockRow, error: lockErr } = await supabaseAdmin
      .from('service_bookings')
      .update({ status: 'cancellation_requested' })
      .eq('order_id', order_id)
      .neq('status', 'cancelled')
      .neq('status', 'cancellation_requested')
      .select('id')
      .maybeSingle();

    if (lockErr) {
      return NextResponse.json({ success: false, error: '취소 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
    if (!lockRow) {
      return NextResponse.json({ success: false, error: '이미 취소 처리 중이거나 취소된 예약입니다.' }, { status: 409 });
    }

    if (booking.tid && actualRefundAmount > 0) {
      if (booking.payment_method === 'paypal') {
        try {
          const refund = await refundPayPalCapture(booking.tid, actualRefundAmount, 'KRW');
          if (!refund.status || !['COMPLETED', 'PENDING'].includes(refund.status)) {
            return NextResponse.json(
              { success: false, error: `PayPal 환불 거절: ${refund.status || '알 수 없는 상태'}` },
              { status: 400 }
            );
          }
        } catch (pgErr) {
          console.error('[ADMIN] PayPal refund exception:', pgErr);
          return NextResponse.json(
            { success: false, error: 'PayPal 환불 오류. DB 상태는 변경되지 않았습니다.' },
            { status: 500 }
          );
        }
      } else {
        try {
          await cancelCardPayment({
            providerTransactionId: booking.tid,
            orderId: booking.order_id,
            cancelAmount: actualRefundAmount,
            cancelReason: cancel_reason,
            totalAmount: booking.amount,
            requireMerchantKey: true,
            acceptedResultCodes: ['2001', '2030'],
          });
        } catch (pgErr) {
          console.error('[ADMIN] NicePay cancel exception:', pgErr);
          const message = pgErr instanceof Error ? pgErr.message : '';
          if (message.startsWith('Server Config Error')) {
            return NextResponse.json(
              { success: false, error: 'NicePay 환경변수 미설정. 수동 환불이 필요합니다.' },
              { status: 500 }
            );
          }
          return NextResponse.json(
            { success: false, error: 'NicePay 환불 네트워크 오류. DB 상태는 변경되지 않았습니다.' },
            { status: 500 }
          );
        }
      }
    }

    // 6. PG succeeded (or refund_amount=0): update DB — sentinel 상태에서만 최종 cancelled로 전환
    await supabaseAdmin
      .from('service_bookings')
      .update({ status: 'cancelled', cancel_reason, refund_amount: actualRefundAmount })
      .eq('order_id', order_id)
      .eq('status', 'cancellation_requested');

    await supabaseAdmin
      .from('service_requests')
      .update({ status: 'cancelled' })
      .eq('id', booking.request_id);

    await notifyServiceCancellationCompleted({
      supabaseAdmin,
      requestId: booking.request_id,
      requestTitle,
      customerId: booking.customer_id || null,
      hostId: booking.host_id || null,
      refundAmount: actualRefundAmount,
    });

    const adminMessage = `'${requestTitle}' 서비스 의뢰가 관리자에 의해 취소되었습니다. 주문번호: ${order_id}`;
    insertAdminAlerts({
      title: '서비스 의뢰가 강제 취소되었습니다',
      message: adminMessage,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('[ADMIN] service cancel admin alert error:', adminAlertError);
    });

    sendAdminAlertEmails({
      subject: '[Locally Admin] 서비스 강제 취소 완료',
      title: '서비스 의뢰가 강제 취소되었습니다',
      message: adminMessage,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
      ctaLabel: '서비스 요청 보기',
    }).catch((adminEmailError) => {
      console.error('[ADMIN] service cancel admin email error:', adminEmailError);
    });

    // 8. Audit log (fail-safe — from recordAuditLog)
    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_SERVICE_CANCEL',
      target_type: 'service_booking',
      target_id: order_id,
      details: {
        cancel_reason,
        refund_amount: actualRefundAmount,
        booking_status: booking.status,
        pg_called: !!(booking.tid && actualRefundAmount > 0),
      },
    });

    return NextResponse.json({ success: true, message: '강제 취소 및 환불 처리가 완료되었습니다.' });
  } catch (err: unknown) {
    console.error('[ADMIN] service-cancel error:', err);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
