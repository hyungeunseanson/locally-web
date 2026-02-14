import { createClient } from '@supabase/supabase-js'; 
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let resCode: any = '';
    let amount: any = 0;
    let orderId: any = '';
    let tid: any = '';

    const contentType = request.headers.get('content-type') || '';
    
    // 1. 데이터 파싱
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
      // 🟢 관리자 권한으로 DB 접속 (필수)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! 
      );
      
      // 2. 예약 상태 업데이트 (PAID)
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
        console.error('❌ [Nicepay] DB 업데이트 에러:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // 🟢 3. [핵심] 만능 알림 API 호출 (메시지와 동일한 방식!)
          // 서버 내부 통신이므로 절대 경로(process.env.NEXT_PUBLIC_SITE_URL) 사용 필수
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          
          // await 없이 비동기로 호출하여 결제 응답 속도를 높임
          fetch(`${siteUrl}/api/notifications/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient_id: hostId,
              type: 'new_booking', // 알림 타입
              title: '🎉 새로운 예약 도착!',
              message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
              link: '/host/dashboard'
            })
          }).then(res => {
             if(res.ok) console.log('✅ [Nicepay] 알림 API 호출 성공');
             else console.error('❌ [Nicepay] 알림 API 호출 실패', res.status);
          }).catch(err => console.error('❌ [Nicepay] 알림 API 네트워크 에러:', err));
        }
      }

      // 4. 성공 페이지 이동
      if (contentType.includes('application/json')) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.redirect(
          new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 
          303
        );
      }
    } else {
      console.log('❌ [Nicepay] 결제 실패 응답');
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }
  } catch (err) {
    console.error('❌ [Nicepay] 치명적 오류:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}