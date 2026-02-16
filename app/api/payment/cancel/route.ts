import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 환불률 계산기 (기존 동일)
function calculateRefundRate(tourDateStr: string, tourTimeStr: string, paymentDateStr: string) {
  const now = new Date();
  const tourDate = new Date(`${tourDateStr}T${tourTimeStr}:00`);
  const paymentDate = new Date(paymentDateStr);
  
  const diffTime = tourDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const hoursSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60);

  // 규정: 24시간 이내 100%, 당일 불가, 1일전 40%, 2~7일전 70%, 8~19일전 80%
  if (hoursSincePayment <= 24 && diffDays > 1) return { rate: 100, reason: '24시간 이내 철회' };
  if (diffDays <= 0) return { rate: 0, reason: '당일/지난 일정' };
  if (diffDays === 1) return { rate: 40, reason: '1일 전 취소' };
  if (diffDays >= 2 && diffDays <= 7) return { rate: 70, reason: '2~7일 전 취소' };
  if (diffDays >= 8 && diffDays <= 19) return { rate: 80, reason: '8~19일 전 취소' };
  return { rate: 100, reason: '20일 전 취소' };
}

export async function POST(request: Request) {
  try {
    const { bookingId, reason: userReason, isHostCancel } = await request.json();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 1. 예약 조회
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (error || !booking) return NextResponse.json({ error: '예약 없음' }, { status: 404 });
    if (booking.status === 'cancelled') return NextResponse.json({ error: '이미 취소됨' }, { status: 400 });

    // 2. 환불액 및 정산액 계산 (핵심 🔥)
    let refundRate = 0;
    let reasonText = '';

    if (isHostCancel) {
      refundRate = 100;
      reasonText = '호스트 사유 취소';
    } else {
      const calc = calculateRefundRate(booking.date, booking.time || '00:00', booking.created_at);
      refundRate = calc.rate;
      reasonText = calc.reason;
    }

    const totalAmount = booking.amount; // 예: 11,000원
    const refundAmount = Math.floor(totalAmount * (refundRate / 100)); // 게스트 환불액 (7,700원)
    const penaltyAmount = totalAmount - refundAmount; // 남은 위약금 (3,300원)

    // 💰 [정산 로직 적용] 위약금 분배 (대표님 확정 정책)
    let hostPayout = 0;
    let platformRevenue = 0;

    if (penaltyAmount > 0) {
      // 1. 위약금 중 호스트의 원래 지분 발라내기 (11,000원 중 10,000원이 호스트 몫이었음 -> 약 90.9%)
      // 수식이 복잡하면 단순하게: (위약금 / 1.1) = 호스트 몫 원금
      const hostPrincipal = Math.floor(penaltyAmount / 1.1); // 3,000원

      // 2. 여기서 수수료 20% 떼기
      const commission = Math.floor(hostPrincipal * 0.2); // 600원 (플랫폼 추가 수익)
      
      hostPayout = hostPrincipal - commission; // 2,400원 (최종 호스트 지급액)
      platformRevenue = penaltyAmount - hostPayout; // 900원 (나머지 싹 다 플랫폼 수익)
    }

    console.log(`🧾 정산 내역 - 환불: ${refundAmount}, 호스트지급: ${hostPayout}, 플랫폼수익: ${platformRevenue}`);

    // 3. PG사 취소 요청 (실제 돈 돌려주기)
    if (refundAmount > 0 && booking.tid) {
        const isPartial = refundAmount < totalAmount ? '1' : '0';
        const formBody = new URLSearchParams({
            TID: booking.tid,
            MID: process.env.NICEPAY_MID || 'nicepay00m',
            Moid: booking.order_id,
            CancelAmt: refundAmount.toString(),
            CancelMsg: userReason || reasonText,
            PartialCancelCode: isPartial, 
        });

        await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody.toString()
        });
    }

    // 4. DB 업데이트 (계산된 정산 내역 저장)
    await supabase.from('bookings').update({ 
      status: 'cancelled',
      cancel_reason: `${userReason} (${reasonText})`,
      refund_amount: refundAmount,          // ✅ 추가
      host_payout_amount: hostPayout,       // ✅ 추가 (정산 시 이것만 주면 됨)
      platform_revenue: platformRevenue     // ✅ 추가 (매출 통계용)
    }).eq('id', bookingId);

    return NextResponse.json({ success: true, refundAmount, hostPayout });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}