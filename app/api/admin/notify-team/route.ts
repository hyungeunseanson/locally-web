import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

export async function POST(request: Request) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            console.warn('🚨 Unauthorized access attempt to team notify API');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient();

        const body = await request.json();
        const { title, message, link } = body;

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
        }

        const [userEntry, whitelistEntry] = await Promise.all([
            supabaseAdmin.from('users').select('role').eq('id', user.id).maybeSingle(),
            supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle()
        ]);

        const isAdmin = (userEntry.data?.role === 'admin') || !!whitelistEntry.data;
        if (!isAdmin) {
            console.warn(`🚨 Unauthorized team notify attempt by ${user.email}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        console.log(`🚀 [Admin Notify API] 팀 협업 즉시 메일 발송 준비: ${title}`);

        const { data: whitelistData, error: whitelistError } = await supabaseAdmin
            .from('admin_whitelist')
            .select('email');

        if (whitelistError) {
            throw new Error(whitelistError.message);
        }

        const targetEmails = (whitelistData || [])
            .map((entry) => entry.email)
            .filter((email): email is string => Boolean(email))
            .filter((email) => email !== user.email);

        if (targetEmails.length === 0) {
            console.log('ℹ️ [Admin Notify API] 수신 대상자가 없어 발송을 스킵합니다.');
            return NextResponse.json({ success: true, count: 0, mode: 'immediate' });
        }

        const notificationLink = link || '/admin/dashboard?tab=TEAM';

        await Promise.all(targetEmails.map(async (recipientEmail) => {
            try {
                await sendImmediateGenericEmail({
                    recipientEmail,
                    subject: `[Locally Admin] ${title}`,
                    title,
                    message,
                    link: notificationLink,
                    ctaLabel: '대시보드에서 확인하기',
                });
            } catch (emailError) {
                console.error(`❌ [Admin Notify API] 이메일 발송 실패 (${recipientEmail}):`, emailError);
            }
        }));

        return NextResponse.json({
            success: true,
            count: targetEmails.length,
            mode: 'immediate',
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('🔥 [Admin Notify API] 시스템 에러:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
