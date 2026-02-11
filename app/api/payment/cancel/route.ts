import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bookingId, reason } = await request.json();
    const cookieStore = await cookies();

    console.log(`[Cancel API] 요청 수신 - ID: ${bookingId}`); // ✅ 로그 추가

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // 1. 예약 정보 조회
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (dbError || !booking) {
      console.error('[Cancel API] 예약 조회 실패:', dbError);
      return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // ✅ 테스트 데이터(TID 없음)일 경우를 대비해 400 에러로 변경
    if (!booking.tid) {
      console.error('[Cancel API] TID 없음 (결제 내역 없음)');
      
      // 💡 [임시] TID가 없어도 강제로 취소 처리하고 싶다면 아래 주석을 해제하세요.
      /*
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
      return NextResponse.json({ success: true, message: 'TID 없이 강제 취소됨' });
      */

      return NextResponse.json({ error: '결제 승인 번호(TID)가 없습니다.' }, { status: 400 });
    }

    // 2. 나이스페이 취소 API 호출
    console.log('[Cancel API] 나이스페이 요청 시작');
    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID!, 
      Moid: booking.order_id,
      CancelAmt: booking.amount.toString(),
      CancelMsg: reason || '사용자 요청에 의한 취소',
      PartialCancelCode: '0', 
    });

    const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString()
    });

    const niceData = await niceRes.text();
    console.log('[Cancel API] 나이스페이 응답:', niceData);

    // 3. 결과 확인
    if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001')) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'PG사 환불 실패', details: niceData }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Cancel API] 서버 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}