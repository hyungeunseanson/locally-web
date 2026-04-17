import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createInquiryMessage } from '@/app/api/inquiries/thread/shared';
import { getProxyLinkedInquiryId, PROXY_LINKED_INQUIRY_REQUIRED_ERROR } from '@/app/utils/proxyBooking';

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
            .select('id, user_id, form_data')
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

        const linkedInquiryId = getProxyLinkedInquiryId(proxyReq.form_data as Record<string, unknown> | null | undefined);

        if (!linkedInquiryId) {
            return NextResponse.json(
                { success: false, error: PROXY_LINKED_INQUIRY_REQUIRED_ERROR },
                { status: 409 }
            );
        }

        const inquiryResult = await createInquiryMessage({
            actor: {
                id: user.id,
                email: user.email,
            },
            body: {
                inquiryId: linkedInquiryId,
                content: content.trim(),
                type: 'text',
            },
        });

        const { data: authorProfile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

        return NextResponse.json({
            success: true,
            data: {
                id: String(inquiryResult.messageId),
                request_id: requestId,
                author_id: user.id,
                content: inquiryResult.displayContent,
                is_admin: isAdmin,
                created_at: inquiryResult.updatedAt,
                updated_at: inquiryResult.updatedAt,
                profiles: (authorProfile ?? null) as CommentAuthorProfile | undefined,
            },
        });
    } catch (error: unknown) {
        console.error('API Proxy Comment POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
