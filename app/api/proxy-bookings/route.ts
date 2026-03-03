import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
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
                locally_order_id: !isNaver ? `LOCALLY-PROXY-${Date.now()}` : null,
                agreed_to_terms: data.agreed_to_terms,
                status: 'PENDING',
            })
            .select('id, locally_order_id')
            .single();

        if (insertError || !newRequest) {
            console.error('Proxy Request Create Error:', insertError);
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

        // Role check to fetch all requests if admin
        const { data: adminData } = await supabase
            .from('admin_whitelist')
            .select('email')
            .eq('email', user.email)
            .maybeSingle();

        const isAdmin = !!adminData;

        let query = supabase
            .from('proxy_requests')
            .select('*, profiles(name, email)') // Fetch basic client profile
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
