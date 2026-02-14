import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    console.log('📨 [Email API] 메시지 알림 요청 도착');
    
    // 관리자 권한 접속
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { recipient_id, title, message, link } = body;

    // 수신자 이메일 찾기
    let emailToSend = '';
    const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', recipient_id).single();
    if (userProfile?.email) emailToSend = userProfile.email;
    else {
      const { data: authData } = await supabase.auth.admin.getUserById(recipient_id);
      if (authData?.user?.email) emailToSend = authData.user.email;
    }

    if (!emailToSend) {
      console.error('❌ [Email API] 이메일 없음');
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // 메일 발송
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"Locally Team" <${process.env.GMAIL_USER}>`,
      to: emailToSend,
      subject: `[Locally] ${title}`,
      html: `<p>${message}</p><br/><a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}">확인하기</a>`,
    });

    console.log('🚀 [Email API] 발송 성공');
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('🔥 [Email API] 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}