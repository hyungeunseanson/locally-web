import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    // 1. 데이터 파싱
    let resCode: any = '';
    let orderId: any = '';
    let tid: any = '';
    
    // 나이스페이/포트원 데이터 수신
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await request.json();
      resCode = json.success ? '0000' : '9999';
      // 포트원 V1/V2 호환성 처리
      orderId = json.merchant_uid || json.orderId;
      tid = json.pg_tid || json.imp_uid;
    } else {
      const formData = await request.formData();
      resCode = formData.get('resCode') || '0000';
      orderId = formData.get('moid');
      tid = formData.get('tid');
    }

    // 2. 환경변수 체크 (가장 흔한 에러 원인)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('서버 환경변수 누락: SUPABASE_SERVICE_ROLE_KEY');
    }
    if (!process.env.GMAIL_APP_PASSWORD) {
      throw new Error('서버 환경변수 누락: GMAIL_APP_PASSWORD');
    }

    if (resCode === '0000') {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // 3. 예약 상태 업데이트
      const { data: bookingData, error: dbError } = await supabase
        .from('bookings')
        .update({
          status: 'PAID',
          tid: tid as string,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('*, experiences(host_id, title)')
        .single();

      if (dbError) throw new Error(`DB 업데이트 실패: ${dbError.message}`);

      // 4. 알림 및 메일 발송
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

          // (B) 메일 발송 (호스트 정보 조회)
          const { data: hostData } = await supabase.auth.admin.getUserById(hostId);
          const { data: profileData } = await supabase.from('profiles').select('email').eq('id', hostId).single();
          
          // 프로필 or Auth에서 이메일 확보
          const hostEmail = profileData?.email || hostData?.user?.email;

          if (hostEmail) {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
              },
            });

            await transporter.sendMail({
              from: `"Locally Team" <${process.env.GMAIL_USER}>`,
              to: hostEmail,
              subject: `[Locally] 🎉 새로운 예약 확정: ${expTitle}`,
              html: `
                <h2>새로운 예약이 들어왔습니다!</h2>
                <p>게스트: ${guestName}</p>
                <p>체험: ${expTitle}</p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard">호스트 대시보드 바로가기</a>
              `
            });
          }
        }
      }

      // 성공 응답
      return NextResponse.json({ success: true });
    } else {
      throw new Error(`결제 실패 (PG사 응답코드: ${resCode})`);
    }

  } catch (error: any) {
    console.error('🔥 결제 처리 중 에러 발생:', error.message);
    // 🟢 [핵심] 리다이렉트 대신 에러 내용을 JSON으로 보냄 (클라이언트가 alert 띄우게)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}