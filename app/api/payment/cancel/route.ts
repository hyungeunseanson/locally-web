import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
// import iconv from 'iconv-lite'; // 💡 미사용 시 삭제 또는 주석 처리

export async function POST(request: Request) {
  try {
    const { bookingId, reason } = await request.json();
    const cookieStore = await cookies();

    // ✅ [수정] 최신 createServerClient 사용법으로 변경
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // 1. 취소할 예약 정보(TID, 금액) 조회
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking || !booking.tid) {
      return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 나이스페이 취소 API 호출 (서버 간 통신)
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString()
    });

    const niceData = await niceRes.text(); 

    // 3. 나이스페이 취소 성공 여부 확인
    if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001')) {
      
      // 4. DB 상태 업데이트 (환불 완료)
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);

      return NextResponse.json({ success: true });
    } else {
      console.error('나이스페이 취소 실패:', niceData);
      return NextResponse.json({ error: '환불 처리에 실패했습니다.' }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({ error: '서버 오류 발생' }, { status: 500 });
  }
}