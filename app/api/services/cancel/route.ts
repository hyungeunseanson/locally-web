import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import crypto from 'crypto';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { refundPayPalCapture } from '@/app/utils/paypal/server';

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

  const MID = process.env.NICEPAY_MID;
  const MER_KEY = process.env.NICEPAY_MERCHANT_KEY;

  if (!MID || !MER_KEY || !booking.tid) {
    return {
      ok: false,
      error: '카드 환불 정보가 없어 취소를 완료하지 못했습니다. 관리자에게 문의해주세요.',
      status: 500,
    };
  }

  try {
    const ediDate = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const signData = crypto
      .createHash('sha256')
      .update(ediDate + MID + String(refundAmount) + MER_KEY)
      .digest('hex');

    const cancelParams = new URLSearchParams({
      MID,
      TID: booking.tid,
      Moid: booking.order_id,
      CancelAmt: String(refundAmount),
      CancelMsg: cancelReason,
      PartialCancelCode: '0',
      EdiDate: ediDate,
      SignData: signData,
    });

    const cancelRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cancelParams.toString(),
    });

    if (!cancelRes.ok) {
      console.error('[SERVICE] NicePay cancel HTTP error:', cancelRes.status);
      return {
        ok: false,
        error: `NicePay API 오류 (HTTP ${cancelRes.status}). DB 상태는 변경되지 않았습니다.`,
        status: 500,
      };
    }

    const resText = await cancelRes.text();
    const resParams = new URLSearchParams(resText);
    const resultCode = resParams.get('ResultCode');
    if (resultCode && resultCode !== '2001' && resultCode !== '2030') {
      const resultMsg = resParams.get('ResultMsg') || '알 수 없는 오류';
      console.error('[SERVICE] NicePay cancel ResultCode:', resultCode, resultMsg);
      return {
        ok: false,
        error: `NicePay 환불 거절: ${resultMsg}`,
        status: 400,
      };
    }

    return { ok: true, refundAmount };
  } catch (error) {
    console.error('[SERVICE] NicePay cancel exception:', error);
    return {
      ok: false,
      error: 'NicePay 환불 네트워크 오류로 취소를 완료하지 못했습니다. DB 상태는 변경되지 않았습니다.',
      status: 500,
    };
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CancelBody;
    const { order_id, cancel_reason = '고객 요청 취소' } = body;

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

      return NextResponse.json({ success: true, message: '의뢰가 취소되었습니다.' });
    }

    // 5. PAID + open (호스트 미선택) → NicePay 전액 환불
    if (booking.status === 'PAID' && requestStatus === 'open') {
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
        return NextResponse.json({ success: false, error: refundResult.error }, { status: refundResult.status });
      }

      await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancelled', cancel_reason, refund_amount: refundResult.refundAmount })
        .eq('order_id', order_id);
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

      return NextResponse.json({ success: true, message: '의뢰가 취소되고 환불이 처리됩니다.' });
    }

    // 6. PAID + matched/confirmed 이후 취소 요청 (관리자 검토)
    await supabaseAdmin
      .from('service_bookings')
      .update({ status: 'cancellation_requested', cancel_reason })
      .eq('order_id', order_id);

    const otherPartyId = isCustomer ? booking.host_id : booking.customer_id;
    if (otherPartyId) {
      supabaseAdmin.from('notifications').insert({
        user_id: otherPartyId,
        type: 'service_cancelled',
        title: '취소 요청이 접수되었습니다.',
        message: `'${requestTitle}' 서비스에 대한 취소 요청이 접수되었습니다. 관리자가 검토 후 처리합니다.`,
        link: `/services/my`,
        is_read: false,
      }).then(({ error }) => {
        if (error) console.error('Cancel Notification Error:', error);
      });
    }

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
    console.error('API Service Cancel Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
