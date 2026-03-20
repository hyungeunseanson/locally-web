import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import {
  notifyServiceCancellationCompleted,
  notifyServiceCancellationRequested,
} from '@/app/utils/serviceNotificationFlows';
import { refundPayPalCapture } from '@/app/utils/paypal/server';
import { captureServerException } from '@/app/utils/monitoring/sentry';

type CancelBody = {
  order_id?: string;
  cancel_reason?: string;
};

type RefundResult =
  | { ok: true; refundAmount: number }
  | { ok: false; error: string; status: number };

async function refundPaidOpenServiceBooking(
  booking: { amount: number | null; order_id: string; payment_method: string | null; tid: string | null },
  cancelReason: string
): Promise<RefundResult> {
  const refundAmount = Number(booking.amount || 0);

  if (refundAmount <= 0) {
    return { ok: true, refundAmount: 0 };
  }

  if (booking.payment_method === 'paypal') {
    if (!booking.tid) {
      return {
        ok: false,
        error: 'PayPal 환불 정보가 없어 취소를 완료할 수 없습니다. 관리자에게 문의해주세요.',
        status: 400,
      };
    }

    try {
      const refund = await refundPayPalCapture(booking.tid, refundAmount, 'KRW');
      if (!refund.status || !['COMPLETED', 'PENDING'].includes(refund.status)) {
        return {
          ok: false,
          error: `PayPal 환불 거절: ${refund.status || '알 수 없는 상태'}`,
          status: 400,
        };
      }

      return { ok: true, refundAmount };
    } catch (error) {
      console.error('[SERVICE] PayPal refund exception:', error);
      return {
        ok: false,
        error: 'PayPal 환불 오류로 취소를 완료하지 못했습니다. DB 상태는 변경되지 않았습니다.',
        status: 500,
      };
    }
  }

  if (!booking.tid) {
    return {
      ok: false,
      error: '카드 환불 정보가 없어 취소를 완료하지 못했습니다. 관리자에게 문의해주세요.',
      status: 500,
    };
  }

  try {
    await cancelCardPayment({
      providerTransactionId: booking.tid,
      orderId: booking.order_id,
      cancelAmount: refundAmount,
      cancelReason,
      totalAmount: refundAmount,
      requireMerchantKey: true,
      acceptedResultCodes: ['2001', '2030'],
    });
    return { ok: true, refundAmount };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Server Config Error')) {
      return {
        ok: false,
        error: '카드 환불 정보가 없어 취소를 완료하지 못했습니다. 관리자에게 문의해주세요.',
        status: 500,
      };
    }

    console.error('[SERVICE] NicePay cancel exception:', error);
    return {
      ok: false,
      error: 'NicePay 환불 네트워크 오류로 취소를 완료하지 못했습니다. DB 상태는 변경되지 않았습니다.',
      status: 500,
    };
  }
}

export async function POST(request: Request) {
  let targetOrderId: string | null = null;
  let bookingStatusBeforeLock: string | null = null;
  let cancellationLockAcquired = false;
  let cancellationCommitted = false;

  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CancelBody;
    const { order_id, cancel_reason = '고객 요청 취소' } = body;
    targetOrderId = typeof order_id === 'string' ? order_id : null;

    if (!order_id) {
      return NextResponse.json({ success: false, error: '주문 번호가 필요합니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. service_bookings 조회 (service_requests.status 포함)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('service_bookings')
      .select('*, service_requests(title, user_id, status)')
      .eq('order_id', order_id)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    bookingStatusBeforeLock = typeof booking.status === 'string' ? booking.status : null;

    // 2. 권한 검증 (고객 또는 호스트만)
    const isCustomer = booking.customer_id === user.id;
    const isHost = booking.host_id === user.id;

    if (!isCustomer && !isHost) {
      return NextResponse.json({ success: false, error: '취소 권한이 없습니다.' }, { status: 403 });
    }

    // 3. 이미 취소된 경우
    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: false, error: '이미 취소된 예약입니다.' }, { status: 409 });
    }

    const requestInfo = booking.service_requests as { title?: string; user_id?: string; status?: string } | null;
    const requestTitle = requestInfo?.title || '맞춤 서비스';
    const requestStatus = requestInfo?.status ?? '';

    // 4. PENDING 상태면 바로 취소 (결제 전 — PG 환불 불필요)
    if (booking.status === 'PENDING') {
      await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancelled', cancel_reason })
        .eq('order_id', order_id);

      await supabaseAdmin
        .from('service_requests')
        .update({ status: 'cancelled' })
        .eq('id', booking.request_id);

      const adminMessage = `'${requestTitle}' 서비스 의뢰가 결제 전 단계에서 취소되었습니다. 주문번호: ${order_id}`;
      insertAdminAlerts({
        title: '서비스 의뢰가 취소되었습니다',
        message: adminMessage,
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
      }).catch((adminAlertError) => {
        console.error('Service Cancel Admin Alert Error:', adminAlertError);
      });

      sendAdminAlertEmails({
        subject: '[Locally Admin] 서비스 의뢰 취소',
        title: '서비스 의뢰가 취소되었습니다',
        message: adminMessage,
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
        ctaLabel: '서비스 요청 보기',
      }).catch((adminEmailError) => {
        console.error('Service Cancel Admin Email Error:', adminEmailError);
      });

      await notifyServiceCancellationCompleted({
        supabaseAdmin,
        requestId: booking.request_id,
        requestTitle,
        customerId: booking.customer_id || null,
        hostId: booking.host_id || null,
        refundAmount: 0,
      });

      return NextResponse.json({ success: true, message: '의뢰가 취소되었습니다.' });
    }

    // 5. PAID + open (호스트 미선택) → NicePay 전액 환불
    if (booking.status === 'PAID' && requestStatus === 'open') {
      // [Race Guard] PG 환불 전 atomic lock — 이중 환불 방지
      const { data: lockAcquired } = await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancellation_requested' })
        .eq('order_id', order_id)
        .eq('status', 'PAID')
        .select('order_id')
        .maybeSingle();

      if (!lockAcquired) {
        return NextResponse.json({ success: false, error: '이미 취소 처리 중이거나 취소된 예약입니다.' }, { status: 409 });
      }

      cancellationLockAcquired = true;

      const refundResult = await refundPaidOpenServiceBooking(
        {
          amount: booking.amount,
          order_id: booking.order_id,
          payment_method: booking.payment_method,
          tid: booking.tid,
        },
        cancel_reason
      );

      if (!refundResult.ok) {
        await supabaseAdmin
          .from('service_bookings')
          .update({ status: 'PAID' })
          .eq('order_id', order_id)
          .eq('status', 'cancellation_requested');

        cancellationLockAcquired = false;
        return NextResponse.json({ success: false, error: refundResult.error }, { status: refundResult.status });
      }

      await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancelled', cancel_reason, refund_amount: refundResult.refundAmount })
        .eq('order_id', order_id)
        .eq('status', 'cancellation_requested');

      cancellationCommitted = true;

      await supabaseAdmin
        .from('service_requests')
        .update({ status: 'cancelled' })
        .eq('id', booking.request_id);

      const adminMessage = `'${requestTitle}' 서비스 의뢰가 환불과 함께 취소되었습니다. 주문번호: ${order_id}`;
      insertAdminAlerts({
        title: '서비스 환불 취소가 처리되었습니다',
        message: adminMessage,
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
      }).catch((adminAlertError) => {
        console.error('Service Refund Cancel Admin Alert Error:', adminAlertError);
      });

      sendAdminAlertEmails({
        subject: '[Locally Admin] 서비스 환불 취소 완료',
        title: '서비스 환불 취소가 처리되었습니다',
        message: adminMessage,
        link: '/admin/dashboard?tab=SERVICE_REQUESTS',
        ctaLabel: '서비스 요청 보기',
      }).catch((adminEmailError) => {
        console.error('Service Refund Cancel Admin Email Error:', adminEmailError);
      });

      await notifyServiceCancellationCompleted({
        supabaseAdmin,
        requestId: booking.request_id,
        requestTitle,
        customerId: booking.customer_id || null,
        hostId: booking.host_id || null,
        refundAmount: refundResult.refundAmount,
      });

      return NextResponse.json({ success: true, message: '의뢰가 취소되고 환불이 처리됩니다.' });
    }

    // 6. PAID + matched/confirmed 이후 취소 요청 (관리자 검토)
    await supabaseAdmin
      .from('service_bookings')
      .update({ status: 'cancellation_requested', cancel_reason })
      .eq('order_id', order_id);

    await notifyServiceCancellationRequested({
      supabaseAdmin,
      requestId: booking.request_id,
      requestTitle,
      customerId: booking.customer_id || null,
      hostId: booking.host_id || null,
    });

    const adminMessage = `'${requestTitle}' 서비스에 취소 요청이 접수되었습니다. 주문번호: ${order_id}`;
    insertAdminAlerts({
      title: '서비스 취소 요청이 접수되었습니다',
      message: adminMessage,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
    }).catch((adminAlertError) => {
      console.error('Service Cancellation Request Admin Alert Error:', adminAlertError);
    });

    sendAdminAlertEmails({
      subject: '[Locally Admin] 서비스 취소 요청 접수',
      title: '서비스 취소 요청이 접수되었습니다',
      message: adminMessage,
      link: '/admin/dashboard?tab=SERVICE_REQUESTS',
      ctaLabel: '서비스 요청 보기',
    }).catch((adminEmailError) => {
      console.error('Service Cancellation Request Admin Email Error:', adminEmailError);
    });

    return NextResponse.json({ success: true, message: '취소 요청이 접수되었습니다. 관리자 검토 후 환불이 처리됩니다.' });

  } catch (error: unknown) {
    if (cancellationLockAcquired && !cancellationCommitted && bookingStatusBeforeLock && targetOrderId) {
      try {
        await createAdminClient()
          .from('service_bookings')
          .update({ status: bookingStatusBeforeLock })
          .eq('order_id', targetOrderId)
          .eq('status', 'cancellation_requested');
      } catch (rollbackError) {
        console.error('[SERVICE] cancel rollback failed:', rollbackError);
      }
    }

    captureServerException(error, { route: '/api/services/cancel', method: 'POST' });
    console.error('API Service Cancel Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
