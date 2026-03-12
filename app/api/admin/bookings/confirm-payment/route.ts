import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { isPendingBookingStatus } from '@/app/constants/bookingStatus';
import { getBookingSettlementSnapshot } from '@/app/utils/bookingFinance';

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
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
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

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'confirmed',
        price_at_booking: snapshot.basePrice,
        total_experience_price: snapshot.totalExperiencePrice,
        host_payout_amount: snapshot.hostPayout,
        platform_revenue: snapshot.platformRevenue,
        payout_status: 'pending',
      })
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const experience = Array.isArray(booking.experiences) ? booking.experiences[0] : booking.experiences;
    const hostId = experience?.host_id;
    const experienceTitle = experience?.title || 'Locally 체험';

    try {
      const notifications = [];
      if (hostId) {
        notifications.push({
          user_id: hostId,
          type: 'booking_confirmed',
          title: '💰 입금 확인 완료!',
          message: `'${experienceTitle}' 예약의 입금 확인이 완료되었습니다.`,
          link: '/host/dashboard',
          is_read: false,
        });
      }
      if (booking.user_id) {
        notifications.push({
          user_id: booking.user_id,
          type: 'booking_confirmed',
          title: '✅ 예약 확정 알림',
          message: `'${experienceTitle}' 입금이 확인되어 예약이 확정되었습니다.`,
          link: '/guest/trips',
          is_read: false,
        });
      }
      if (notifications.length > 0) {
        await supabaseAdmin.from('notifications').insert(notifications);
      }

      if (hostId) {
        await sendImmediateGenericEmail({
          recipientUserId: hostId,
          subject: '[Locally] 💰 입금 확인 완료!',
          title: '입금 확인 완료!',
          message: `'${experienceTitle}' 예약의 입금 확인이 완료되었습니다.`,
          link: '/host/dashboard',
          ctaLabel: '호스트 대시보드 열기',
        });
      }

      if (booking.user_id) {
        await sendImmediateGenericEmail({
          recipientUserId: booking.user_id,
          subject: '[Locally] ✅ 예약이 확정되었습니다',
          title: '예약 확정 알림',
          message: `'${experienceTitle}' 입금이 확인되어 예약이 확정되었습니다.`,
          link: '/guest/trips',
          ctaLabel: '내 여행 보기',
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

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[ADMIN] booking confirm-payment error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
