import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { isPendingBookingStatus } from '@/app/constants/bookingStatus';
import { getBookingSettlementSnapshot } from '@/app/utils/bookingFinance';
import { notifyMembershipMilestone } from '@/app/utils/memberMilestoneNotifications';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { buildLocalizedEmailCopy } from '@/app/utils/emailCopy';

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

    const { bookingId } = await request.json();
    // [Security] bookingId 타입 검증 — object injection으로 쿼리 조건 우회 방어
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        experience_id,
        user_id,
        amount,
        total_price,
        total_experience_price,
        price_at_booking,
        solo_guarantee_price,
        status,
        payment_method,
        contact_name,
        guests,
        date,
        time,
        experiences(title, host_id)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!isPendingBookingStatus(booking.status)) {
      return NextResponse.json({ success: false, error: '현재 상태에서는 입금 확인할 수 없습니다.' }, { status: 409 });
    }

    if (booking.payment_method !== 'bank') {
      return NextResponse.json({ success: false, error: '무통장 예약만 입금 확인할 수 있습니다.' }, { status: 409 });
    }

    const snapshot = getBookingSettlementSnapshot(booking);

    // [Race Guard] status 조건부 UPDATE — 동시 요청 중복 확정 방지
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'confirmed',
        price_at_booking: snapshot.basePrice,
        total_experience_price: snapshot.totalExperiencePrice,
        host_payout_amount: snapshot.hostPayout,
        platform_revenue: snapshot.platformRevenue,
        payout_status: 'pending',
      })
      .eq('id', bookingId)
      .eq('status', booking.status) // 현재 status와 동일할 때만 업데이트
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }
    if (!updatedRows) {
      // 다른 요청이 이미 처리 완료 — 멱등성 응답
      return NextResponse.json({ success: true });
    }

    const experience = Array.isArray(booking.experiences) ? booking.experiences[0] : booking.experiences;
    // [Safety] experience null 시 알림 전송 자체를 중단 — 삭제된 체험에 대한 확정 알림 방지
    if (!experience) {
      console.error('[ADMIN confirm-payment] experience not found for booking:', bookingId);
      revalidatePath(`/experiences/${booking.experience_id}`);
      return NextResponse.json({ success: true });
    }
    const hostId = experience?.host_id;
    const experienceTitle = experience?.title || 'Locally 체험';

    // Resolve guest display name from profile
    let guestDisplayName = booking.contact_name || '게스트';
    if (booking.user_id) {
      const { data: guestProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', booking.user_id)
        .maybeSingle();
      if (guestProfile?.full_name) guestDisplayName = guestProfile.full_name;
    }

    try {
      const notifications = [];
      if (hostId) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: hostId,
            type: 'booking_confirmed',
            link: '/host/dashboard',
            key: 'booking.bank_confirmed.host',
            copyParams: {
              experienceTitle,
              guestName: guestDisplayName,
            },
          })
        );
      }
      if (booking.user_id) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin,
            userId: booking.user_id,
            type: 'booking_confirmed',
            link: '/guest/trips',
            key: 'booking.bank_confirmed.guest',
            copyParams: {
              experienceTitle,
            },
          })
        );
      }
      if (notifications.length > 0) {
        await supabaseAdmin.from('notifications').insert(notifications);
      }

      if (hostId) {
        const hostEmailCopy = await buildLocalizedEmailCopy({
          supabaseAdmin,
          userId: hostId,
          key: 'booking.bank_confirmed.host',
          copyParams: {
            experienceTitle,
          },
        });

        await sendImmediateGenericEmail({
          recipientUserId: hostId,
          subject: hostEmailCopy.subject,
          title: hostEmailCopy.title,
          message: hostEmailCopy.message,
          link: '/host/dashboard',
          ctaLabel: hostEmailCopy.ctaLabel,
        });
      }

      if (booking.user_id) {
        const guestEmailCopy = await buildLocalizedEmailCopy({
          supabaseAdmin,
          userId: booking.user_id,
          key: 'booking.bank_confirmed.guest',
          copyParams: {
            experienceTitle,
          },
        });

        await sendImmediateGenericEmail({
          recipientUserId: booking.user_id,
          subject: guestEmailCopy.subject,
          title: guestEmailCopy.title,
          message: guestEmailCopy.message,
          link: '/guest/trips',
          ctaLabel: guestEmailCopy.ctaLabel,
        });

        await notifyMembershipMilestone({
          supabaseAdmin,
          userId: booking.user_id,
        });
      }

      await insertAdminAlerts({
        title: '체험 예약 무통장 입금이 확인되었습니다',
        message: `'${experienceTitle}' 예약의 무통장 입금 확인이 완료되었습니다.`,
        link: '/admin/dashboard?tab=LEDGER',
      });
    } catch (notificationError) {
      console.error('[ADMIN] booking confirm-payment side effect error:', notificationError);
    }

    // [Fix] recordAuditLog 실패 시 이미 확정된 예약이 500으로 응답되는 것 방지
    try {
      await recordAuditLog({
        admin_id: user.id,
        admin_email: user.email,
        action_type: 'ADMIN_CONFIRM_BOOKING_PAYMENT',
        target_type: 'booking',
        target_id: String(bookingId),
        details: {
          experience_title: experienceTitle,
          amount: booking.amount,
          guest_name: booking.contact_name,
        },
      });
    } catch (auditErr) {
      console.error('[ADMIN confirm-payment] audit log failed (ignored):', auditErr);
    }

    revalidatePath(`/experiences/${booking.experience_id}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[ADMIN] booking confirm-payment error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
