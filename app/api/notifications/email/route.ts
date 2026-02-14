import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // 관리자 권한
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    // 1. 관리자 권한으로 DB 접속
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 2. 데이터 파싱
    const body = await request.json();
    const { recipient_id, title, message, link } = body;

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    // 3. 수신자 이메일 조회
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipient_id)
      .single();

    if (userError || !userProfile?.email) {
      console.error('❌ 이메일 조회 실패:', userError);
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    // 4. Nodemailer 설정 (앱 비밀번호 사용)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // 5. 발송
    await transporter.sendMail({
      from: `"Locally Team" <${process.env.GMAIL_USER}>`,
      to: userProfile.email,
      subject: `[Locally] ${title}`,
      html: `
        <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2>Locally 알림 🔔</h2>
          <p>${message}</p>
          <br/>
          ${link ? `<a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}">확인하기</a>` : ''}
        </div>
      `,
    });

    console.log(`✅ 메일 발송 성공: ${userProfile.email}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ 메일 API 에러:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}