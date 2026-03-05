import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import crypto from 'crypto';

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

    // 2. Admin role check using admin client (bypasses RLS on admin_whitelist)
    const [userEntry, whitelist] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
    ]);

    const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
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
      .select('id, order_id, request_id, customer_id, host_id, amount, tid, status')
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
      await supabaseAdmin
        .from('service_bookings')
        .update({ status: 'cancelled', cancel_reason })
        .eq('order_id', order_id);

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

      return NextResponse.json({ success: true, message: '의뢰가 취소되었습니다 (결제 전).' });
    }

    // 5. PAID booking: call NicePay cancel FIRST — only update DB if PG succeeds
    const actualRefundAmount = refund_amount ?? booking.amount;

    if (booking.tid && actualRefundAmount > 0) {
      const MID = process.env.NICEPAY_MID;
      const MER_KEY = process.env.NICEPAY_MERCHANT_KEY;

      if (!MID || !MER_KEY) {
        return NextResponse.json(
          { success: false, error: 'NicePay 환경변수 미설정. 수동 환불이 필요합니다.' },
          { status: 500 }
        );
      }

      try {
        const ediDate = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const signData = crypto
          .createHash('sha256')
          .update(ediDate + MID + String(actualRefundAmount) + MER_KEY)
          .digest('hex');

        const cancelParams = new URLSearchParams({
          MID,
          TID: booking.tid,
          Moid: booking.order_id,
          CancelAmt: String(actualRefundAmount),
          CancelMsg: cancel_reason,
          PartialCancelCode: actualRefundAmount < booking.amount ? '1' : '0',
          EdiDate: ediDate,
          SignData: signData,
        });

        const cancelRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: cancelParams.toString(),
        });

        if (!cancelRes.ok) {
          console.error('[ADMIN] NicePay cancel HTTP error:', cancelRes.status);
          return NextResponse.json(
            { success: false, error: `NicePay API 오류 (HTTP ${cancelRes.status}). DB 상태는 변경되지 않았습니다.` },
            { status: 500 }
          );
        }

        // Check NicePay result code
        const resText = await cancelRes.text();
        const resParams = new URLSearchParams(resText);
        const resultCode = resParams.get('ResultCode');
        // 2001 = 취소 성공, 2030 = 이미 취소됨
        if (resultCode && resultCode !== '2001' && resultCode !== '2030') {
          const resultMsg = resParams.get('ResultMsg') || '알 수 없는 오류';
          console.error('[ADMIN] NicePay cancel ResultCode:', resultCode, resultMsg);
          return NextResponse.json(
            { success: false, error: `NicePay 환불 거절: ${resultMsg}` },
            { status: 400 }
          );
        }
      } catch (pgErr) {
        console.error('[ADMIN] NicePay cancel exception:', pgErr);
        return NextResponse.json(
          { success: false, error: 'NicePay 환불 네트워크 오류. DB 상태는 변경되지 않았습니다.' },
          { status: 500 }
        );
      }
    }

    // 6. PG succeeded (or refund_amount=0): update DB
    await supabaseAdmin
      .from('service_bookings')
      .update({ status: 'cancelled', cancel_reason, refund_amount: actualRefundAmount })
      .eq('order_id', order_id);

    await supabaseAdmin
      .from('service_requests')
      .update({ status: 'cancelled' })
      .eq('id', booking.request_id);

    // 7. Notify customer + host (non-blocking)
    const notifs: any[] = [];
    if (booking.customer_id) {
      notifs.push({
        user_id: booking.customer_id,
        type: 'service_cancelled',
        title: '의뢰가 취소되었습니다.',
        message: `'${requestTitle}' 의뢰가 관리자에 의해 취소되었습니다. 환불 처리가 진행됩니다.`,
        link: '/services/my',
        is_read: false,
      });
    }
    if (booking.host_id) {
      notifs.push({
        user_id: booking.host_id,
        type: 'service_cancelled',
        title: '의뢰가 취소되었습니다.',
        message: `'${requestTitle}' 의뢰가 관리자에 의해 취소되었습니다.`,
        link: '/host/services',
        is_read: false,
      });
    }
    if (notifs.length > 0) {
      supabaseAdmin.from('notifications').insert(notifs).then(({ error }) => {
        if (error) console.error('[ADMIN] cancel notification error:', error);
      });
    }

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
