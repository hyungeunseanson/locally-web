import { createClient } from '@supabase/supabase-js'; // 🟢 관리자 권한용 패키지 사용
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let resCode: any = '';
    let amount: any = 0;
    let orderId: any = '';
    let tid: any = '';

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await request.json();
      resCode = json.success ? '0000' : '9999'; 
      amount = json.paid_amount;
      orderId = json.merchant_uid;
      tid = json.pg_tid;
    } else {
      const formData = await request.formData();
      resCode = formData.get('resCode') || '0000'; 
      amount = formData.get('amt');
      orderId = formData.get('moid');
      tid = formData.get('tid');
    }

    if (resCode === '0000') { 
      // 🟢 [핵심] 관리자 권한으로 DB 접속 (로그인 없이도 수정/조회 가능)
      // 이 코드가 있어야 나이스페이의 신호를 DB가 받아줍니다.
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! 
      );
      
      // 1. 결제 상태 업데이트 (PAID)
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

        // 2. 앱 내 알림 저장 (관리자 권한이라 무조건 저장됨)
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

        // 3. 이메일 발송 요청
        const origin = new URL(request.url).origin;
        try {
          await fetch(`${origin}/api/notifications/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'new_booking',
              recipient_id: hostId, // 받는 사람
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

      // 응답 제발 처리
      if (contentType.includes('application/json')) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.redirect(
          new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 
          303
        );
      }
    } else {
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }
  } catch (err) {
    console.error('콜백 처리 중 오류:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}