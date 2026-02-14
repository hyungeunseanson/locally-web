import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    console.log('📨 [Notification API] 알림 요청 수신');
    
    // 1. 관리자 권한 접속
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { recipient_id, title, message, link, type } = body;

    // 🟢 [추가됨] 2. DB 알림 테이블에 저장 (이게 없어서 알림창에 안 떴던 것!)
    if (recipient_id) {
        const { error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: recipient_id, // 받는 사람
            type: type || 'general',
            title: title,
            message: message, // 내용
            link: link,
            is_read: false
          });
          
        if (dbError) {
             console.error('🔥 [Notification API] DB 저장 실패:', dbError);
        } else {
             console.log('✅ [Notification API] DB 저장 성공 (알림창 노출)');
        }
    }

    // 3. 수신자 이메일 찾기 (기존 로직)
    let emailToSend = '';
    const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', recipient_id).single();
    if (userProfile?.email) emailToSend = userProfile.email;
    else {
      const { data: authData } = await supabase.auth.admin.getUserById(recipient_id);
      if (authData?.user?.email) emailToSend = authData.user.email;
    }

    if (!emailToSend) {
      console.error('❌ [Notification API] 이메일 없음');
      // DB 저장은 성공했을 수 있으므로 에러 대신 성공 처리하되 로그만 남김 (선택 사항)
      // return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // 4. 메일 발송 (기존 로직)
    if (emailToSend) {
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
        console.log('🚀 [Notification API] 이메일 발송 성공');
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('🔥 [Notification API] 시스템 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}