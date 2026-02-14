import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    console.log('📨 [Email API] 요청 시작');

    // 1. 환경변수 체크
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [Email API] 필수 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY)');
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const body = await request.json();
    const { recipient_id, title, message, link, type } = body; 

    console.log(`🔍 [Email API] 수신자ID: ${recipient_id}, 타입: ${type}`);

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID missing' }, { status: 400 });
    }

    // 🟢 2. [핵심] 알림 DB 저장 (서버가 관리자 권한으로 수행 -> 권한 에러 해결)
    const { error: insertError } = await supabase.from('notifications').insert({
      user_id: recipient_id,
      type: type || 'system',
      title,
      message,
      link,
      is_read: false
    });

    if (insertError) {
      console.error('❌ [Email API] 알림 DB 저장 실패:', insertError);
      // 알림 저장은 실패해도 이메일 발송은 시도하도록 계속 진행
    } else {
      console.log('✅ [Email API] 알림 DB 저장 성공');
    }

    // 🟢 3. 수신자 이메일 조회 (비상 로직 포함)
    let emailToSend = '';
    
    // (A) profiles 테이블 조회
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', recipient_id)
      .single();

    if (userProfile?.email) {
      emailToSend = userProfile.email;
      console.log('✅ [Email API] Profiles 테이블에서 이메일 찾음');
    } else {
      // (B) Auth 유저 정보 직접 조회
      console.log('⚠️ [Email API] Profiles에 이메일 없음. Auth 조회 시도...');
      const { data: userData, error: authError } = await supabase.auth.admin.getUserById(recipient_id);
      
      if (userData?.user?.email) {
        emailToSend = userData.user.email;
        console.log('✅ [Email API] Auth 정보에서 이메일 찾음');
      } else {
        console.error('❌ [Email API] 이메일 찾기 완전 실패:', authError);
        return NextResponse.json({ success: true, warning: 'Email not found' });
      }
    }

    // 4. 메일 발송
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Locally Team" <${process.env.GMAIL_USER}>`,
      to: emailToSend,
      subject: `[Locally] ${title}`,
      html: `
        <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px; font-family: sans-serif;">
          <h2 style="color: #333;">Locally 알림 🔔</h2>
          <p style="font-size: 16px; color: #555;">${message}</p>
          <br/>
          ${link ? `<a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">확인하기</a>` : ''}
        </div>
      `,
    });

    console.log(`🚀 [Email API] 메일 발송 완료: ${emailToSend}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ [Email API] 치명적 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}