import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordAuditLog } from '@/app/utils/supabase/admin'; // 🟢 Import

export async function POST(request: Request) {
  try {
    // ... (중략)

    // 3. 상태를 'confirmed'로 변경 및 정산 데이터 확정 기록
    // ... (업데이트 로직 동일)

    if (updateError) throw updateError;

    // 🟢 [추가] 활동 로그 기록 (입금 확인)
    // 관리자 정보를 알기 위해 헤더에서 토큰을 확인하거나, 
    // 여기서는 시스템이 처리한 것으로 간주할 수도 있지만, 보안상 관리자 토큰 검증이 좋음.
    // 하지만 현재 클라이언트에서 토큰을 안 보내고 있을 수 있으므로, 일단 'System' 또는 'Admin'으로 기록.
    // (완벽하게 하려면 클라이언트에서 Authorization 헤더를 보내줘야 함)
    
    // 임시로 '관리자(Admin)'로 기록
    await recordAuditLog({
      action_type: 'CONFIRM_PAYMENT',
      target_type: 'bookings',
      target_id: bookingId,
      details: {
        target_info: `${experience.title} (게스트: ${booking.contact_name})`,
        amount: booking.amount
      }
    });

    // 4. 호스트에게 알림 발송
    // ... (동일)
    
    const { bookingId } = await request.json();
    
    // 1. 예약 정보 조회 (조인 제거)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) throw new Error('예약 정보를 찾을 수 없습니다.');

    // 2. 체험 정보 별도 조회 (안전한 방식)
    const { data: experience, error: expError } = await supabase
      .from('experiences')
      .select('title, host_id, max_guests, price')
      .eq('id', booking.experience_id)
      .single();
    
    if (expError) {
      console.error('Experience fetch error:', expError);
      throw new Error(`체험 정보를 불러오는데 실패했습니다: ${expError.message}`);
    }
    if (!experience) throw new Error('연결된 체험 정보가 없습니다.');

    console.log(`[ConfirmPayment] Booking: ${bookingId}, Exp: ${experience.title}, Price: ${experience.price}`);

    // ... (중간 로직 동일)

    // 3. 상태를 'confirmed'로 변경 및 정산 데이터 확정 기록
    const basePrice = Number(experience.price || 0);
    const totalExpPrice = basePrice * (Number(booking.guests) || 1);
    const payoutAmount = totalExpPrice * 0.8;
    const platformRev = Number(booking.amount || 0) - payoutAmount;

    console.log(`[ConfirmPayment] Settling: Base=${basePrice}, Total=${totalExpPrice}, Payout=${payoutAmount}`);

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
      throw new Error(`예약 업데이트 실패: ${updateError.message}`);
    }

    // 4. 호스트에게 알림 발송
    if (experience.host_id) {
      await supabase.from('notifications').insert({
        user_id: experience.host_id,
        type: 'booking_confirmed',
        title: '💰 입금 확인 완료!',
        message: `'${experience.title}' 예약의 입금 확인이 완료되었습니다.`,
        link: '/host/dashboard',
        is_read: false
      });
    }

    // 5. 게스트에게 알림 발송
    if (booking.user_id) {
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        type: 'booking_confirmed',
        title: '✅ 예약 확정 알림',
        message: `'${experience.title}' 입금이 확인되어 예약이 확정되었습니다. 즐거운 여행 되세요!`,
        link: '/guest/trips',
        is_read: false
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}