import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let resCode, amount, orderId, tid;

    // 🟢 요청 타입(JSON vs FormData)에 따라 데이터 파싱
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // PC 결제 (Client의 fetch)
      const json = await request.json();
      resCode = json.success ? '0000' : '9999'; 
      amount = json.paid_amount;
      orderId = json.merchant_uid;
      tid = json.pg_tid;
    } else {
      // 모바일 리다이렉트 (FormData)
      const formData = await request.formData();
      resCode = formData.get('resCode') || '0000'; 
      amount = formData.get('amt');
      orderId = formData.get('moid');
      tid = formData.get('tid');
    }

    // 1. 결제 성공 확인
    if (resCode === '0000' || resCode === true) { 
      const cookieStore = await cookies();
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch { }
            },
          },
        }
      );
      
      // 🟢 [핵심] PENDING 상태인 예약을 찾아 PAID로 업데이트 (UPDATE)
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .update({
          status: 'PAID',
          tid: tid as string,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId) // 주문번호로 찾기
        .select()
        .single();

      if (error) {
        console.error('DB 업데이트 에러:', error);
        // 이미 결제가 되었으므로 여기서 에러를 내기보다 로그만 찍고 성공 처리할 수도 있음
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (bookingData) {
        // 🚀 3. 호스트에게 알림 이메일 발송 트리거
        const origin = new URL(request.url).origin;
        try {
          await fetch(`${origin}/api/notifications/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'booking_created',
              booking_id: bookingData.id,
              // bookingData에 experience_id가 이미 있으므로 안전함
              user_name: '게스트', 
              amount: amount
            })
          });
          console.log('📧 알림 이메일 발송 요청됨');
        } catch (emailError) {
          console.error('📧 이메일 실패:', emailError);
        }
      }

      // 응답 처리
      if (contentType.includes('application/json')) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.redirect(
          new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 
          303
        );
      }
    } else {
      // 결제 실패
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }
  } catch (err) {
    console.error('콜백 처리 중 오류:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}