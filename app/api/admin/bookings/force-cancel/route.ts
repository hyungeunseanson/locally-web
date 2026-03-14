import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { calculateBookingCancellationSettlement, getBookingPaidAmount } from '@/app/utils/bookingFinance';
import { isCancelledOnlyBookingStatus, isPendingBookingStatus } from '@/app/constants/bookingStatus';
import { refundPayPalCapture } from '@/app/utils/paypal/server';

type ForceCancelBody = {
  bookingId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  try {
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

    const { bookingId, reason } = (await request.json()) as ForceCancelBody;
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        user_id,
        order_id,
        tid,
        payment_method,
        amount,
        total_price,
        total_experience_price,
        status,
        cancel_reason,
        date,
        time,
        created_at,
        experiences(host_id, title)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (isCancelledOnlyBookingStatus(booking.status)) {
      return NextResponse.json({ success: false, error: '이미 취소된 예약입니다.' }, { status: 409 });
    }

    // 🔒 Phase A: 중복 환불 방지 — 환불 진행 중 마커 감지
    // PG 환불 성공 + DB 업데이트 실패 시 관리자 재시도로 인한 중복 환불 차단
    const REFUND_IN_PROGRESS_MARKER = '[환불처리중]';
    if (booking.cancel_reason?.includes(REFUND_IN_PROGRESS_MARKER)) {
      console.error('[ADMIN] force-cancel: 환불 처리 중인 예약 재시도 감지', { bookingId });
      return NextResponse.json(
        { success: false, error: '환불이 이미 처리 중입니다. 잠시 후 예약 상태를 확인해주세요.' },
        { status: 409 }
      );
    }

    const cancelReason = (reason || '관리자 직권 취소').trim();
    const totalAmount = getBookingPaidAmount(booking);
    const settlement = isPendingBookingStatus(booking.status)
      ? { refundAmount: 0, hostPayout: 0, platformRevenue: 0 }
      : calculateBookingCancellationSettlement(booking, 100);

    if (settlement.refundAmount > 0 && booking.tid) {
      // 🔒 Phase A: PG 환불 직전 DB에 진행 중 마커 기록
      // 이후 PG 성공 + DB update 실패 시, 관리자 재시도를 위에서 차단함
      await supabaseAdmin
        .from('bookings')
        .update({ cancel_reason: `${cancelReason} ${REFUND_IN_PROGRESS_MARKER}` })
        .eq('id', bookingId);

      if (booking.payment_method === 'paypal') {
        const refund = await refundPayPalCapture(booking.tid, settlement.refundAmount, 'KRW');
        if (!refund.status || !['COMPLETED', 'PENDING'].includes(refund.status)) {
          throw new Error(`PayPal refund failed: ${refund.status || 'unknown status'}`);
        }
      } else {
        const mid = process.env.NICEPAY_MID;

        if (!mid) {
          throw new Error('Server Config Error: NICEPAY_MID missing');
        }

        const formBody = new URLSearchParams({
          TID: booking.tid,
          MID: mid,
          Moid: booking.order_id || booking.id,
          CancelAmt: settlement.refundAmount.toString(),
          CancelMsg: cancelReason,
          PartialCancelCode: settlement.refundAmount < totalAmount ? '1' : '0',
        });

        const pgResponse = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody.toString(),
        });

        if (!pgResponse.ok) {
          throw new Error(`PG Network Timeout: ${pgResponse.status} ${pgResponse.statusText}`);
        }

        const pgResult = await pgResponse.text();
        let pgJson;
        try {
          pgJson = JSON.parse(pgResult.replace(/'/g, '"'));
        } catch {
          throw new Error(`PG Format Error: Failed to parse PG response: ${pgResult}`);
        }

        if (pgJson.ResultCode !== '2001' && pgJson.ResultCode !== '2211') {
          throw new Error(`PG Cancel Failed: [${pgJson.ResultCode}] ${pgJson.ResultMsg}`);
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        // 마커 제거 후 최종 취소 사유로 교체
        cancel_reason: `${cancelReason} (관리자 강제 취소)`,
        refund_amount: settlement.refundAmount,
        host_payout_amount: settlement.hostPayout,
        platform_revenue: settlement.platformRevenue,
      })
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const experience = Array.isArray(booking.experiences) ? booking.experiences[0] : booking.experiences;
    const hostId = experience?.host_id;
    const expTitle = experience?.title || 'Locally 체험';
    const guestId = booking.user_id || null;
    const refundText = settlement.refundAmount > 0
      ? `환불 금액: ₩${settlement.refundAmount.toLocaleString()}`
      : '결제 전 예약이 취소되었습니다.';

    try {
      const notifications = [];

      if (hostId) {
        notifications.push({
          user_id: hostId,
          type: 'cancellation',
          title: '😢 예약이 취소되었습니다.',
          message: `[${expTitle}] 예약이 취소되었습니다. ${refundText}`,
          link: '/host/dashboard',
          is_read: false,
        });
      }

      if (guestId) {
        notifications.push({
          user_id: guestId,
          type: 'cancellation',
          title: '예약이 취소되었습니다.',
          message: `[${expTitle}] 예약이 관리자에 의해 취소되었습니다. ${refundText}`,
          link: '/guest/trips',
          is_read: false,
        });
      }

      if (notifications.length > 0) {
        await supabaseAdmin.from('notifications').insert(notifications);
      }

      if (hostId) {
        fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'booking_cancellation',
            hostId,
            experienceTitle: expTitle,
            cancelReason,
            refundAmount: settlement.refundAmount,
          }),
        }).catch((emailError) => {
          console.error('[ADMIN] booking cancel email error:', emailError);
        });
      }

      if (guestId) {
        await sendImmediateGenericEmail({
          recipientUserId: guestId,
          subject: '[Locally] 예약 취소 안내',
          title: '예약이 취소되었습니다',
          message: `'${expTitle}' 예약이 관리자에 의해 취소되었습니다.\n${refundText}`,
          link: '/guest/trips',
          ctaLabel: '내 여행 보기',
        });
      }

      await insertAdminAlerts({
        title: '체험 예약이 취소되었습니다',
        message: `[${expTitle}] 예약이 취소되었습니다. 환불액: ₩${settlement.refundAmount.toLocaleString()}`,
        link: '/admin/dashboard?tab=LEDGER',
      });
    } catch (notificationError) {
      console.error('[ADMIN] booking force-cancel side effect error:', notificationError);
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_FORCE_CANCEL_BOOKING',
      target_type: 'booking',
      target_id: String(bookingId),
      details: {
        experience_title: expTitle,
        refund_amount: settlement.refundAmount,
        booking_status: booking.status,
      },
    });

    return NextResponse.json({ success: true, refundAmount: settlement.refundAmount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cancel Error';
    console.error('[ADMIN] booking force-cancel error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
