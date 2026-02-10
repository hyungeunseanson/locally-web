import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import nodemailer from 'nodemailer'; // 🟢 추가됨

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. 요청 데이터 파싱
    const body = await request.json();
    const { recipient_id, title, message, link, type, inquiry_id } = body;

    if (!recipient_id) {
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    // 🟢 10분 쿨타임 체크 (채팅 알림일 경우)
    if (type === 'new_message' && inquiry_id) {
      const { data: inquiry } = await supabase
        .from('inquiries')
        .select('last_email_sent_at')
        .eq('id', inquiry_id)
        .single();

      if (inquiry?.last_email_sent_at) {
        const lastSent = new Date(inquiry.last_email_sent_at).getTime();
        const now = new Date().getTime();
        const diffMinutes = (now - lastSent) / (1000 * 60);

        if (diffMinutes < 10) {
          console.log(`⏳ Skipped email for inquiry ${inquiry_id} (Throttled)`);
          return NextResponse.json({ skipped: true, reason: 'Throttled' });
        }
      }
      
      // 시간 업데이트
      await supabase
        .from('inquiries')
        .update({ last_email_sent_at: new Date().toISOString() })
        .eq('id', inquiry_id);
    }

    // 2. 수신자 이메일 조회
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipient_id)
      .single();

    if (userError || !userProfile?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    // 🟢 [핵심] Nodemailer 전송 설정
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // .env에서 가져옴
        pass: process.env.GMAIL_APP_PASSWORD, // .env에서 가져옴
      },
    });

    // 이메일 본문 HTML 꾸미기
    const mailOptions = {
      from: `"Locally Team" <${process.env.GMAIL_USER}>`, // 보내는 사람 표시
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

    // 🟢 실제 전송
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${userProfile.email}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Email API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}