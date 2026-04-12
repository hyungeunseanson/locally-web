import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getProxyLinkedInquiryId } from '@/app/utils/proxyBooking';

type ProxyRequestRow = {
    id: string;
    user_id: string;
    category: string;
    status: string;
    form_data: Record<string, unknown> | null;
    payment_channel: string;
    payment_status: string;
    naver_buyer_name: string | null;
    locally_order_id: string | null;
    agreed_to_terms: boolean;
    created_at: string;
    updated_at: string;
};

type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
};

type ProxyCommentRow = {
    id: string;
    request_id: string;
    author_id: string;
    content: string;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
};

type InquiryMessageRow = {
    id: number | string;
    inquiry_id: number | string;
    sender_id: string;
    content: string;
    type?: string | null;
    created_at: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // [Fix] resolveAdminAccess()로 교체 — users.role 기반 체크 포함, null email 안전
        const { isAdmin } = await resolveAdminAccess(supabase, { userId: user.id, email: user.email });

        let query = supabase
            .from('proxy_requests')
            .select('id, user_id, category, status, form_data, payment_channel, payment_status, naver_buyer_name, locally_order_id, agreed_to_terms, created_at, updated_at')
            .eq('id', id);

        if (!isAdmin) {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        }

        const requestRow = data as ProxyRequestRow;
        let profile: ProfileRow | null = null;

        if (requestRow.user_id) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, phone')
                .eq('id', requestRow.user_id)
                .maybeSingle();

            if (profileError) {
                console.error('Proxy Request Detail Profile Fetch Error:', profileError);
                return NextResponse.json({ success: false, error: 'Failed to fetch request detail' }, { status: 500 });
            }

            profile = (profileData as ProfileRow | null) ?? null;
        }

        const linkedInquiryId = getProxyLinkedInquiryId(requestRow.form_data);
        if (!linkedInquiryId) {
            return NextResponse.json(
                { success: false, error: '전화 예약 문의 스레드가 연결되어 있지 않습니다.' },
                { status: 409 }
            );
        }

        const { data: inquiryMessages, error: inquiryMessagesError } = await supabase
            .from('inquiry_messages')
            .select('id, inquiry_id, sender_id, content, type, created_at')
            .eq('inquiry_id', linkedInquiryId)
            .order('created_at', { ascending: true });

        if (inquiryMessagesError) {
            console.error('Proxy Linked Inquiry Messages Fetch Error:', inquiryMessagesError);
            return NextResponse.json({ success: false, error: 'Failed to fetch request detail' }, { status: 500 });
        }

        const commentRows: ProxyCommentRow[] = ((inquiryMessages ?? []) as InquiryMessageRow[]).map((message) => ({
            id: String(message.id),
            request_id: id,
            author_id: message.sender_id,
            content: message.content,
            is_admin: String(message.sender_id) !== String(requestRow.user_id),
            created_at: message.created_at,
            updated_at: message.created_at,
        }));

        const commentAuthorIds = [...new Set(commentRows.map((comment) => comment.author_id).filter(Boolean))];
        const commentProfilesById = new Map<string, Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>>();

        if (commentAuthorIds.length > 0) {
            const { data: commentProfiles, error: commentProfilesError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', commentAuthorIds);

            if (commentProfilesError) {
                console.error('Proxy Comment Profiles Fetch Error:', commentProfilesError);
                return NextResponse.json({ success: false, error: 'Failed to fetch request detail' }, { status: 500 });
            }

            for (const commentProfile of (commentProfiles ?? []) as Array<Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>>) {
                commentProfilesById.set(commentProfile.id, commentProfile);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...requestRow,
                linked_inquiry_id: linkedInquiryId,
                profiles: profile
                    ? {
                        full_name: profile.full_name,
                        email: profile.email,
                        avatar_url: profile.avatar_url,
                        phone: profile.phone,
                    }
                    : undefined,
                comments: commentRows.map((comment) => ({
                    ...comment,
                    profiles: commentProfilesById.get(comment.author_id)
                        ? {
                            full_name: commentProfilesById.get(comment.author_id)?.full_name ?? null,
                            avatar_url: commentProfilesById.get(comment.author_id)?.avatar_url ?? null,
                        }
                        : undefined,
                })),
            },
            viewerIsAdmin: isAdmin,
        });
    } catch (error: unknown) {
        console.error('API Proxy Request Detail GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // [Fix] resolveAdminAccess()로 교체 — users.role 기반 체크 포함, null email 안전
        const { isAdmin } = await resolveAdminAccess(supabase, { userId: user.id, email: user.email });
        const body = await request.json();
        const { status } = body;

        const updates: Record<string, string> = {};

        const ALLOWED_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED']);
        const nextStatus = typeof status === 'string' ? status.toUpperCase() : '';

        const { data: existingRequest, error: existingError } = await supabase
            .from('proxy_requests')
            .select('id, user_id, status, payment_status')
            .eq('id', id)
            .maybeSingle();

        if (existingError || !existingRequest) {
            return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        }

        if (isAdmin) {
            if (nextStatus && ALLOWED_STATUSES.has(nextStatus)) updates.status = nextStatus;
        } else {
            // User can only cancel their request
            if (nextStatus === 'CANCELLED') updates.status = 'CANCELLED';
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
        }

        if (
            isAdmin &&
            updates.status &&
            (updates.status === 'IN_PROGRESS' || updates.status === 'COMPLETED') &&
            String(existingRequest.payment_status || '').toUpperCase() !== 'COMPLETED'
        ) {
            return NextResponse.json(
                { success: false, error: '결제 완료 후에만 전화 예약 진행을 시작할 수 있습니다.' },
                { status: 409 }
            );
        }

        // [Security] 비관리자: update 전에 소유권 사전 확인 — 0-row update 시 silent 200 방지
        if (!isAdmin) {
            if (existingRequest.user_id !== user.id) {
                return NextResponse.json({ success: false, error: 'Not found or forbidden' }, { status: 404 });
            }
            if (existingRequest.status === 'CANCELLED' || existingRequest.status === 'COMPLETED') {
                return NextResponse.json({ success: false, error: 'Cannot cancel a request in this state' }, { status: 409 });
            }
        }

        let updateQuery = supabase.from('proxy_requests').update(updates).eq('id', id);
        if (!isAdmin) {
            updateQuery = updateQuery.eq('user_id', user.id);
        }

        const { error: updateError } = await updateQuery;
        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('API Proxy Request PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
