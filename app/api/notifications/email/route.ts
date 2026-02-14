import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    // 1. 환경변수 체크 (서버 크래시 방지)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [Email API] 필수 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)');
      return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const body = await request.json();
    const { recipient_id, title, message, link } = body;

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    // 2. 수신자 이메일 조회 (비상 로직 추가)
    let emailToSend = '';
    
    // (A) 프로필 테이블 조회
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', recipient_id)
      .single();

    if (userProfile?.email) {
      emailToSend = userProfile.email;
    } else {
      // (B) 프로필에 없으면 Auth 유저 정보 직접 조회 (관리자 권한)
      console.log(`⚠️ 프로필에 이메일 없음. Auth User 조회 시도: ${recipient_id}`);
      const { data: userData, error: authError } = await supabase.auth.admin.getUserById(recipient_id);
      
      if (userData?.user?.email) {
        emailToSend = userData.user.email;
      } else {
        console.error('❌ Auth 정보에서도 이메일 찾을 수 없음:', authError);
        return NextResponse.json({ error: 'User email not found' }, { status: 404 });
      }
    }

    // 3. Nodemailer 설정 및 발송
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

    console.log(`✅ [Email API] 발송 성공: ${emailToSend}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ [Email API] 치명적 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}