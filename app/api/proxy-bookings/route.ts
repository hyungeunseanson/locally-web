import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Validate with Zod
        const validationResult = ProxyRequestValidationSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid form data', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const data = validationResult.data;
        const isNaver = data.payment_channel === 'NAVER';

        // Insert into proxy_requests
        const { data: newRequest, error: insertError } = await supabase
            .from('proxy_requests')
            .insert({
                user_id: user.id,
                category: data.category_data.category,
                form_data: data.category_data.form_data,
                payment_channel: data.payment_channel,
                payment_status: 'WAITING', // Will be updated by PG or Manual Admin
                naver_buyer_name: isNaver ? data.naver_buyer_name : null,
                locally_order_id: !isNaver ? `LOCALLY-PROXY-${crypto.randomUUID()}` : null,
                agreed_to_terms: data.agreed_to_terms,
                status: 'PENDING',
            })
            .select('id, locally_order_id')
            .maybeSingle();

        if (insertError || !newRequest) {
            console.error('Proxy Request Create Error:', insertError);
            // [Fix] 23505 = unique_violation — 중복 order ID 시 500 대신 409 반환
            if (insertError?.code === '23505') {
                return NextResponse.json({ success: false, error: 'Duplicate request' }, { status: 409 });
            }
            return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            requestId: newRequest.id,
            locallyOrderId: newRequest.locally_order_id,
        });
    } catch (error: any) {
        console.error('API Proxy Request POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // [Fix] resolveAdminAccess()로 교체 — users.role 기반 체크 포함, null email 안전
        const { isAdmin } = await resolveAdminAccess(supabase, { userId: user.id, email: user.email });

        let query = supabase
            .from('proxy_requests')
            .select('*, profiles(full_name, email)') // Fetch basic client profile
            .order('created_at', { ascending: false })
            .limit(50);

        if (!isAdmin) {
            // Regular user can only fetch their own requests
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Proxy Requests Fetch Error:', error);
            return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data ?? [] });
    } catch (error: any) {
        console.error('API Proxy Requests GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
