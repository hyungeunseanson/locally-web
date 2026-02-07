import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import iconv from 'iconv-lite'; // 💡 한글 깨짐 방지용 (npm install iconv-lite 필요할 수 있음)

export async function POST(request: Request) {
  try {
    const { bookingId, reason } = await request.json();
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: () => cookieStore }
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
    // 실제 운영 시에는 나이스페이 문서에 맞는 인코딩 및 헤더 설정이 필요합니다.
    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID!, // ✅ 환경변수에 상점ID(MID) 추가 필요
      Moid: booking.order_id,
      CancelAmt: booking.amount.toString(),
      CancelMsg: reason || '사용자 요청에 의한 취소',
      PartialCancelCode: '0', // 전체 취소: 0, 부분 취소: 1
    });

    // 💡 나이스페이 취소 URL (버전/계약 형태에 따라 다를 수 있으니 확인 필요)
    const niceRes = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // 'CharSet': 'euc-kr' // 나이스페이는 보통 EUC-KR을 사용하므로 인코딩 주의
      },
      body: formBody.toString()
    });

    const niceData = await niceRes.text(); // 결과가 보통 text나 json으로 옴

    // 3. 나이스페이 취소 성공 여부 확인 (응답 파싱 필요)
    // 응답 문자열에 "2001"(취소성공) 코드가 포함되어 있는지 등 체크 로직
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