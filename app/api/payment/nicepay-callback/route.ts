import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // 나이스페이가 보내주는 결과 데이터들
    const resCode = formData.get('resCode'); // 결과 코드 (0000이면 성공)
    const amount = formData.get('amt');      // 결제 금액
    const orderId = formData.get('moid');    // 주문 번호
    const authDate = formData.get('authDate'); // 승인 일자

    // 1. 결제 성공(0000) 확인
    if (resCode === '0000') {
      const supabase = createRouteHandlerClient({ cookies });
      
      // 현재 로그인한 유저 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 2. Supabase 'bookings' 테이블에 예약 정보 저장
        const { error } = await supabase.from('bookings').insert([
          {
            user_id: user.id,
            amount: Number(amount),
            order_id: orderId as string,
            status: 'PAID', // 결제 완료 상태
            created_at: new Date().toISOString()
          }
        ]);

        if (error) console.error('DB 저장 에러:', error);
      }

      // 3. 성공 페이지로 이동 (쿼리 파라미터로 정보 전달)
      return NextResponse.redirect(
        new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 
        303
      );
    } else {
      // 결제 실패 시 실패 페이지로 이동
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }
  } catch (err) {
    console.error('콜백 처리 중 오류:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}