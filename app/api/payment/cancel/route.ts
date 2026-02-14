import { createClient } from '@supabase/supabase-js'; // ✅ 1. ssr 대신 supabase-js 사용
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bookingId, reason } = await request.json();

    // 환경변수 확인
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('🔥 [Cancel API] 환경변수 누락 (SERVICE_KEY 확인 필요)');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    // ✅ 2. 관리자 권한으로 DB 접속 (쿠키 로직 제거로 500 에러 해결)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 예약 정보 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // ✅ 3. TID(결제번호)가 없으면? -> PG사 연동 건너뛰고 DB만 취소 처리 (성공 리턴)
    if (!booking.tid) {
      console.warn('⚠️ TID 없음. DB 상태만 강제로 취소합니다.');
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', bookingId);

      if (updateError) {
        return NextResponse.json({ error: 'DB 업데이트 실패' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'TID 없이 취소 처리됨' });
    }

    // --- 아래는 TID가 있는 정상 케이스 (PG사 환불 요청) ---
    console.log(`⏳ 나이스페이 환불 요청 (TID: ${booking.tid})`);

    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID || 'nicepay00m',
      Moid: booking.order_id,
      CancelAmt: booking.amount.toString(),
      CancelMsg: reason || '호스트 승인 취소',
      PartialCancelCode: '0', 
    });

    const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString()
    });

    const niceData = await niceRes.text();
    console.log('📝 [Cancel API] PG사 응답:', niceData);

    // 2001:성공, 2211:이미취소됨
    if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001') || niceData.includes('2211')) {
      // PG사 성공 시 DB 업데이트
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);
      
      return NextResponse.json({ success: true });
    } else {
      console.error('🔥 PG사 환불 실패:', niceData);
      return NextResponse.json({ error: 'PG사 환불 실패', details: niceData }, { status: 400 });
    }

  } catch (error: any) {
    console.error('🔥 [Cancel API] 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}