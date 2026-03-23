import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { calculateBookingCancellationSettlement, getBookingPaidAmount } from '@/app/utils/bookingFinance';
import { isCancelledBookingStatus, isPendingBookingStatus } from '@/app/constants/bookingStatus';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { refundPayPalCapture } from '@/app/utils/paypal/server';
import { isHostUnavailableReviewPending } from '@/app/utils/hostUnavailableReview';

type ForceCancelBody = {
  bookingId?: string;
  reason?: string;
  source?: 'admin_force' | 'host_fault_request';
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

    const { bookingId, reason, source } = (await request.json()) as ForceCancelBody;
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

    if (isCancelledBookingStatus(booking.status)) {
      return NextResponse.json({ success: false, error: '이미 취소 또는 거절된 예약입니다.' }, { status: 409 });
    }

    const isHostFaultRequest = source === 'host_fault_request';

    if (isHostFaultRequest && !isHostUnavailableReviewPending(booking.cancel_reason)) {
      return NextResponse.json({ success: false, error: '호스트 진행 불가 검토 요청이 아닙니다.' }, { status: 409 });
    }

    const cancelReason = (reason || (isHostFaultRequest ? '호스트 진행 불가 확인 취소' : '관리자 직권 취소')).trim();
    const totalAmount = getBookingPaidAmount(booking);
    const settlement = isPendingBookingStatus(booking.status)
      ? { refundAmount: 0, hostPayout: 0, platformRevenue: 0 }
      : calculateBookingCancellationSettlement(booking, 100);

    if (settlement.refundAmount > 0 && booking.tid) {
      // 🔒 Sentinel lock: status → cancellation_requested (atomic CAS, mirrors service-cancel)
      const { data: lockRow } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'cancellation_requested' })
        .eq('id', bookingId)
        .neq('status', 'cancelled')
        .neq('status', 'cancellation_requested')
        .select('id')
        .maybeSingle();

      if (!lockRow) {
        return NextResponse.json(
          { success: false, error: '환불이 이미 처리 중입니다. 잠시 후 예약 상태를 확인해주세요.' },
          { status: 409 }
        );
      }

      if (booking.payment_method === 'paypal') {
        const refund = await refundPayPalCapture(booking.tid, settlement.refundAmount, 'KRW');
        if (!refund.status || !['COMPLETED', 'PENDING'].includes(refund.status)) {
          throw new Error(`PayPal refund failed: ${refund.status || 'unknown status'}`);
        }
      } else {
        await cancelCardPayment({
          providerTransactionId: booking.tid,
          orderId: booking.order_id || booking.id,
          cancelAmount: settlement.refundAmount,
          cancelReason,
          totalAmount,
          requireMerchantKey: true,
          acceptedResultCodes: ['2001', '2211'],
        });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        // 마커 제거 후 최종 취소 사유로 교체
        cancel_reason: isHostFaultRequest
          ? `${cancelReason} (호스트 진행 불가 확인 취소)`
          : `${cancelReason} (관리자 강제 취소)`,
        refund_amount: settlement.refundAmount,
        host_payout_amount: settlement.hostPayout,
        platform_revenue: settlement.platformRevenue,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('[ADMIN] CRITICAL: PG refund succeeded but DB update failed. Manual resolution required.', {
        bookingId,
        updateError: updateError.message,
      });
      await insertAdminAlerts({
        title: '[긴급] 환불 완료 후 DB 업데이트 실패',
        message: `예약 ID ${bookingId}: PG 환불 성공했으나 DB 상태 미갱신. 수동 확인 필요.`,
        link: '/admin/dashboard?tab=LEDGER',
      });
      return NextResponse.json(
        { success: false, error: 'PG 환불은 완료됐으나 DB 업데이트 실패. 관리자 수동 확인 필요.' },
        { status: 500 }
      );
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
          message: isHostFaultRequest
            ? `[${expTitle}] 예약이 호스트 진행 불가 사유로 취소 처리되었습니다. ${refundText}`
            : `[${expTitle}] 예약이 취소되었습니다. ${refundText}`,
          link: '/host/dashboard',
          is_read: false,
        });
      }

      if (guestId) {
        notifications.push({
          user_id: guestId,
          type: 'cancellation',
          title: isHostFaultRequest ? '호스트 진행 불가로 예약이 취소되었습니다.' : '예약이 취소되었습니다.',
          message: isHostFaultRequest
            ? `[${expTitle}] 예약이 호스트 진행 불가 사유로 취소되었습니다. ${refundText}`
            : `[${expTitle}] 예약이 관리자에 의해 취소되었습니다. ${refundText}`,
          link: '/guest/trips',
          is_read: false,
        });
      }

      if (notifications.length > 0) {
        await supabaseAdmin.from('notifications').insert(notifications);
      }

      if (hostId) {
        const internalApiSecret = process.env.INTERNAL_API_SECRET;

        if (!internalApiSecret) {
          console.error('[ADMIN] INTERNAL_API_SECRET is missing. Skipping booking cancellation email dispatch.');
        } else {
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': internalApiSecret,
            },
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
      }

      if (guestId) {
        await sendImmediateGenericEmail({
          recipientUserId: guestId,
          subject: isHostFaultRequest ? '[Locally] 호스트 진행 불가 취소 안내' : '[Locally] 예약 취소 안내',
          title: isHostFaultRequest ? '호스트 진행 불가로 예약이 취소되었습니다' : '예약이 취소되었습니다',
          message: isHostFaultRequest
            ? `'${expTitle}' 예약이 호스트 진행 불가 사유로 취소되었습니다.\n${refundText}`
            : `'${expTitle}' 예약이 관리자에 의해 취소되었습니다.\n${refundText}`,
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
      action_type: isHostFaultRequest ? 'ADMIN_APPROVE_HOST_UNAVAILABLE_CANCEL' : 'ADMIN_FORCE_CANCEL_BOOKING',
      target_type: 'booking',
      target_id: String(bookingId),
      details: {
        experience_title: expTitle,
        refund_amount: settlement.refundAmount,
        booking_status: booking.status,
        source: source || 'admin_force',
      },
    });

    return NextResponse.json({ success: true, refundAmount: settlement.refundAmount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cancel Error';
    console.error('[ADMIN] booking force-cancel error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
