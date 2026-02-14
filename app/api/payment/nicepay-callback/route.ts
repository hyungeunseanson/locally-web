import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  console.log('💳 [Nicepay] 콜백 시작');
  
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

    console.log(`💳 [Nicepay] 결제결과: ${resCode}, 주문ID: ${orderId}`);

    if (resCode === '0000') { 
      // 관리자 권한 DB 접속
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! 
      );
      
      // 1. 상태 업데이트
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .update({
          status: 'PAID',
          tid: tid as string,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select(`*, experiences (host_id, title)`).single();

      if (error) {
        console.error('❌ [Nicepay] DB 업데이트 에러:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (bookingData) {
        console.log('✅ [Nicepay] 예약 상태 업데이트 완료');
        
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // 2. 알림 저장 (직접 수행)
          const { error: notiError } = await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          if (notiError) console.error('❌ [Nicepay] 알림 저장 실패:', notiError);
          else console.log('✅ [Nicepay] 알림 저장 성공');
          
          // 3. 메일 발송 (직접 수행 - 비상 로직 포함)
          let hostEmail = '';
          const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).single();
          
          if (hostProfile?.email) hostEmail = hostProfile.email;
          else {
             console.log('⚠️ [Nicepay] 프로필 이메일 없음. Auth 조회...');
             const { data: authData } = await supabase.auth.admin.getUserById(hostId);
             if (authData?.user?.email) hostEmail = authData.user.email;
          }

          if (hostEmail) {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await transporter.sendMail({
              from: `"Locally Team" <${process.env.GMAIL_USER}>`,
              to: hostEmail,
              subject: `[Locally] 🎉 새로운 예약이 도착했습니다!`,
              html: `<p>예약 확정: ${expTitle} (${guestName}님)</p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard">확인하기</a>`,
            });
            console.log(`🚀 [Nicepay] 메일 발송 성공: ${hostEmail}`);
          } else {
            console.error('❌ [Nicepay] 호스트 이메일 찾을 수 없음');
          }
        }
      }

      if (contentType.includes('application/json')) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.redirect(new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 303);
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