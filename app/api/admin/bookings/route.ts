import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

/**
 * GET /api/admin/bookings
 * 어드민 전용: bookings 테이블 페이지네이션 조회 (service_role 키 사용)
 * RLS를 우회하여 전체 예약 목록 반환
 *
 * Query Params:
 *   - from: 시작 인덱스 (기본 0)
 *   - to:   끝 인덱스   (기본 19)
 */
export async function GET(request: Request) {
    try {
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient();

        const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
            userId: user.id,
            email: user.email,
        });
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const from = parseInt(searchParams.get('from') || '0', 10);
        const to = parseInt(searchParams.get('to') || '19', 10);

        const { data: bookings, error } = await supabaseAdmin
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return NextResponse.json({ success: true, data: bookings || [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        console.error('[ADMIN] /api/admin/bookings error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
