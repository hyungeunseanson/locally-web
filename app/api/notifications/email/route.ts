import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // 🟢 [변경] supabase-js 직접 사용
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    // 🟢 [변경] 관리자 권한으로 Supabase 생성 (RLS 우회하여 이메일 조회 가능)
    // 주의: process.env.SUPABASE_SERVICE_ROLE_KEY 가 .env 파일에 있어야 합니다.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );
    
    // 1. 요청 데이터 파싱
    const body = await request.json();
    const { recipient_id, title, message, link, type, inquiry_id } = body;

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    // 10분 쿨타임 체크 (채팅 알림일 경우만)
    if (type === 'new_message' && inquiry_id) {
      const { data: inquiry } = await supabase
        .from('inquiries')
        .select('last_email_sent_at')
        .eq('id', inquiry_id)
        .single();

      if (inquiry?.last_email_sent_at) {
        const lastSent = new Date(inquiry.last_email_sent_at).getTime();
        const now = new Date().getTime();
        if ((now - lastSent) / (1000 * 60) < 10) {
          return NextResponse.json({ skipped: true, reason: 'Throttled' });
        }
      }
      await supabase.from('inquiries').update({ last_email_sent_at: new Date().toISOString() }).eq('id', inquiry_id);
    }

    // 2. 수신자 이메일 조회 (관리자 권한이라 이제 무조건 성공합니다!)
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipient_id)
      .single();

    if (userError || !userProfile?.email) {
      console.error('❌ User email lookup failed:', userError);
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    // 3. Nodemailer 전송 설정
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Locally Team" <${process.env.GMAIL_USER}>`,
      to: userProfile.email,
      subject: `[Locally] ${title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #000;">Locally 알림 🔔</h2>
          <p style="font-size: 16px; color: #333;">안녕하세요, <b>${userProfile.full_name || '회원'}</b>님!</p>
          <p style="font-size: 16px; color: #555; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
            ${message}
          </p>
          ${link ? `
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}" 
                 style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">
                앱에서 확인하기
              </a>
            </div>
          ` : ''}
          <hr style="border: 0; border-top: 1px solid #eee; margin-top: 40px;" />
          <p style="font-size: 12px; color: #999; text-align: center;">
            본 메일은 발신 전용입니다.<br/>
            © Locally. All rights reserved.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${userProfile.email}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Email API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}