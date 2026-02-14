import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  console.log('🚨 [DEBUG] 나이스페이 콜백 시작됨!'); // 1. 시작 확인

  try {
    // 환경변수 검사
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('🔥 [DEBUG] 치명적 에러: 환경변수(SUPABASE_SERVICE_ROLE_KEY)가 없음!');
      return NextResponse.json({ error: 'Env Missing' }, { status: 500 });
    }

    // 데이터 파싱
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

    console.log(`🔍 [DEBUG] 결제 정보 수신 - 주문ID: ${orderId}, 결과코드: ${resCode}`);

    if (resCode === '0000') {
      // DB 접속
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

      // 1. 예약 상태 업데이트
      console.log('⏳ [DEBUG] 예약 상태 업데이트 시도...');
      const { data: bookingData, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'PAID',
          tid: tid as string,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select(`*, experiences (host_id, title)`).single();

      if (updateError) {
        console.error('🔥 [DEBUG] DB 업데이트 실패:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      
      console.log('✅ [DEBUG] 예약 상태 업데이트 성공!');

      if (bookingData) {
        const hostId = bookingData.experiences?.host_id;
        const expTitle = bookingData.experiences?.title;
        const guestName = bookingData.contact_name || '게스트';

        if (hostId) {
          // 2. 알림 저장 (DB Insert)
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

          // 3. 메일 발송
          console.log('⏳ [DEBUG] 호스트 이메일 조회 시도...');
          let hostEmail = '';
          const { data: hostProfile } = await supabase.from('profiles').select('email').eq('id', hostId).single();
          
          if (hostProfile?.email) {
            hostEmail = hostProfile.email;
            console.log('✅ [DEBUG] 프로필에서 이메일 찾음:', hostEmail);
          } else {
             console.log('⚠️ [DEBUG] 프로필에 이메일 없음. Auth 조회 시도...');
             const { data: authData } = await supabase.auth.admin.getUserById(hostId);
             if (authData?.user?.email) {
                hostEmail = authData.user.email;
                console.log('✅ [DEBUG] Auth에서 이메일 찾음:', hostEmail);
             } else {
                console.error('🔥 [DEBUG] 이메일 찾기 완전 실패. 메일 못 보냄.');
             }
          }

          if (hostEmail) {
            console.log('⏳ [DEBUG] 메일 발송 시작 (Nodemailer)...');
            try {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
              });
              
              await transporter.sendMail({
                from: `"Locally Team" <${process.env.GMAIL_USER}>`,
                to: hostEmail,
                subject: `[Locally] 🎉 새로운 예약이 도착했습니다!`,
                html: `<p>안녕하세요!</p><p>[${expTitle}] 체험에 <b>${guestName}</b>님의 예약이 확정되었습니다.</p><br/><a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard">호스트 대시보드 확인하기</a>`,
              });
              console.log(`🚀 [DEBUG] 메일 발송 최종 성공!! (${hostEmail})`);
            } catch (mailError) {
              console.error('🔥 [DEBUG] 메일 발송 중 에러 발생:', mailError);
            }
          }
        }
      }

      // 성공 페이지 리다이렉트
      if (contentType.includes('application/json')) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.redirect(new URL(`/payment/success?orderId=${orderId}&amount=${amount}`, request.url), 303);
      }

    } else {
      console.log('⚠️ [DEBUG] 결제 실패 응답 수신');
      return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
    }

  } catch (err) {
    console.error('🔥 [DEBUG] 알 수 없는 치명적 에러:', err);
    return NextResponse.redirect(new URL('/payment/fail', request.url), 303);
  }
}