import { createClient } from '@supabase/supabase-js'; // ✅ 500 에러 잡는 핵심 (ssr 대신 이거 사용)
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚨 [Cancel API] 정석 취소 로직 실행 (PG사 연동)');

  try {
    // 1. 환경변수 체크
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('🔥 [Cancel API] 환경변수 누락 (SERVICE_KEY)');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    // 2. 요청 데이터 파싱
    const { bookingId, reason } = await request.json();
    console.log(`🔍 [Cancel API] 요청 ID: ${bookingId}, 사유: ${reason}`);

    // 3. 관리자 권한 DB 접속 (쿠키 인증 제거 -> 500 에러 원천 차단)
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

    // 5. TID 유효성 검사 (강제 실행 로직 삭제함 -> 정석대로 검사)
    if (!booking.tid) {
      console.error('⚠️ [Cancel API] 실패: TID(결제번호)가 없습니다.');
      // 500 에러가 아니라 '400'을 리턴하여 클라이언트가 "실패"임을 알게 함
      return NextResponse.json({ error: '결제 번호(TID)가 없어 취소할 수 없습니다.' }, { status: 400 });
    }

    // 6. 나이스페이 취소 요청 (정석 로직 복구)
    console.log(`⏳ [Cancel API] 나이스페이로 취소 요청 전송 (TID: ${booking.tid})`);
    
    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID || 'nicepay00m', // 환경변수 없으면 테스트 ID
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

    // 7. 결과 처리 (2001:성공, 2211:이미취소됨)
    if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001') || niceData.includes('2211')) {
      console.log('✅ [Cancel API] PG사 취소 성공! DB 업데이트 진행.');
      
      const { error: finalError } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', bookingId);
        
      if (finalError) {
        console.error('🔥 [Cancel API] DB 업데이트 실패:', finalError);
        return NextResponse.json({ error: '취소는 됐으나 DB 반영 실패' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true });
    } else {
      console.error('🔥 [Cancel API] PG사 취소 실패');
      return NextResponse.json({ error: 'PG사에서 취소를 거절했습니다.', details: niceData }, { status: 400 });
    }

  } catch (error: any) {
    console.error('🔥 [Cancel API] 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}