import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚨 [Cancel API] 최종 안전 모드 실행');

  try {
    const { bookingId, reason } = await request.json();
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. 예약 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. TID 확인 (없으면 DB만 업데이트)
    if (!booking.tid) {
      console.log('⚠️ TID 없음. DB 상태만 변경합니다.');
      
      // 🟢 [수정] cancelled_at 컬럼을 지웠습니다. (DB 에러 방지)
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' }) 
        .eq('id', bookingId);

      if (updateError) {
        // 여기가 범인이었습니다. 이제 cancelled_at을 뺐으니 에러 안 날 겁니다.
        console.error('🔥 DB 업데이트 에러 상세:', updateError);
        return NextResponse.json({ error: `DB Error: ${updateError.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '취소 처리됨 (TID 없음)' });
    }

    // 3. TID 있으면 PG사 취소 시도
    console.log(`⏳ PG사 환불 요청 (TID: ${booking.tid})`);
    
    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID || 'nicepay00m',
      Moid: booking.order_id,
      CancelAmt: booking.amount.toString(),
      CancelMsg: reason || '취소',
      PartialCancelCode: '0', 
    });

    try {
      const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString()
      });
      const niceData = await niceRes.text();

      // 성공(2001)이거나 이미 취소(2211)
      if (niceData.includes('2001') || niceData.includes('2211')) {
        // 🟢 [수정] 여기도 cancelled_at 삭제
        await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId);
        
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: 'PG사 취소 실패', details: niceData }, { status: 400 });
      }
    } catch (err) {
      // PG사 통신 에러 나도 DB는 취소 처리 해버리기 (선택 사항)
      console.error('PG 통신 에러:', err);
      return NextResponse.json({ error: 'PG Network Error' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('🔥 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}