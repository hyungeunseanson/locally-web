import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
            .select('*, profiles(full_name, email, avatar_url)')
            .eq('id', id);

        if (!isAdmin) {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        }

        // Fetch comments
        const { data: comments, error: commentsError } = await supabase
            .from('proxy_comments')
            .select('*, profiles(full_name, avatar_url)')
            .eq('request_id', id)
            .order('created_at', { ascending: true });

        if (commentsError) {
            console.error('Proxy Comments Fetch Error:', commentsError);
        }

        return NextResponse.json({
            success: true,
            data: {
                ...data,
                comments: comments ?? [],
            },
        });
    } catch (error: any) {
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
        const { status, payment_status } = body;

        let query = supabase.from('proxy_requests').update({});
        let updates: Record<string, any> = {};

        const ALLOWED_STATUSES = new Set(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']);
        const ALLOWED_PAYMENT_STATUSES = new Set(['WAITING', 'PAID', 'REFUNDED']);

        if (isAdmin) {
            if (status && ALLOWED_STATUSES.has(status)) updates.status = status;
            if (payment_status && ALLOWED_PAYMENT_STATUSES.has(payment_status)) updates.payment_status = payment_status;
        } else {
            // User can only cancel their request
            if (status === 'CANCELLED') updates.status = 'CANCELLED';
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
        }

        // [Security] 비관리자: update 전에 소유권 사전 확인 — 0-row update 시 silent 200 방지
        if (!isAdmin) {
            const { data: existing } = await supabase
                .from('proxy_requests')
                .select('id, status')
                .eq('id', id)
                .eq('user_id', user.id)
                .maybeSingle();
            if (!existing) {
                return NextResponse.json({ success: false, error: 'Not found or forbidden' }, { status: 404 });
            }
            if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
                return NextResponse.json({ success: false, error: 'Cannot cancel a request in this state' }, { status: 409 });
            }
        }

        query = supabase.from('proxy_requests').update(updates).eq('id', id);
        if (!isAdmin) {
            query = query.eq('user_id', user.id);
        }

        const { error: updateError } = await query;
        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Proxy Request PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
