import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';

type RequestOwnerProfile = { email?: string | null } | Array<{ email?: string | null }> | null;
type CommentAuthorProfile = { full_name?: string | null; avatar_url?: string | null } | null;

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id: requestId } = await params;

        // Validate request existence and access
        const { data: proxyReq, error: reqError } = await supabase
            .from('proxy_requests')
            .select('id, user_id')
            .eq('id', requestId)
            .maybeSingle();

        if (reqError || !proxyReq) {
            return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        }

        // [Fix] resolveAdminAccess()로 교체 — users.role 기반 체크 포함, null email 안전
        const { isAdmin } = await resolveAdminAccess(supabase, { userId: user.id, email: user.email });

        // Must be either the owner or an admin
        if (proxyReq.user_id !== user.id && !isAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { content } = await request.json();

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid content' }, { status: 400 });
        }
        // [Fix] 5000→2000 (프로젝트 컨텐츠 길이 제한 정책 준수)
        if (content.trim().length > 2000) {
            return NextResponse.json({ success: false, error: 'Comment too long (max 2000 chars)' }, { status: 400 });
        }

        const { data: newComment, error: insertError } = await supabase
            .from('proxy_comments')
            .insert({
                request_id: requestId,
                author_id: user.id,
                content: content.trim(),
                is_admin: isAdmin,
            })
            .select('id, request_id, author_id, content, is_admin, created_at, updated_at')
            .maybeSingle();

        if (insertError || !newComment) {
            console.error('Comment Insert Error:', insertError);
            return NextResponse.json({ success: false, error: 'Failed to add comment' }, { status: 500 });
        }

        // Trigger notification/email side effects asynchronously
        try {
            if (isAdmin) {
                const supabaseAdmin = createAdminClient();
                const { data: ownerProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('email')
                    .eq('id', proxyReq.user_id)
                    .maybeSingle();
                const profiles = (ownerProfile ?? null) as RequestOwnerProfile;
                const userEmail = Array.isArray(profiles) ? profiles[0]?.email : profiles?.email;
                const notificationTitle = '전화 예약 요청에 새 답변이 도착했습니다';
                const notificationMessage = content.trim();
                const notificationLink = `/proxy-bookings/${requestId}`;

                const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
                    user_id: proxyReq.user_id,
                    type: 'new_message',
                    title: notificationTitle,
                    message: notificationMessage,
                    link: notificationLink,
                });

                if (notificationError) {
                    console.error('Failed to insert proxy reply notification:', notificationError);
                }

                await sendImmediateGenericEmail({
                    recipientEmail: userEmail || null,
                    recipientUserId: proxyReq.user_id,
                    subject: `[Locally] ${notificationTitle}`,
                    title: notificationTitle,
                    message: `Locally 운영팀이 전화 예약 요청에 답변을 남겼습니다.\n\n${content.trim()}`,
                    link: notificationLink,
                    ctaLabel: '답변 확인하기',
                }).catch((err) => console.error('Failed to send proxy reply email:', err));
            } else {
                // Notify the admin that the user has replied
                // Assuming admin emails are predetermined or send to a generic support email
                fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/notifications/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-secret': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                    },
                    body: JSON.stringify({
                        type: 'proxy_comment_notify',
                        targetEmail: process.env.ADMIN_SUPPORT_EMAIL || process.env.GMAIL_USER,
                        targetRole: 'admin',
                        requestId,
                        content: content.trim()
                    })
                }).catch(err => console.error('Failed to trigger admin email notification:', err));
            }
        } catch {
            console.warn('Silent email fail on comment creation');
        }

        const { data: authorProfile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

        return NextResponse.json({
            success: true,
            data: {
                ...newComment,
                profiles: (authorProfile ?? null) as CommentAuthorProfile | undefined,
            },
        });
    } catch (error: unknown) {
        console.error('API Proxy Comment POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
