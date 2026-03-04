import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            console.warn('🚨 Unauthorized access attempt to team notify API');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 서비스 키를 사용해 모든 권한(profiles, whitelist)을 조회
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const body = await request.json();
        const { title, message, link } = body;

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
        }

        console.log(`🚀 [Admin Notify API] 팀 협업 알림 발송 준비: ${title}`);

        // 1. 수신 대상자 수집 — admin_whitelist 단일 소스
        // ⚠️ 과거: users.role='admin' + admin_whitelist 이중 소스 합산으로 인해
        //   whitelist에서 삭제된 관리자에게도 계속 메일이 발송되는 버그가 있었음.
        //   → 수정: admin_whitelist만 사용 (whitelist에서 삭제 = 즉시 발송 중단)
        const { data: whitelistData } = await supabaseAdmin
            .from('admin_whitelist')
            .select('email');

        const uniqueEmails = (whitelistData || []).map((w: { email: string }) => w.email).filter(Boolean);

        // 액션을 취한 본인(user.email)은 발송 제외
        const targetEmails = uniqueEmails.filter((email: string) => email !== user.email);

        if (targetEmails.length === 0) {
            console.log('ℹ️ [Admin Notify API] 수신 대상자가 없어 발송을 스킵합니다.');
            return NextResponse.json({ success: true, count: 0 });
        }


        // 2. 이메일 전송 (Nodemailer)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        const fullLink = link ? `${process.env.NEXT_PUBLIC_SITE_URL}${link}` : `${process.env.NEXT_PUBLIC_SITE_URL}/admin/dashboard?tab=TEAM`;

        await Promise.all(targetEmails.map((email: string) =>
            transporter.sendMail({
                from: `"Locally Team" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: `[Locally Admin] ${title}`,
                html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
            <h2 style="color: #0f172a; margin-bottom: 20px;">${title}</h2>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            <a href="${fullLink}" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">대시보드에서 확인하기</a>
            <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">본 메일은 Locally 팀 협업 공간에서 발생한 이벤트 알림입니다.</p>
          </div>
        `,
            }).catch(e => console.error(`❌ 이메일 발송 실패 (${email}):`, e))
        ));

        console.log(`📨 [Admin Notify API] 총 ${targetEmails.length}건의 팀 알림 이메일 발송 완료`);
        return NextResponse.json({ success: true, count: targetEmails.length });

    } catch (error: any) {
        console.error('🔥 [Admin Notify API] 시스템 에러:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
