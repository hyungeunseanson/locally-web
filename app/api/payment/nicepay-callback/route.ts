import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer'; // 🟢 직접 발송을 위해 임포트

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
      // 🟢 [관리자 권한] DB 접속
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! 
      );
      
      // 🟢 2. 결제 상태 업데이트 (PAID)
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

        // 🟢 3. [알림] 앱 내 알림 저장 (DB Insert)
        if (hostId) {
          await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          // 🟢 4. [메일] 이메일 직접 발송 (fetch 아님!)
          // 호스트 이메일 조회
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

            // await를 사용하여 발송 완료를 보장함
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
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" 
                     style="background: black; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    호스트 대시보드 확인하기
                  </a>
                </div>
              `,
            });
            console.log(`📧 예약 알림 메일 발송 성공: ${hostProfile.email}`);
          }
        }
      }

      // 5. 성공 페이지 이동
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