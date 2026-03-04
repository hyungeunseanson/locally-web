import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

        const [userEntry, whitelist] = await Promise.all([
            supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
            supabase.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
        ]);

        const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. service_role 로 service_bookings + host_applications 조회 (RLS 우회)
        const supabaseAdmin = createAdminClient();

        const { data, error } = await supabaseAdmin
            .from('service_bookings')
            .select(`
        id, order_id, amount, host_payout_amount, platform_revenue,
        status, payment_method, created_at, customer_id, host_id,
        service_requests ( title, city, service_date, duration_hours ),
        profiles!service_bookings_customer_id_fkey ( full_name, email )
      `)
            .in('status', ['PAID', 'confirmed', 'completed'])
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 3. host_applications 데이터를 별도로 조회 (host_id 기반)
        const rows = data || [];
        const hostIds = [...new Set(rows.map((r: any) => r.host_id).filter(Boolean))] as string[];

        let hostAppMap = new Map<string, any>();
        if (hostIds.length > 0) {
            const { data: hostApps } = await supabaseAdmin
                .from('host_applications')
                .select('user_id, name, bank_name, account_number, account_holder, host_nationality')
                .in('user_id', hostIds)
                .order('created_at', { ascending: false });

            if (hostApps) {
                for (const app of hostApps) {
                    if (!hostAppMap.has(app.user_id)) {
                        hostAppMap.set(app.user_id, app);
                    }
                }
            }
        }

        // 4. 응답 데이터 조합
        const enriched = rows.map((b: any) => ({
            ...b,
            host_application: hostAppMap.get(b.host_id) ?? null,
        }));

        return NextResponse.json({ data: enriched });
    } catch (err: any) {
        console.error('[Admin service-bookings-csv API Error]', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
