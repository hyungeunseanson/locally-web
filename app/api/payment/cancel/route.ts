import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚨 [Cancel API] 안전 모드 v2 실행');

  try {
    // 1. 환경변수 체크 (가장 흔한 500 원인)
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL) {
      console.error('🔥 [Cancel API] NEXT_PUBLIC_SUPABASE_URL 없음');
      return NextResponse.json({ error: 'Env Error: URL missing' }, { status: 500 });
    }
    if (!SERVICE_KEY) {
      console.error('🔥 [Cancel API] SUPABASE_SERVICE_ROLE_KEY 없음');
      return NextResponse.json({ error: 'Env Error: Service Key missing' }, { status: 500 });
    }

    // 2. 데이터 파싱
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('🔥 [Cancel API] JSON 파싱 실패');
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { bookingId, reason } = body;
    console.log(`🔍 [Cancel API] 요청 ID: ${bookingId}, 사유: ${reason}`);

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    // 3. 관리자 권한 DB 접속
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 4. 예약 정보 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      console.error('🔥 [Cancel API] 예약 조회 실패:', dbError);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 5. TID 확인 및 처리
    // (A) TID가 없는 경우 -> DB만 취소 처리
    if (!booking.tid) {
      console.warn('⚠️ TID 없음. DB 상태만 변경합니다.');
      
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

      return NextResponse.json({ success: true, message: 'TID 없이 취소 처리됨 (수동 환불 필요)' });
    }

    // (B) TID가 있는 경우 -> 나이스페이 취소 요청
    console.log(`⏳ 나이스페이 환불 요청 (TID: ${booking.tid})`);

    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID || 'nicepay00m',
      Moid: booking.order_id,
      CancelAmt: booking.amount.toString(),
      CancelMsg: reason || '호스트 승인 취소',
      PartialCancelCode: '0', 
    });

    try {
      const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString()
      });

      const niceData = await niceRes.text();
      console.log('📝 [Cancel API] 나이스페이 응답:', niceData);

      if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001') || niceData.includes('2211')) {
        console.log('✅ [Cancel API] 환불 성공! DB 업데이트.');
        
        await supabase
          .from('bookings')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', bookingId);
        
        return NextResponse.json({ success: true });
      } else {
        console.error('🔥 [Cancel API] 환불 실패 (PG 응답)');
        // 200 OK로 보내되, 실패 메시지를 담아서 클라이언트가 alert를 띄우지 않게 하거나,
        // 400을 보내서 에러를 띄우게 할 수 있음. 여기서는 에러 처리가 명확하도록 400 유지.
        return NextResponse.json({ error: 'PG사 환불 실패', details: niceData }, { status: 400 });
      }
    } catch (fetchError) {
      console.error('🔥 [Cancel API] PG사 통신 오류:', fetchError);
      return NextResponse.json({ error: 'PG Network Error' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('🔥 [Cancel API] 시스템 에러:', error);
    return NextResponse.json({ error: error.message || 'Unknown Server Error' }, { status: 500 });
  }
}