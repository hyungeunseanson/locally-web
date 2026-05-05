import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient } from '@/app/utils/supabase/server';
import { NextResponse } from 'next/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  isCancelledBookingStatus,
  isCancellationRequestedBookingStatus,
} from '@/app/constants/bookingStatus';
import { calculateBookingCancellationSettlement, getBookingPaidAmount } from '@/app/utils/bookingFinance';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { refundPayPalCapture } from '@/app/utils/paypal/server';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { calculateGuestCancellationRefundRate } from '@/app/utils/bookingCancellationPolicy';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { isSoloGuaranteeRefundUnresolvedStatus } from '@/app/utils/soloGuaranteeRefundStatus';
import {
  formatBookingReviewMarker,
  isBookingReviewPending,
  type BookingReviewRequestType,
} from '@/app/utils/hostUnavailableReview';

const GUEST_CANCELLATION_REASON_LABELS = {
  personal_change: '개인 사정',
  schedule_issue: '일정 변경',
  host_unavailable: '호스트 진행 불가',
  minimum_participants_unmet: '최소 진행 인원 미달',
  other: '기타',
} as const;

const REVIEW_PENDING_REASON_CODES: Record<string, BookingReviewRequestType> = {
  host_unavailable: 'host_unavailable',
  minimum_participants_unmet: 'minimum_participants_unmet',
};

export async function POST(request: Request) {
  let bookingId: string | number | null = null;
  let bookingStatusBeforeLock: string | null = null;
  let cancellationLockAcquired = false;
  let cancellationCommitted = false;

  try {
    const body = await request.json();
    bookingId = typeof body?.bookingId === 'string' || typeof body?.bookingId === 'number'
      ? body.bookingId
      : null;
    const { reason: rawUserReason, isHostCancel } = body;
    const reasonCode = typeof body?.reasonCode === 'string'
      ? body.reasonCode
      : null;
    const userReason = typeof rawUserReason === 'string'
      ? rawUserReason.trim()
      : '';

    // [C-3] Auth Check
    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. 예약 조회
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*, experiences(host_id, title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !booking) return NextResponse.json({ error: '예약 없음' }, { status: 404 });

    bookingStatusBeforeLock = typeof booking.status === 'string' ? booking.status : null;

    // [보안 패치] 관리자인지 확인 (관리자는 모든 예약 취소 가능)
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    const isGuestOwner = booking.user_id === user.id;
    const isHostOwner = booking.experiences?.host_id === user.id;
    const isCancellationRequested = isCancellationRequestedBookingStatus(booking.status);

    // [C-3] Ownership Verification
    if (!isAdmin && !isGuestOwner && !isHostOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 호스트 직접 취소는 더 이상 허용하지 않는다.
    // 운영팀이 검토 후 관리자 취소 경로를 사용해야 하므로 guest reason review flow로 유도한다.
    if (isHostCancel && !isAdmin) {
      return NextResponse.json({ error: '호스트 직접 취소는 지원하지 않습니다. 운영팀 검토 요청 경로를 이용해주세요.' }, { status: 403 });
    }

    if (!isAdmin && isHostOwner && !isCancellationRequested) {
      return NextResponse.json(
        { error: '호스트는 게스트 취소 요청 건만 승인할 수 있습니다.' },
        { status: 403 }
      );
    }

    if (!isAdmin && isGuestOwner && isCancellationRequested) {
      return NextResponse.json({ error: '이미 취소 승인 대기 중입니다.' }, { status: 409 });
    }

    // [CRITICAL Fix] 취소 완료 상태는 caller와 무관하게 차단하되,
    // 기존 host approval consumer가 사용하는 `cancellation_requested`는 별도 approval path로 유지한다.
    if (!isCancellationRequested && isCancelledBookingStatus(booking.status)) {
      return NextResponse.json({ error: '이미 취소됨' }, { status: 400 });
    }

    if (isSoloGuaranteeRefundUnresolvedStatus(booking.solo_guarantee_refund_status)) {
      return NextResponse.json(
        { error: '1인 진행 추가금 환불 확인이 끝난 뒤 취소할 수 있습니다.' },
        { status: 409 }
      );
    }

    if (isGuestOwner && isBookingReviewPending(booking.cancel_reason)) {
      return NextResponse.json({ error: '이미 운영팀 검토가 진행 중입니다.' }, { status: 409 });
    }

    const reviewType = reasonCode && reasonCode in REVIEW_PENDING_REASON_CODES
      ? REVIEW_PENDING_REASON_CODES[reasonCode]
      : null;

    if (isGuestOwner && reviewType) {
      const [year, month, day] = String(booking.date || '').split('-').map(Number);
      const bookingDate = new Date(year, (month || 1) - 1, day || 1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (bookingDate <= today) {
        return NextResponse.json({ error: '미래 예약에 대해서만 운영 검토를 요청할 수 있습니다.' }, { status: 409 });
      }

      const reviewMarker = formatBookingReviewMarker(reviewType, userReason);
      const { data: reviewUpdatedRow, error: reviewUpdateError } = await supabaseAdmin
        .from('bookings')
        .update({ cancel_reason: reviewMarker })
        .eq('id', bookingId)
        .is('cancel_reason', null)
        .select('id')
        .maybeSingle();

      if (reviewUpdateError) {
        throw new Error(`host unavailable review update failed: ${reviewUpdateError.message}`);
      }
      if (!reviewUpdatedRow) {
        return NextResponse.json({ error: '이미 운영팀 검토가 진행 중입니다.' }, { status: 409 });
      }

      const expTitle = booking.experiences?.title || 'Locally 체험';
      const hostId = booking.experiences?.host_id || null;

      try {
        const notifications = [];

        if (booking.user_id) {
          notifications.push(
            await buildLocalizedNotificationInsert({
              supabaseAdmin,
              userId: booking.user_id,
              type: 'cancellation',
              link: '/guest/trips',
              key: 'booking.review_pending',
              copyParams: {
                experienceTitle: expTitle,
                reviewType,
                recipient: 'guest',
              },
            })
          );
        }

        if (hostId) {
          notifications.push(
            await buildLocalizedNotificationInsert({
              supabaseAdmin,
              userId: hostId,
              type: 'cancellation',
              link: '/host/dashboard',
              key: 'booking.review_pending',
              copyParams: {
                experienceTitle: expTitle,
                reviewType,
                recipient: 'host',
              },
            })
          );
        }

        if (notifications.length > 0) {
          const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notifications);
          if (notificationError) {
            console.error('Host unavailable review notification insert error:', notificationError);
          }
        }
      } catch (notificationError) {
        console.error('Host unavailable review notification side effect error:', notificationError);
      }

      await insertAdminAlerts({
        title: reviewType === 'minimum_participants_unmet'
          ? '최소 진행 인원 미달 취소 검토 요청'
          : '호스트 진행 불가 취소 검토 요청',
        message: reviewType === 'minimum_participants_unmet'
          ? `[${String(booking.order_id || booking.id).slice(0, 8)}] ${expTitle} 예약에 고객이 최소 진행 인원 미달 사유로 취소 검토를 요청했습니다.`
          : `[${String(booking.order_id || booking.id).slice(0, 8)}] ${expTitle} 예약에 고객이 호스트 진행 불가 사유로 취소 검토를 요청했습니다.`,
        link: '/admin/dashboard?tab=LEDGER',
      });

      return NextResponse.json({
        success: true,
        reviewPending: true,
        message: reviewType === 'minimum_participants_unmet'
          ? '최소 진행 인원 미달 취소 요청이 접수되었습니다.'
          : '운영팀 검토 요청이 접수되었습니다.',
      });
    }

    // [Race Guard] Atomic lock: PG 환불 전에 DB 상태를 먼저 점유 — 동시 요청 이중 환불 방지
    if (!isCancellationRequested) {
      const { data: lockAcquired } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'cancellation_requested' })
        .eq('id', bookingId)
        .eq('status', booking.status)
        .select('id')
        .maybeSingle();

      if (!lockAcquired) {
        return NextResponse.json({ error: '이미 취소 처리 중이거나 취소된 예약입니다.' }, { status: 409 });
      }

      cancellationLockAcquired = true;
    }

    // 2. 환불액 및 정산액 계산
    let refundRate = 0;
    let reasonText = '';
    const fallbackGuestReason = reasonCode && reasonCode in GUEST_CANCELLATION_REASON_LABELS
      ? GUEST_CANCELLATION_REASON_LABELS[reasonCode as keyof typeof GUEST_CANCELLATION_REASON_LABELS]
      : '사용자 요청';
    const normalizedUserReason = userReason || fallbackGuestReason;

    if (isHostCancel) {
      refundRate = 100;
      reasonText = '호스트 사유 취소';
    } else {
      const calc = calculateGuestCancellationRefundRate({
        tourDate: booking.date,
        tourTime: booking.time || '00:00',
        paymentDate: booking.created_at,
      });
      refundRate = calc.rate;
      reasonText = calc.reason;
    }

    const totalAmount = getBookingPaidAmount(booking);
    const {
      refundAmount,
      cumulativeRefundAmount,
      hostPayout,
      platformRevenue,
    } = calculateBookingCancellationSettlement(booking, refundRate);

    // 3. PG사 취소 요청
    if (refundAmount > 0 && booking.tid) {
      if (booking.payment_method === 'paypal') {
        const refund = await refundPayPalCapture(booking.tid, refundAmount, 'KRW');
        if (!refund.status || !['COMPLETED', 'PENDING'].includes(refund.status)) {
          throw new Error(`PayPal refund failed: ${refund.status || 'unknown status'}`);
        }
      } else {
        await cancelCardPayment({
          providerTransactionId: booking.tid,
          orderId: booking.order_id,
          cancelAmount: refundAmount,
          cancelReason: normalizedUserReason || reasonText,
          totalAmount,
          acceptedResultCodes: ['2001', '2211'],
        });
      }
    }

    // 4. DB 업데이트 (lock 상태에서만 진행 보장)
    const { error: updateError } = await supabaseAdmin.from('bookings').update({
      status: 'cancelled',
      cancel_reason: `${normalizedUserReason} (${reasonText})`,
      refund_amount: cumulativeRefundAmount,
      host_payout_amount: hostPayout,
      platform_revenue: platformRevenue
    }).eq('id', bookingId).eq('status', 'cancellation_requested');

    if (updateError) throw new Error('DB update failed after refund: ' + updateError.message);

    cancellationCommitted = true;

    // 🟢 5. 알림 및 이메일 발송 로직
    const hostId = booking.experiences?.host_id;
    const expTitle = booking.experiences?.title;

    try {
      const notifications = [];
      if (hostId) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: hostId,
            type: 'cancellation',
            link: '/host/dashboard',
            key: 'booking.cancelled',
            copyParams: {
              experienceTitle: expTitle,
              refundAmount,
              recipient: 'host',
            },
          })
        );
      }
      if (booking.user_id) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: booking.user_id,
            type: 'cancellation',
            link: '/guest/trips',
            key: 'booking.cancelled',
            copyParams: {
              experienceTitle: expTitle,
              refundAmount,
              recipient: 'guest',
            },
          })
        );
      }
      if (notifications.length > 0) {
        const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notifications);
        if (notificationError) {
          console.error('Booking cancellation notification insert error:', notificationError);
        }
      }
    } catch (notificationError) {
      console.error('Booking cancellation notification side effect error:', notificationError);
    }

    if (hostId) {
      let hostEmail = '';
      const { data: hostProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', hostId).maybeSingle();

      if (hostProfile?.email) {
        hostEmail = hostProfile.email;
      } else {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(hostId);
        if (authData?.user?.email) hostEmail = authData.user.email;
      }

      // [Security Fix] 기존 HTTP fetch + x-internal-secret(SERVICE_ROLE_KEY 헤더 전송) 제거
      // — NEXT_PUBLIC_SITE_URL은 클라이언트 노출 변수로 SSRF 위험, 대신 직접 함수 호출
      if (hostEmail) {
        void sendImmediateGenericEmail({
          recipientUserId: hostId,
          recipientEmail: hostEmail,
          subject: '',
          title: '',
          message: '',
          templatedEmail: {
            templateId: 'booking.cancelled',
            audience: 'host',
            payload: {
              experienceTitle: expTitle,
              reason: normalizedUserReason || undefined,
              refundAmount,
              ctaUrl: '/host/dashboard',
              variant: 'standard',
            },
          },
        }).catch(e => console.error('Host booking cancellation email failed:', e));
      }
    }

    if (booking.user_id) {
      void sendImmediateGenericEmail({
        recipientUserId: booking.user_id as string,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'booking.cancelled',
          audience: 'guest',
          payload: {
            experienceTitle: expTitle,
            refundAmount,
            ctaUrl: '/guest/trips',
            variant: 'standard',
          },
        },
      }).catch((emailError) => {
        console.error('Guest booking cancellation email failed:', emailError);
      });
    }

    await insertAdminAlerts({
      title: '체험 예약이 취소되었습니다',
      message: `[${expTitle}] 예약이 취소되었습니다. 환불액: ₩${refundAmount.toLocaleString()}`,
      link: '/admin/dashboard?tab=LEDGER',
    });

    return NextResponse.json({ success: true, refundAmount, hostPayout });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cancel Error';
    captureServerException(error, { route: '/api/payment/cancel', method: 'POST' });
    console.error('Cancel Error:', error);

    if (cancellationLockAcquired && !cancellationCommitted && bookingStatusBeforeLock && (typeof bookingId === 'string' || typeof bookingId === 'number')) {
      try {
        await createAdminClient()
          .from('bookings')
          .update({ status: bookingStatusBeforeLock })
          .eq('id', bookingId)
          .eq('status', 'cancellation_requested');
      } catch (rollbackErr) {
        console.error('Cancel rollback failed (manual reconciliation required):', rollbackErr);
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
