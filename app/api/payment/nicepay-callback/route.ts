import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// 🟢 Vercel 로그에서 확인하기 쉽게 [DEBUG] 태그를 붙였습니다.
export async function POST(request: Request) {
  console.log('🚨 [DEBUG] 결제 콜백 시작');

  try {
    // 1. 필수 환경변수 확인
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('🔥 [DEBUG] 환경변수 누락: SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    // 2. 데이터 파싱
    let resCode: any = '';
    let amount: any = 0;
    let orderId: any = '';
    let rawJson: any = {};
    let tid: any = '';

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await request.json();
      rawJson = json;
      const isSuccess = json.success === true || 
                        json.code === '0' || 
                        json.status === 'paid' || 
                        (json.imp_uid && !json.error_msg);
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

    console.log(`🔍 [DEBUG] 주문ID: ${orderId}, 코드: ${resCode}`);

    if (resCode === '0000') { 
      // 3. 관리자 권한 DB 접속
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      
      // 4. 예약 상태 업데이트 (PAID)
      console.log('⏳ [DEBUG] DB 상태 업데이트 시도 (Only Status)...');
      
// 🟢 [수정] 이제 TID도 함께 저장합니다!
const { data: bookingData, error: dbError } = await supabase
.from('bookings')
.update({
  status: 'PAID',
  tid: tid, // 🟢 TID 저장 복구
  updated_at: new Date().toISOString() // 🟢 (선택) updated_at도 컬럼이 있다면 추가
})
        .eq('id', orderId)
        .select(`*, experiences (host_id, title)`)
        .single();

      if (dbError) {
        console.error('🔥 [DEBUG] DB 업데이트 실패:', dbError);
        // 여기서 에러나면 바로 throw해서 클라이언트에게 알림
        throw new Error(`DB Error: ${dbError.message}`);
      } 
      
      if (bookingData) {
        console.log('✅ [DEBUG] DB 상태 업데이트 완료!');

        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // 5. 알림 저장
          console.log('⏳ [DEBUG] 알림 저장 시도...');
          const { error: notiError } = await supabase.from('notifications').insert({
            user_id: hostId,
            type: 'new_booking',
            title: '🎉 새로운 예약 도착!',
            message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
            link: '/host/dashboard',
            is_read: false
          });
          
          if (notiError) console.error('🔥 [DEBUG] 알림 저장 실패:', notiError);
          else console.log('✅ [DEBUG] 알림 저장 성공!');
          
          // 6. 메일 발송
          console.log('⏳ [DEBUG] 메일 발송 준비...');
          let hostEmail = '';
          const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).single();
          
          if (hostProfile?.email) {
            hostEmail = hostProfile.email;
          } else {
             console.log('⚠️ [DEBUG] 프로필 이메일 없음. Auth 조회...');
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
                    <h2>Locally 예약 알림 🔔</h2>
                    <p>호스트님! <b>[${expTitle}]</b> 체험에 <b>${guestName}</b>님의 예약이 확정되었습니다.</p>
                    <p>지금 바로 대시보드에서 확인해보세요.</p>
                    <br/>
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="background: black; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">확인하기</a>
                  </div>
                `,
              });
              console.log(`🚀 [DEBUG] 메일 발송 성공! (${hostEmail})`);
            } catch (mailError: any) {
              console.error('🔥 [DEBUG] 메일 발송 실패:', mailError);
            }
          } else {
            console.error('🔥 [DEBUG] 호스트 이메일 찾을 수 없음');
          }
        }
      }

      console.log('✅ [DEBUG] 처리 완료. 성공 응답.');
      return NextResponse.json({ success: true });

    } else {
      console.log(`⚠️ [DEBUG] 결제 실패 (코드: ${resCode})`);
      throw new Error(`PG사 응답코드 실패: ${resCode}`);
    }

  } catch (err: any) {
    console.error('🔥 [DEBUG] 시스템 에러:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}