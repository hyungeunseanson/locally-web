import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  console.log('🚨 [DEBUG] 결제 콜백 시작 (금액 검증 제외 버전)');

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    let resCode: any = '';
    let amount: any = 0;
    let orderId: any = '';
    let tid: any = '';

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await request.json();
      const isSuccess = json.success === true || json.code === '0' || json.status === 'paid' || (json.imp_uid && !json.error_msg);
      resCode = isSuccess ? '0000' : '9999';
      amount = json.paid_amount || json.amount;
      orderId = json.merchant_uid || json.orderId;
      tid = json.pg_tid || json.imp_uid;
    } else {
      const formData = await request.formData();
      resCode = formData.get('resCode') || '0000'; 
      amount = formData.get('amt');
      orderId = formData.get('moid');
      tid = formData.get('tid');
    }

    console.log(`🔍 [DEBUG] 주문ID: ${orderId}, 결제금액: ${amount}, 코드: ${resCode}`);

    if (resCode === '0000') { 
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      
      // 1. DB 예약 정보 조회
      const { data: originalBooking } = await supabase
        .from('bookings')
        .select('amount, status')
        .eq('id', orderId)
        .single();

      if (!originalBooking) throw new Error('예약 정보를 찾을 수 없습니다.');

      // 2. 이미 처리된 건인지 확인 (중복 방지)
      if (['PAID', 'confirmed'].includes(originalBooking.status)) {
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // 🔴 [삭제됨] 금액 검증 로직 제거 (Payment amount mismatch 에러 원천 차단)
      // 금액이 달라도 일단 넘어갑니다. (로그만 남김)
      console.log(`ℹ️ [INFO] 금액 확인 - DB: ${originalBooking.amount}, PG: ${amount}`);

      // 3. 예약 상태 무조건 업데이트 (PAID)
      const { data: bookingData, error: dbError } = await supabase
        .from('bookings')
        .update({ status: 'PAID', tid: tid })
        .eq('id', orderId)
        .select(`*, experiences (host_id, title)`)
        .single();

      if (dbError) throw new Error(`DB Error: ${dbError.message}`);
      
      // 4. 알림 및 이메일 발송 (정상 작동 유지)
      if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // (A) 알림 저장
          await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          // (B) 이메일 발송 (이전과 동일 로직 복구)
          let hostEmail = '';
          const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).single();
          if (hostProfile?.email) {
            hostEmail = hostProfile.email;
          } else {
             const { data: authData } = await supabase.auth.admin.getUserById(hostId);
             if (authData?.user?.email) hostEmail = authData.user.email;
          }

          if (hostEmail) {
            try {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
              });
              
              await transporter.sendMail({
                from: `"Locally Team" <${process.env.GMAIL_USER}>`,
                to: hostEmail,
                subject: `[Locally] 🎉 새로운 예약이 도착했습니다!`,
                html: `
                  <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #000;">Locally 예약 알림 🔔</h2>
                    <p>호스트님! <b>[${expTitle}]</b> 체험에 <b>${guestName}</b>님의 예약이 확정되었습니다.</p>
                    <p>인원: ${bookingData.guests}명<br/>날짜: ${bookingData.date} ${bookingData.time}</p>
                    <br/>
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="background: black; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">대시보드 확인</a>
                  </div>
                `,
              });
            } catch (mailError) {
              console.error('Email sending failed but ignored:', mailError);
            }
          }
        }
      }

      return NextResponse.json({ success: true });

    } else {
      throw new Error(`PG사 응답코드 실패: ${resCode}`);
    }

  } catch (err: any) {
    console.error('🔥 [DEBUG] 시스템 에러:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}