import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { sendImmediateAdminEmail } from '@/app/utils/adminEmailProvider';
import {
    buildTeamEmailRecipients,
    shouldSendTeamEmail,
    isImmediateTeamEmail,
    type TeamEventType,
} from '@/app/utils/teamNotificationPolicy';

const TEAM_CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000';

type TeamRecipient = {
    email: string;
    userId: string | null;
};

async function getUnreadTeamChatCount(recipientUserId: string) {
    const supabaseAdmin = createAdminClient();
    const unreadFilter = `read_by.is.null,read_by.not.cs.{${recipientUserId}}`;

    const countQuery = await supabaseAdmin
        .from('admin_task_comments')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', TEAM_CHAT_ROOM_ID)
        .neq('author_id', recipientUserId)
        .or(unreadFilter);

    if (!countQuery.error && typeof countQuery.count === 'number') {
        return countQuery.count;
    }

    const fallbackQuery = await supabaseAdmin
        .from('admin_task_comments')
        .select('id, read_by')
        .eq('task_id', TEAM_CHAT_ROOM_ID)
        .neq('author_id', recipientUserId)
        .order('created_at', { ascending: false })
        .limit(500);

    if (fallbackQuery.error) {
        throw new Error(fallbackQuery.error.message);
    }

    return (fallbackQuery.data || []).filter((row) => {
        const readBy = Array.isArray(row.read_by) ? row.read_by : [];
        return !readBy.includes(recipientUserId);
    }).length;
}

async function shouldSendUnreadTeamChatEmail(recipientUserId: string) {
    const unreadCount = await getUnreadTeamChatCount(recipientUserId);
    return unreadCount === 1;
}

export async function POST(request: Request) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            console.warn('🚨 Unauthorized access attempt to team notify API');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient();

        // [Security] admin 검증을 body 파싱 전에 수행 — 비관리자 대용량 페이로드로 메모리 소진 방지
        const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
            userId: user.id,
            email: user.email,
        });
        if (!isAdmin) {
            console.warn(`🚨 Unauthorized team notify attempt by ${user.email}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { title, message, link, eventType } = body as {
            title?: string;
            message?: string;
            link?: string;
            eventType?: TeamEventType;
        };

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
        }

        // [Security] 길이 제한 — DB/이메일 페이로드 블로팅 방지
        if (title.length > 200) {
            return NextResponse.json({ error: 'Title must be 200 characters or fewer' }, { status: 400 });
        }
        if (message.length > 2000) {
            return NextResponse.json({ error: 'Message must be 2000 characters or fewer' }, { status: 400 });
        }

        console.log(`🚀 [Admin Notify API] 팀 알림 처리 준비: ${title} (${eventType || 'unknown'})`);

        const { data: whitelistData, error: whitelistError } = await supabaseAdmin
            .from('admin_whitelist')
            .select('email');

        if (whitelistError) {
            throw new Error(whitelistError.message);
        }

        const whitelistEmails = (whitelistData || [])
            .map((entry) => entry.email)
            .filter((email): email is string => Boolean(email));

        const notificationTargetEmails = whitelistEmails.filter((email) => email !== user.email);
        const emailTargetEmails = buildTeamEmailRecipients({
            eventType,
            whitelistEmails,
            actorEmail: user.email,
        });

        if (notificationTargetEmails.length === 0 && emailTargetEmails.length === 0) {
            console.log('ℹ️ [Admin Notify API] 수신 대상자가 없어 발송을 스킵합니다.');
            return NextResponse.json({ success: true, count: 0, mode: 'skipped' });
        }

        const notificationLink = link || '/admin/dashboard?tab=TEAM';
        const profileRows = notificationTargetEmails.length > 0
            ? await supabaseAdmin
                .from('profiles')
                .select('id, email')
                .in('email', notificationTargetEmails)
            : { data: [], error: null };

        if (profileRows.error) {
            throw new Error(profileRows.error.message);
        }

        const recipientMap = new Map(
            (profileRows.data || [])
                .filter((row) => row.email)
                .map((row) => [row.email as string, row.id as string])
        );

        const recipients: TeamRecipient[] = notificationTargetEmails.map((email) => ({
            email,
            userId: recipientMap.get(email) || null,
        }));

        const notificationRecipients = recipients
            .map((recipient) => recipient.userId)
            .filter((userId): userId is string => Boolean(userId));

        if (notificationRecipients.length > 0) {
            const { error: notificationError } = await supabaseAdmin
                .from('notifications')
                .insert(notificationRecipients.map((recipientUserId) => ({
                    user_id: recipientUserId,
                    type: 'admin_alert',
                    title,
                    message,
                    link: notificationLink,
                    is_read: false,
                })));

            if (notificationError) {
                console.error('❌ [Admin Notify API] 인앱 알림 저장 실패:', notificationError);
            }
        }

        if (!shouldSendTeamEmail(eventType)) {
            return NextResponse.json({
                success: true,
                count: 0,
                notifications: notificationRecipients.length,
                mode: 'in_app_only',
                skipped: 'event_type_not_enabled',
            });
        }

        let sentCount = 0;
        let skippedCount = 0;

        await Promise.all(emailTargetEmails.map(async (recipientEmail) => {
            try {
                if (isImmediateTeamEmail(eventType)) {
                    const result = await sendImmediateAdminEmail({
                        to: recipientEmail,
                        subject: `[Locally Admin] ${title}`,
                        title,
                        message,
                        link: notificationLink,
                        ctaLabel: '대시보드에서 확인하기',
                    });
                    if (result.sent) {
                        sentCount += 1;
                    } else {
                        skippedCount += 1;
                    }
                    return;
                }

                if (eventType === 'team_chat') {
                    const recipient = recipients.find((item) => item.email === recipientEmail);
                    if (!recipient?.userId) {
                        skippedCount += 1;
                        return;
                    }

                    const shouldSend = await shouldSendUnreadTeamChatEmail(recipient.userId);
                    if (!shouldSend) {
                        skippedCount += 1;
                        return;
                    }

                    const result = await sendImmediateAdminEmail({
                        to: recipientEmail,
                        subject: `[Locally Admin] ${title}`,
                        title,
                        message,
                        link: notificationLink,
                        ctaLabel: '대시보드에서 확인하기',
                    });
                    if (result.sent) {
                        sentCount += 1;
                    } else {
                        skippedCount += 1;
                    }
                    return;
                }
            } catch (emailError) {
                console.error(`❌ [Admin Notify API] 이메일 발송 실패 (${recipientEmail}):`, emailError);
            }
        }));

        return NextResponse.json({
            success: true,
            count: sentCount,
            skipped: skippedCount,
            mode: eventType === 'team_chat' ? 'first_unread_only' : 'immediate',
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('🔥 [Admin Notify API] 시스템 에러:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
