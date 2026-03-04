import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/host-applications
 * 어드민 전용: host_applications 전체 조회 (service_role 키 사용)
 * RLS를 우회하여 account_number 등 민감 컬럼 포함 전체 데이터 반환
 * 
 * Query Params:
 *   - user_ids: 콤마 구분 UUID (특정 호스트만 필터링)
 *   - select: 조회할 컬럼 (기본값: "*")
 */
export async function GET(request: Request) {
    try {
        // 1. 어드민 권한 확인 (anon 키로 인증)
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

        // 2. service_role 키로 데이터 조회 (RLS 우회)
        const supabaseAdmin = createAdminClient();
        const { searchParams } = new URL(request.url);

        const userIdsParam = searchParams.get('user_ids');
        const selectParam = searchParams.get('select') || '*';

        let query = supabaseAdmin
            .from('host_applications')
            .select(selectParam)
            .order('created_at', { ascending: false });

        if (userIdsParam) {
            const userIds = userIdsParam.split(',').filter(Boolean);
            query = query.in('user_id', userIds);
        } else {
            query = query.limit(3000);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err: any) {
        console.error('[Admin host-applications API Error]', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
