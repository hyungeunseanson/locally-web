import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    console.log('📨 [Notification API] 알림 요청 수신');

    // 🚨 [보안 패치] 누구나 호출하는 것을 방지 (Auth Check)
    const supabaseAuth = await createServerClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.warn('🚨 Unauthorized access attempt to email API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 관리자 권한 접속 (DB Insert용)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    // 🟢 [수정] recipient_ids(배열) 추가로 받기
    const { recipient_id, recipient_ids, title, message, link, type } = body;

    // 🚨 [보안 패치] 다중 발송은 관리자(Admin)만 가능하도록 제한
    if (recipient_ids && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      const [userProfile, whitelistEntry] = await Promise.all([
        supabaseAuth.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        supabaseAuth.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle()
      ]);

      const isAdmin = (userProfile.data?.role === 'admin') || !!whitelistEntry.data;
      if (!isAdmin) {
        console.error(`🚨 [Security Warning] Unauthorized Mass Email Attempt by ${user.email}`);
        return NextResponse.json({ error: 'Forbidden: Admin Access Required for mass email' }, { status: 403 });
      }

      console.log(`🚀 [API] 다중 발송 시작: ${recipient_ids.length}명`);

      // 1. DB 일괄 저장
      const notificationsData = recipient_ids.map((id: string) => ({
        user_id: id,
        type: type || 'admin_alert',
        title: title,
        message: message,
        link: link || '/notifications',
        is_read: false
      }));

      const { error: dbError } = await supabase.from('notifications').insert(notificationsData);

      if (dbError) console.error('🔥 [API] DB 일괄 저장 실패:', dbError);
      else console.log('✅ [API] DB 일괄 저장 성공');

      // 2. 이메일 대상 조회 (한 번에 조회)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', recipient_ids);

      const emails = profiles?.map((p: any) => p.email).filter(Boolean) || [];

      // 3. 이메일 발송 (병렬 처리)
      if (emails.length > 0) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        // 서버 부하 방지를 위해 Promise.all 사용 (비동기 병렬 발송)
        await Promise.all(emails.map((email: string) =>
          transporter.sendMail({
            from: `"Locally Team" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `[Locally] ${title}`,
            html: `<p>${message}</p><br/><a href="${process.env.NEXT_PUBLIC_SITE_URL}${link}">확인하기</a>`,
          }).catch(e => console.error(`❌ 이메일 발송 실패 (${email}):`, e))
        ));
        console.log(`📨 [API] 이메일 ${emails.length}건 발송 시도 완료`);
      }

      return NextResponse.json({ success: true, count: recipient_ids.length });
    }
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
    const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', recipient_id).maybeSingle();
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