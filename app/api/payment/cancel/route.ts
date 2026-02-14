import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bookingId, reason } = await request.json();
    const cookieStore = await cookies();

    console.log(`[Cancel API] 환불 요청 시작 - ID: ${bookingId}`);

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

    // 🟢 [핵심 수정] TID가 없으면 에러 내지 말고, DB만 업데이트하고 끝내기 (수동 환불 대상)
    if (!booking.tid) {
      console.warn('[Cancel API] ⚠️ TID 없음. PG사 자동 환불 불가. DB 상태만 변경합니다.');
      
      // DB 상태만 'cancelled_by_host' (또는 cancelled)로 변경
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', // 혹은 'refunded'
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', bookingId);

      if (updateError) {
        return NextResponse.json({ error: 'DB 업데이트 실패' }, { status: 500 });
      }

      // 성공으로 간주하고 리턴 (UI에서 에러 안 뜨게 함)
      return NextResponse.json({ 
        success: true, 
        message: 'TID가 없어 자동 환불은 실패했으나, 예약 상태는 취소되었습니다. (나이스페이 관리자 페이지에서 수동 환불 필요)' 
      });
    }

    // --- 아래는 TID가 있을 때만 실행됨 (나중에 컬럼 추가하면 작동) ---

    // 2. 나이스페이 취소 API 호출
    console.log('[Cancel API] 나이스페이 자동 환불 요청 시도');
    const formBody = new URLSearchParams({
      TID: booking.tid,
      MID: process.env.NICEPAY_MID || 'nicepay00m', // 환경변수 없으면 테스트용 ID
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
    console.log('[Cancel API] 나이스페이 응답:', niceData);

    // 3. 결과 확인 (2001: 취소 성공, 2211: 이미 취소됨)
    if (niceData.includes('"ResultCode":"2001"') || niceData.includes('ResultCode=2001') || niceData.includes('2211')) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);

      return NextResponse.json({ success: true });
    } else {
      // 실패 시 에러 반환
      console.error('[Cancel API] PG사 환불 실패:', niceData);
      return NextResponse.json({ error: 'PG사 환불 실패 (나이스페이 에러)', details: niceData }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Cancel API] 서버 내부 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}