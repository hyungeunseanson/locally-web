import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

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
            .select('id, user_id, profiles!user_id(email)')
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
            .select('*, profiles(full_name, avatar_url)')
            .maybeSingle();

        if (insertError || !newComment) {
            console.error('Comment Insert Error:', insertError);
            return NextResponse.json({ success: false, error: 'Failed to add comment' }, { status: 500 });
        }

        // Trigger Email Notification Asynchronously
        try {
            if (isAdmin) {
                // Notify the user that the admin has replied
                const profiles = proxyReq.profiles as any;
                const userEmail = Array.isArray(profiles) ? profiles[0]?.email : profiles?.email;
                if (userEmail) {
                    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/notifications/send-email`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-internal-secret': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                        },
                        body: JSON.stringify({
                            type: 'proxy_comment_notify',
                            targetEmail: userEmail,
                            targetRole: 'user',
                            requestId,
                            content: content.trim()
                        })
                    }).catch(err => console.error('Failed to trigger email notification:', err));
                }
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
        } catch (e) {
            console.warn('Silent email fail on comment creation');
        }

        return NextResponse.json({ success: true, data: newComment });
    } catch (error: any) {
        console.error('API Proxy Comment POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
