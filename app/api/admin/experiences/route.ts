import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/experiences
 * 어드민 전용: experiences 전체 조회 (service_role 키 사용)
 * 접근 권한: users.role === 'admin' 또는 관리자 화이트리스트
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

        const supabaseAdmin = createAdminClient();
        const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
            userId: user.id,
            email: user.email,
        });
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. service_role 키로 데이터 조회
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string, 10) : 3000;

        const { data, error } = await supabaseAdmin
            .from('experiences')
            .select('*, profiles!experiences_host_id_fkey(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(limitParam);

        if (error) {
            console.error('[Admin experiences] Supabase Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err: unknown) {
        console.error('[Admin experiences API Error]', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
    }
}
