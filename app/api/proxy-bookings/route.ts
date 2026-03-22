import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';
import { getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';

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
        const baseFormData = data.category_data.form_data;
        const finalAmount = getProxyRequestFeeKrw(data.category_data.category, baseFormData);
        const formData = isNaver
          ? {
              ...baseFormData,
              service_fee_krw: finalAmount,
            }
          : {
              ...baseFormData,
              service_fee_krw: finalAmount,
              payment_method: data.payment_method,
              contact_name: data.contact_name,
              contact_phone: data.contact_phone,
            };

        // Insert into proxy_requests
        const { data: newRequest, error: insertError } = await supabase
            .from('proxy_requests')
            .insert({
                user_id: user.id,
                category: data.category_data.category,
                form_data: formData,
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
            finalAmount,
        });
    } catch (error: unknown) {
        console.error('API Proxy Request POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function GET() {
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
            .select('id, user_id, category, status, form_data, payment_channel, payment_status, naver_buyer_name, locally_order_id, agreed_to_terms, created_at, updated_at')
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

        const rows = (data ?? []) as ProxyRequestRow[];
        const profileIds = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
        const profilesById = new Map<string, ProfileRow>();

        if (profileIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, phone')
                .in('id', profileIds);

            if (profilesError) {
                console.error('Proxy Request Profiles Fetch Error:', profilesError);
                return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
            }

            for (const profile of (profiles ?? []) as ProfileRow[]) {
                profilesById.set(profile.id, profile);
            }
        }

        const mergedRows = rows.map((item) => ({
            ...item,
            profiles: profilesById.get(item.user_id)
                ? {
                    full_name: profilesById.get(item.user_id)?.full_name ?? null,
                    email: profilesById.get(item.user_id)?.email ?? null,
                    avatar_url: profilesById.get(item.user_id)?.avatar_url ?? null,
                    phone: profilesById.get(item.user_id)?.phone ?? null,
                }
                : undefined,
        }));

        return NextResponse.json({ success: true, data: mergedRows, viewerIsAdmin: isAdmin });
    } catch (error: unknown) {
        console.error('API Proxy Requests GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
