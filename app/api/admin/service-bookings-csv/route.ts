import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type ServiceBookingCsvRow = {
    id: string;
    order_id: string | null;
    request_id: string | null;
    amount: number | null;
    host_payout_amount: number | null;
    platform_revenue: number | null;
    status: string | null;
    payout_status: string | null;
    payment_method: string | null;
    created_at: string;
    customer_id: string | null;
    host_id: string | null;
    service_requests?: ServiceRequestCsvRow | null;
    profiles?: CustomerProfileCsvRow | null;
};

type HostApplicationBankRow = {
    user_id: string;
    name: string | null;
    bank_name: string | null;
    account_number: string | null;
    account_holder: string | null;
    host_nationality: string | null;
};

type ServiceRequestCsvRow = {
    id: string;
    title: string | null;
    city: string | null;
    service_date: string | null;
    duration_hours: number | null;
};

type CustomerProfileCsvRow = {
    id: string;
    full_name: string | null;
    email: string | null;
};

/**
 * GET /api/admin/service-bookings-csv
 * 어드민 전용: 맞춤 의뢰(service_bookings) + host_applications(은행계좌 포함) 데이터 조회
 * service_role 키를 사용해 RLS를 우회하여 민감 데이터 포함 반환
 */
export async function GET(request: Request) {
    try {
        // 1. 어드민 권한 확인
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                        } catch { }
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient();
        const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
            userId: user.id,
            email: user.email,
        });
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const url = new URL(request.url);
        const startAt = url.searchParams.get('startAt');
        const endAt = url.searchParams.get('endAt');

        let query = supabaseAdmin
            .from('service_bookings')
            .select(
                'id, order_id, request_id, amount, host_payout_amount, platform_revenue, status, payout_status, payment_method, created_at, customer_id, host_id'
            )
            .in('status', ['PAID', 'confirmed', 'completed'])
            .order('created_at', { ascending: false });

        if (startAt) {
            query = query.gte('created_at', startAt);
        }

        if (endAt) {
            query = query.lte('created_at', endAt);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (data || []) as ServiceBookingCsvRow[];
        const requestIds = [...new Set(rows.map((row) => row.request_id).filter(Boolean))] as string[];
        const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))] as string[];
        const hostIds = [...new Set(rows.map((row) => row.host_id).filter(Boolean))] as string[];

        const requestMap = new Map<string, ServiceRequestCsvRow>();
        if (requestIds.length > 0) {
            const { data: requests, error: requestsError } = await supabaseAdmin
                .from('service_requests')
                .select('id, title, city, service_date, duration_hours')
                .in('id', requestIds);

            if (requestsError) {
                return NextResponse.json({ error: requestsError.message }, { status: 500 });
            }

            for (const request of (requests || []) as ServiceRequestCsvRow[]) {
                requestMap.set(request.id, request);
            }
        }

        const customerMap = new Map<string, CustomerProfileCsvRow>();
        if (customerIds.length > 0) {
            const { data: customers, error: customersError } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', customerIds);

            if (customersError) {
                return NextResponse.json({ error: customersError.message }, { status: 500 });
            }

            for (const customer of (customers || []) as CustomerProfileCsvRow[]) {
                customerMap.set(customer.id, customer);
            }
        }

        const hostAppMap = new Map<string, HostApplicationBankRow>();
        if (hostIds.length > 0) {
            const { data: hostApps, error: hostAppsError } = await supabaseAdmin
                .from('host_applications')
                .select('user_id, name, bank_name, account_number, account_holder, host_nationality')
                .in('user_id', hostIds)
                .order('created_at', { ascending: false });

            if (hostAppsError) {
                return NextResponse.json({ error: hostAppsError.message }, { status: 500 });
            }

            if (hostApps) {
                for (const app of hostApps) {
                    if (!hostAppMap.has(app.user_id)) {
                        hostAppMap.set(app.user_id, app as HostApplicationBankRow);
                    }
                }
            }
        }

        // 4. 응답 데이터 조합
        const enriched = rows.map((row) => ({
            ...row,
            service_requests: row.request_id ? requestMap.get(row.request_id) ?? null : null,
            profiles: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
            host_application: row.host_id ? hostAppMap.get(row.host_id) ?? null : null,
        }));

        return NextResponse.json({ data: enriched });
    } catch (err: unknown) {
        console.error('[Admin service-bookings-csv API Error]', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
    }
}
