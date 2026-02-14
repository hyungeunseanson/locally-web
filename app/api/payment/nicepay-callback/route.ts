import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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
      // 관리자 권한 DB 접속 (Vercel 환경변수 필수)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! 
      );
      
      // 결제 완료(PAID) 업데이트
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
        console.error('DB Update Error:', error);
        // 에러가 나도 결제 취소는 아니므로 500 리턴하고 종료
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // 1. 앱 알림 저장 (무조건 실행)
          await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          // 2. 이메일 발송 (실패해도 서버 죽지 않도록 방어)
          try {
            const { data: hostProfile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', hostId)
              .single();

            if (hostProfile?.email) {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: process.env.GMAIL_USER,
                  pass: process.env.GMAIL_APP_PASSWORD,
                },
              });

              await transporter.sendMail({
                from: `"Locally Team" <${process.env.GMAIL_USER}>`,
                to: hostProfile.email,
                subject: `[Locally] 🎉 새로운 예약이 도착했습니다!`,
                html: `
                  <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2>Locally 알림 🔔</h2>
                    <p>안녕하세요, <b>${hostProfile.full_name || '호스트'}</b>님!</p>
                    <p>[${expTitle}] 체험에 <b>${guestName}</b>님의 예약이 확정되었습니다.</p>
                    <br/>
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="background: black; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">대시보드 확인</a>
                  </div>
                `,
              });
              console.log('📧 예약 메일 발송 성공');
            }
          } catch (mailError) {
            console.error('⚠️ 이메일 발송 실패 (알림은 저장됨):', mailError);
            // 메일 실패해도 코드는 계속 진행됨
          }
        }
      }

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
    console.error('Callback Fatal Error:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}