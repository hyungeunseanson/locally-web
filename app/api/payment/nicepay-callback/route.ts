import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  console.log('🚨 [DEBUG] 결제 콜백 시작');

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
      
      // 🟢 [보안 핵심] DB 원본 데이터와 비교
      const { data: originalBooking } = await supabase
        .from('bookings')
        .select('amount, status')
        .eq('id', orderId)
        .single();

      if (!originalBooking) throw new Error('예약 정보를 찾을 수 없습니다.');

      // 중복 처리 방지
      if (['PAID', 'confirmed'].includes(originalBooking.status)) {
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // 🟢 [보안 핵심] 금액 불일치 시 에러 (해킹 방지)
      if (Number(originalBooking.amount) !== Number(amount)) {
        console.error(`🔥 [CRITICAL] 금액 위변조 감지! 예상: ${originalBooking.amount}, 실제: ${amount}`);
        throw new Error('Payment amount mismatch.');
      }

      // 4. 예약 상태 업데이트 (PAID)
      const { data: bookingData, error: dbError } = await supabase
        .from('bookings')
        .update({ status: 'PAID', tid: tid })
        .eq('id', orderId)
        .select(`*, experiences (host_id, title)`)
        .single();

      if (dbError) throw new Error(`DB Error: ${dbError.message}`);
      
      if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // 5. 알림 저장
          await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          // 🟢 6. [복구됨] 이메일 발송 로직 (호스트 조회 + Nodemailer)
          console.log('⏳ [DEBUG] 호스트 이메일 조회 중...');
          let hostEmail = '';
          
          // (1) Profiles 테이블 조회
          const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).single();
          if (hostProfile?.email) {
            hostEmail = hostProfile.email;
          } else {
             // (2) Auth User 테이블 조회 (Admin 권한)
             console.log('⚠️ [DEBUG] 프로필 이메일 없음. Auth User 조회...');
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
                  <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px; font-family: sans-serif;">
                    <h2 style="color: #000;">Locally 예약 알림 🔔</h2>
                    <p>호스트님! <b>[${expTitle}]</b> 체험에 <b>${guestName}</b>님의 예약이 확정되었습니다.</p>
                    <p>인원: ${bookingData.guests}명<br/>날짜: ${bookingData.date} ${bookingData.time}</p>
                    <br/>
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="background: black; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">대시보드에서 확인하기</a>
                  </div>
                `,
              });
              console.log(`🚀 [DEBUG] 메일 발송 성공! -> ${hostEmail}`);
            } catch (mailError: any) {
              console.error('🔥 [DEBUG] 메일 발송 실패:', mailError);
            }
          } else {
            console.error('🔥 [DEBUG] 호스트 이메일을 찾을 수 없습니다.');
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