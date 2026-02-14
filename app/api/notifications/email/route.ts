import { createClient } from '@supabase/supabase-js'; // 🟢 관리자 권한용 패키지
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let resCode: any = '';
    let amount: any = 0;
    let orderId: any = '';
    let tid: any = '';

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // PC 결제
      const json = await request.json();
      resCode = json.success ? '0000' : '9999'; 
      amount = json.paid_amount;
      orderId = json.merchant_uid;
      tid = json.pg_tid;
    } else {
      // 모바일 리다이렉트
      const formData = await request.formData();
      resCode = formData.get('resCode') || '0000'; 
      amount = formData.get('amt');
      orderId = formData.get('moid');
      tid = formData.get('tid');
    }

    if (resCode === '0000') { 
      // 🟢 [수정] 관리자 권한으로 DB 접속 (쿠키 설정 코드 삭제함)
      // .env.local 파일에 SUPABASE_SERVICE_ROLE_KEY가 꼭 있어야 합니다!
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! 
      );
      
      // 🟢 [수정] 호스트 정보를 알기 위해 experiences 테이블 조인
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .update({
          status: 'PAID',
          tid: tid as string,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select(`
          *,
          experiences (
            host_id,
            title
          )
        `)
        .single();

      if (error) {
        console.error('DB 업데이트 에러:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        // 🟢 [추가] 앱 내 알림 저장 (관리자 권한이라 로그인 없어도 저장됨)
        if (hostId) {
          await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
        }

        // 🟢 [수정] 이메일 발송 (받는 사람 hostId 전달)
        const origin = new URL(request.url).origin;
        try {
          await fetch(`${origin}/api/notifications/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'new_booking',
              recipient_id: hostId, // 필수: 받는 사람
              title: '🎉 새로운 예약이 도착했습니다!',
              message: `[${expTitle}] 체험에 새로운 예약(게스트: ${guestName})이 확정되었습니다.`,
              link: '/host/dashboard', 
              booking_id: bookingData.id,
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
      // 결제 실패 시
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }
  } catch (err) {
    console.error('콜백 처리 중 오류:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}