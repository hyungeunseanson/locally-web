import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 환불 계산기
function calculateRefund(tourDateStr: string, tourTimeStr: string, paymentDateStr: string, totalAmount: number) {
  const now = new Date();
  const tourDate = new Date(`${tourDateStr}T${tourTimeStr}:00`);
  const paymentDate = new Date(paymentDateStr);
  
  const diffTime = tourDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const hoursSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60);

  // 1. 결제 후 24시간 이내 + 투어 2일 이상 남음 -> 100% 환불
  if (hoursSincePayment <= 24 && diffDays > 1) {
    return { percent: 100, amount: totalAmount, reason: '결제 후 24시간 이내 (전액)' };
  }

  if (diffDays <= 0) return { percent: 0, amount: 0, reason: '당일/지난 일정 (환불불가)' };
  if (diffDays === 1) return { percent: 40, amount: Math.floor(totalAmount * 0.4), reason: '1일 전 (40%)' };
  if (diffDays >= 2 && diffDays <= 7) return { percent: 70, amount: Math.floor(totalAmount * 0.7), reason: '2~7일 전 (70%)' };
  if (diffDays >= 8 && diffDays <= 19) return { percent: 80, amount: Math.floor(totalAmount * 0.8), reason: '8~19일 전 (80%)' };

  return { percent: 100, amount: totalAmount, reason: '20일 전 (전액)' };
}

export async function POST(request: Request) {
  console.log('🚨 [Cancel API] 요청 진입');

  try {
    const body = await request.json();
    const { bookingId, reason: userReason, isHostCancel } = body;

    console.log('📦 요청 데이터:', { bookingId, userReason, isHostCancel });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const NICE_MID = process.env.NICEPAY_MID || 'nicepay00m'; 
    const NICE_KEY = process.env.NICEPAY_KEY; 

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. 예약 정보 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      console.error('❌ 예약 조회 실패:', dbError);
      return NextResponse.json({ error: '예약 없음' }, { status: 404 });
    }

    // 🟢 [수정] 이미 취소 완료된 것만 막고, '요청중(cancellation_requested)'은 통과시킴
    if (booking.status === 'cancelled' || booking.status === 'CANCELLED') {
      return NextResponse.json({ error: '이미 취소 처리된 예약입니다.' }, { status: 400 });
    }

    // 2. 환불 금액 계산
    let refundData;
    if (isHostCancel) {
      refundData = { percent: 100, amount: booking.amount, reason: '호스트 승인/취소' };
    } else {
      // created_at을 결제일로 간주
      refundData = calculateRefund(booking.date, booking.time || '00:00', booking.created_at, booking.amount);
    }
    
    console.log(`💰 계산된 환불액: ${refundData.amount}원 (${refundData.reason})`);

    // 3. PG사 취소 요청 (금액이 있을 때만)
    if (refundData.amount > 0 && booking.tid) {
        
        // 부분 취소 여부 ('1': 부분취소, '0': 전체취소)
        // 주의: 전체 금액과 환불액이 같으면 '0'으로 보내야 깔끔하게 취소됨
        const isPartial = refundData.amount < booking.amount ? '1' : '0';

        const formBody = new URLSearchParams({
            TID: booking.tid,
            MID: NICE_MID,
            Moid: booking.order_id,
            CancelAmt: refundData.amount.toString(),
            CancelMsg: userReason || refundData.reason,
            PartialCancelCode: isPartial, 
        });

        console.log('📤 PG사 요청 전송:', formBody.toString());

        const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody.toString()
        });

        const niceData = await niceRes.text();
        console.log('📥 PG사 응답:', niceData);

        // 2001(취소성공), 2211(이미취소됨) 이 아니면 에러 처리
        if (!niceData.includes('2001') && !niceData.includes('2211')) {
            console.error('❌ PG 취소 실패');
            return NextResponse.json({ error: 'PG사 거절', details: niceData }, { status: 400 });
        }
    } else {
        console.log('⚠️ 환불액 0원이거나 TID 없음. DB만 업데이트합니다.');
    }

    // 4. DB 상태 업데이트 (최종)
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled', // 최종적으로 'cancelled'로 변경
        cancel_reason: `${userReason} (${refundData.reason})`
      })
      .eq('id', bookingId);

    if (updateError) {
        console.error('🔥 DB 업데이트 실패:', updateError);
        return NextResponse.json({ error: 'DB Update Failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, refundAmount: refundData.amount });

  } catch (error: any) {
    console.error('🔥 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}