import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚨 [Cancel API] 환불 요청 시작');

  try {
    // 1. 환경변수 체크 (필수)
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('🔥 [Cancel API] 환경변수 누락 (SERVICE_KEY)');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    // 2. 요청 데이터 파싱
    const { bookingId, reason } = await request.json();
    console.log(`🔍 [Cancel API] 예약ID: ${bookingId}, 사유: ${reason}`);

    // 3. 관리자 권한으로 DB 접속 (쿠키 필요 없음 -> 500 에러 해결!)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 4. 예약 정보 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      console.error('🔥 [Cancel API] 예약 조회 실패:', dbError);
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    console.log(`✅ [Cancel API] 예약 정보 조회 성공 (TID: ${booking.tid || '없음'})`);

    // 5. TID 확인 및 처리
    if (!booking.tid) {
      console.warn('⚠️ [Cancel API] TID 없음. PG사 취소 건너뛰고 DB만 업데이트.');
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('🔥 [Cancel API] DB 업데이트 실패:', updateError);
        return NextResponse.json({ error: 'DB Update Failed' }, { status: 500 });
      }

      console.log('✅ [Cancel API] DB 상태 변경 완료 (Manual Cancel)');
      // 클라이언트가 성공으로 인식하도록 200 반환
      return NextResponse.json({ success: true, message: 'TID 없이 취소 처리됨' });
    }

    // 6. 나이스페이 취소 요청 (TID 있을 때만 실행)
    console.log('⏳ [Cancel API] 나이스페이로 환불 요청 전송...');
    
    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID || 'nicepay00m',
      Moid: booking.order_id,
      CancelAmt: booking.amount.toString(),
      CancelMsg: reason || '호스트 승인에 의한 취소',
      PartialCancelCode: '0', 
    });

    const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString()
    });

    const niceData = await niceRes.text();
    console.log('📝 [Cancel API] 나이스페이 응답:', niceData);

    // 7. 결과 처리
    // 2001: 취소 성공, 2211: 이미 취소됨
    if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001') || niceData.includes('2211')) {
      console.log('✅ [Cancel API] PG사 환불 성공. DB 업데이트 시작.');
      
      const { error: finalError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);
        
      if (finalError) console.error('🔥 [Cancel API] 최종 DB 업데이트 실패:', finalError);
      
      return NextResponse.json({ success: true });
    } else {
      console.error('🔥 [Cancel API] PG사 환불 거절');
      return NextResponse.json({ error: 'PG사 환불 실패', details: niceData }, { status: 400 });
    }

  } catch (error: any) {
    console.error('🔥 [Cancel API] 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}