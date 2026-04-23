import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
    isLatestPublicHostApplication,
    pickLatestPublicHostApplication,
    pickLatestPublicHostApplicationsByUser,
} from '@/app/utils/hostVisibility';

type HostApplicationAdminRow = {
    id?: string | number | null;
    user_id?: string | null;
    created_at?: string | null;
    status?: string | null;
};

function annotateLatestHostApplicationRows<T extends HostApplicationAdminRow>(rows: T[]) {
    const latestByUser = pickLatestPublicHostApplicationsByUser(rows);

    return rows.map((row) => {
        const latestRow = row.user_id ? latestByUser.get(row.user_id) : null;
        return {
            ...row,
            is_latest_for_user: isLatestPublicHostApplication(row, latestRow),
        };
    });
}

/**
 * GET /api/admin/host-applications
 * 어드민 전용: host_applications 전체 조회 (service_role 키 사용)
 * 기본 목록 조회는 요약 컬럼만 반환하고, 상세 조회(id 지정)에서만 민감 컬럼을 포함합니다.
 * 
 * Query Params:
 *   - id: 특정 지원서 ID (상세 조회)
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

        const supabaseAdmin = createAdminClient();
        const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
            userId: user.id,
            email: user.email,
        });
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. service_role 키로 데이터 조회 (위 admin client 재사용)
        const { searchParams } = new URL(request.url);

        const idParam = searchParams.get('id');
        const userIdsParam = searchParams.get('user_ids');
        const summarySelect = 'id,user_id,created_at,name,status,host_nationality,profile_photo,languages,language_levels,target_language';
        const detailSelect = 'id,user_id,created_at,name,email,phone,status,host_nationality,dob,instagram,source,language_cert,profile_photo,self_intro,id_card_file,bank_name,account_number,account_holder,motivation,languages,language_levels,target_language,admin_comment';
        // [Security] select 파라미터는 서버에서만 결정 — 클라이언트 제공 select로 임의 컬럼 탈취 방어
        const selectParam = idParam ? detailSelect : summarySelect;

        let query = supabaseAdmin
            .from('host_applications')
            .select(selectParam)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        if (idParam) {
            const { data, error } = await query.eq('id', idParam).maybeSingle();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data) {
                return NextResponse.json({ data: null });
            }

            const detailRecord = data as unknown as Record<string, unknown>;
            const detailRow = data as HostApplicationAdminRow;
            const responseData: Record<string, unknown> = { ...detailRecord };
            responseData.is_latest_for_user = false;

            if (detailRow.user_id) {
                const { data: latestRows, error: latestRowsError } = await supabaseAdmin
                    .from('host_applications')
                    .select('id, user_id, created_at, status')
                    .eq('user_id', detailRow.user_id)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .limit(2);

                if (latestRowsError) {
                    return NextResponse.json({ error: latestRowsError.message }, { status: 500 });
                }

                const latestRow = pickLatestPublicHostApplication((latestRows || []) as HostApplicationAdminRow[]);
                responseData.is_latest_for_user = isLatestPublicHostApplication(detailRow, latestRow);
            }

            const idCardPath = typeof detailRecord.id_card_file === 'string' ? detailRecord.id_card_file : null;

            if (idCardPath) {
                if (idCardPath.startsWith('http')) {
                    responseData.id_card_signed_url = idCardPath;
                } else {
                    const { data: signedData, error: signedError } = await supabaseAdmin
                        .storage
                        .from('verification-docs')
                        .createSignedUrl(idCardPath, 3600);

                    if (signedError) {
                        console.error('[Admin host-applications] Signed URL error:', signedError);
                    } else {
                        responseData.id_card_signed_url = signedData?.signedUrl ?? null;
                    }
                }
            }

            return NextResponse.json({ data: responseData });
        } else if (userIdsParam) {
            const userIds = userIdsParam.split(',').filter(Boolean);
            query = query.in('user_id', userIds);
        } else {
            query = query.limit(3000);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const responseData = annotateLatestHostApplicationRows((data || []) as HostApplicationAdminRow[]);

        return NextResponse.json({ data: responseData });
    } catch (err: unknown) {
        console.error('[Admin host-applications API Error]', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
    }
}
