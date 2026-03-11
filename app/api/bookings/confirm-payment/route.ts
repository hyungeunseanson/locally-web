import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

// 🔒 API Route 내부에서 직접 관리자 클라이언트 생성 (의존성 제거)
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('🔥 [Server Error] Missing Env Vars:', { 
      url: !!supabaseUrl, 
      key: !!serviceRoleKey 
    });
    throw new Error('Server Configuration Error: Missing Supabase Keys');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export async function POST(request: Request) {
  console.log('💰 [API] Confirm Payment Started');

  try {
    // 🚨 [보안 패치] 권한 검증 추가 (Phase 5 긴급 수정)
    const supabaseAuth = await createServerClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인 (Role or Whitelist)
    const [userEntry, whitelistEntry] = await Promise.all([
      supabaseAuth.from('users').select('role').eq('id', user.id).maybeSingle(),
      supabaseAuth.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle()
    ]);

    const isAdmin = (userEntry.data?.role === 'admin') || !!whitelistEntry.data;

    if (!isAdmin) {
      console.error(`🚨 [Security Warning] Unauthorized Access Attempt by ${user.email}`);
      return NextResponse.json({ error: 'Forbidden: Admin Access Required' }, { status: 403 });
    }

    const supabase = createAdminClient(); // 🟢 검증 후 관리자 클라이언트 생성
    const { bookingId } = await request.json();

    if (!bookingId) throw new Error('Missing bookingId');

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

    // 4. 업데이트 (확정)
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        price_at_booking: basePrice,
        total_experience_price: totalExpPrice,
        host_payout_amount: payoutAmount,
        platform_revenue: platformRev,
        payout_status: 'pending'
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Update Booking Error:', updateError);
      throw new Error(updateError.message);
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
        notifications.push({
          user_id: experience.host_id,
          type: 'booking_confirmed',
          title: '💰 입금 확인 완료!',
          message: `'${experience.title}' 예약의 입금 확인이 완료되었습니다.`,
          link: '/host/dashboard',
          is_read: false
        });
      }
      if (booking.user_id) {
        notifications.push({
          user_id: booking.user_id,
          type: 'booking_confirmed',
          title: '✅ 예약 확정 알림',
          message: `'${experience.title}' 입금이 확인되어 예약이 확정되었습니다.`,
          link: '/guest/trips',
          is_read: false
        });
      }
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      if (experience.host_id) {
        await sendImmediateGenericEmail({
          recipientUserId: experience.host_id,
          subject: `[Locally] 💰 입금 확인 완료!`,
          title: '입금 확인 완료!',
          message: `'${experience.title}' 예약의 입금 확인이 완료되었습니다.`,
          link: '/host/dashboard',
          ctaLabel: '호스트 대시보드 열기',
        });
      }

      if (booking.user_id) {
        await sendImmediateGenericEmail({
          recipientUserId: booking.user_id,
          subject: `[Locally] ✅ 예약이 확정되었습니다`,
          title: '예약 확정 알림',
          message: `'${experience.title}' 입금이 확인되어 예약이 확정되었습니다.`,
          link: '/guest/trips',
          ctaLabel: '내 여행 보기',
        });
      }

      await insertAdminAlerts({
        title: '체험 예약 무통장 입금이 확인되었습니다',
        message: `'${experience.title}' 예약의 무통장 입금 확인이 완료되었습니다.`,
        link: '/admin/dashboard?tab=LEDGER',
      });
    } catch (notiError) {
      console.error('Notification Failed (Ignored):', notiError);
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('🔥 [API Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
