import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { isPendingBookingStatus } from '@/app/constants/bookingStatus';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';

// LEGACY ROUTE
// Current admin-confirm path is `/api/admin/bookings/confirm-payment`.
// Keep this file only for compatibility until legacy callers are fully retired.


export async function POST(request: Request) {
  console.log('💰 [API] Confirm Payment Started');

  try {
    // 🚨 [보안 패치] 권한 검증 추가 (Phase 5 긴급 수정)
    const supabaseAuth = await createServerClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient(); // 🟢 검증 후 관리자 클라이언트 생성

    // 관리자 권한 확인 (Role or Whitelist)
    const { isAdmin } = await resolveAdminAccess(supabase, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      console.error(`🚨 [Security Warning] Unauthorized Access Attempt by ${user.email}`);
      return NextResponse.json({ error: 'Forbidden: Admin Access Required' }, { status: 403 });
    }
    const { bookingId } = await request.json();

    // [Security] bookingId 타입 검증 — object injection으로 쿼리 조건 우회 방어
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 });
    }

    // 1. 예약 정보 조회
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchError || !booking) {
      console.error('Fetch Booking Error:', fetchError);
      throw new Error('예약 정보를 찾을 수 없습니다.');
    }

    // [Payment method guard] 무통장 예약만 입금 확인 가능 — 카드 예약을 관리자가 이중 확정하는 것 차단
    if (booking.payment_method !== 'bank') {
      return NextResponse.json({ error: '무통장 예약만 입금 확인할 수 있습니다.' }, { status: 409 });
    }

    // 중복 처리 방지 (LEGACY): 이미 확정된 예약이면 409 반환 (caller가 silent 200과 구분 가능하도록)
    if (!isPendingBookingStatus(booking.status)) {
      return NextResponse.json({ success: false, error: '현재 상태에서는 입금 확인할 수 없습니다.' }, { status: 409 });
    }

    // 2. 체험 정보 조회
    const { data: experience, error: expError } = await supabase
      .from('experiences')
      .select('title, host_id, max_guests, price, private_price')
      .eq('id', booking.experience_id)
      .maybeSingle();
    
    if (expError || !experience) {
      console.error('Fetch Experience Error:', expError);
      throw new Error('체험 정보를 찾을 수 없습니다.');
    }

    // 3. 정산 데이터 계산
    const guestCount = Number(booking.guests || 1);
    const basePrice = booking.type === 'private'
      ? Number(experience.private_price || 0)
      : Number(experience.price || 0) * guestCount;
    const totalExpPrice = Number(booking.total_price || 0);
    const payoutAmount = Math.floor(totalExpPrice * 0.8);
    const platformRev = Number(booking.amount || 0) - payoutAmount;

    // 4. 업데이트 (확정) — [Race Guard] status 조건부 UPDATE로 동시 요청 중복 확정 방지
    const { data: updatedRows, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        price_at_booking: basePrice,
        total_experience_price: totalExpPrice,
        host_payout_amount: payoutAmount,
        platform_revenue: platformRev,
        payout_status: 'pending'
      })
      .eq('id', bookingId)
      .eq('status', booking.status) // 현재 status와 동일할 때만 업데이트
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('Update Booking Error:', updateError);
      throw new Error(updateError.message);
    }
    if (!updatedRows) {
      // 다른 요청이 이미 처리 완료 — 멱등성 응답
      return NextResponse.json({ success: true });
    }

    // 5. 활동 로그 기록 (안전하게 내부 처리)
    try {
      await supabase.from('admin_audit_logs').insert({
        action_type: 'CONFIRM_PAYMENT',
        target_type: 'bookings',
        target_id: bookingId,
        details: {
          target_info: `${experience.title} (게스트: ${booking.contact_name})`,
          amount: booking.amount
        }
      });
    } catch (logError) {
      console.error('Log Insert Failed (Ignored):', logError);
    }

    // 6. 알림 발송 (호스트/게스트)
    try {
      const notifications = [];
      if (experience.host_id) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin: supabase,
            userId: experience.host_id,
            type: 'booking_confirmed',
            link: '/host/dashboard',
            key: 'booking.bank_confirmed.host',
            copyParams: {
              experienceTitle: experience.title,
              guestName: booking.contact_name || '게스트',
            },
          })
        );
      }
      if (booking.user_id) {
        notifications.push(
          await buildLocalizedNotificationInsert({
            supabaseAdmin: supabase,
            userId: booking.user_id,
            type: 'booking_confirmed',
            link: '/guest/trips',
            key: 'booking.bank_confirmed.guest',
            copyParams: {
              experienceTitle: experience.title,
            },
          })
        );
      }
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      // [Fix] 이메일 호출을 각각 독립 try/catch로 분리
      // — 호스트 이메일 실패 시 게스트 이메일이 묻혀버리는 버그 방지
      if (experience.host_id) {
        try {
          await sendImmediateGenericEmail({
            recipientUserId: experience.host_id,
            subject: `[Locally] 💰 입금 확인 완료!`,
            title: '입금 확인 완료!',
            message: `'${experience.title}' 예약의 입금 확인이 완료되었습니다.`,
            link: '/host/dashboard',
            ctaLabel: '호스트 대시보드 열기',
          });
        } catch (hostEmailErr) {
          console.error('Host email failed (ignored):', hostEmailErr);
        }
      }

      if (booking.user_id) {
        try {
          await sendImmediateGenericEmail({
            recipientUserId: booking.user_id,
            subject: `[Locally] ✅ 예약이 확정되었습니다`,
            title: '예약 확정 알림',
            message: `'${experience.title}' 입금이 확인되어 예약이 확정되었습니다.`,
            link: '/guest/trips',
            ctaLabel: '내 여행 보기',
          });
        } catch (guestEmailErr) {
          console.error('Guest email failed (ignored):', guestEmailErr);
        }
      }

      try {
        await insertAdminAlerts({
          title: '체험 예약 무통장 입금이 확인되었습니다',
          message: `'${experience.title}' 예약의 무통장 입금 확인이 완료되었습니다.`,
          link: '/admin/dashboard?tab=LEDGER',
        });
      } catch (alertErr) {
        console.error('Admin alert failed (ignored):', alertErr);
      }
    } catch (notiError) {
      console.error('Notification Failed (Ignored):', notiError);
    }

    revalidatePath(`/experiences/${booking.experience_id}`);

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('🔥 [API Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
