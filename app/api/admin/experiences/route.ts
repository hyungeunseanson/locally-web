import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { pickLatestPublicHostApplicationsByUser } from '@/app/utils/hostVisibility';

type AdminExperienceRow = Record<string, unknown> & {
    host_id?: string | null;
    profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

type AdminExperienceHostApplicationRow = {
    id?: string | number | null;
    user_id?: string | null;
    name?: string | null;
    status?: string | null;
    profile_photo?: string | null;
    languages?: unknown;
    language_levels?: unknown;
    host_nationality?: string | null;
    created_at?: string | null;
};

const ADMIN_EXPERIENCE_SUMMARY_SELECT = `
  id,
  created_at,
  title,
  host_id,
  status,
  admin_comment,
  price,
  solo_guarantee_price,
  solo_guarantee_option_visible,
  photos,
  profiles!experiences_host_id_fkey(full_name)
`;

const ADMIN_EXPERIENCE_DETAIL_SELECT = `
  id,
  created_at,
  title,
  host_id,
  status,
  admin_comment,
  price,
  duration,
  max_guests,
  city,
  country,
  is_private_enabled,
  private_price,
  solo_guarantee_price,
  solo_guarantee_option_visible,
  category,
  meeting_point,
  location,
  description,
  supplies,
  itinerary,
  inclusions,
  exclusions,
  photos,
  rules,
  languages,
  language_levels,
  profiles!experiences_host_id_fkey(full_name)
`;

function getExperienceProfileName(profiles: AdminExperienceRow['profiles']) {
    if (Array.isArray(profiles)) {
        return profiles[0]?.full_name ?? null;
    }

    return profiles?.full_name ?? null;
}

async function attachHostContext(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    rows: AdminExperienceRow[]
) {
    const hostIds = Array.from(new Set(
        rows
            .map((row) => (typeof row.host_id === 'string' ? row.host_id : null))
            .filter((hostId): hostId is string => Boolean(hostId))
    ));

    const latestApplicationByHost = new Map<string, AdminExperienceHostApplicationRow>();

    if (hostIds.length > 0) {
        const { data: hostApplications, error: hostApplicationsError } = await supabaseAdmin
            .from('host_applications')
            .select('id,user_id,name,status,profile_photo,languages,language_levels,host_nationality,created_at')
            .in('user_id', hostIds)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        if (hostApplicationsError) {
            throw hostApplicationsError;
        }

        for (const [hostId, application] of pickLatestPublicHostApplicationsByUser(
            (hostApplications || []) as AdminExperienceHostApplicationRow[]
        )) {
            latestApplicationByHost.set(hostId, application);
        }
    }

    return rows.map((row) => {
        const hostId = typeof row.host_id === 'string' ? row.host_id : null;
        const latestApplication = hostId ? latestApplicationByHost.get(hostId) ?? null : null;

        return {
            ...row,
            host_context: {
                host_id: hostId,
                profile_name: getExperienceProfileName(row.profiles),
                application_id: latestApplication?.id ?? null,
                application_name: latestApplication?.name ?? null,
                application_status: latestApplication?.status ?? null,
                application_profile_photo: latestApplication?.profile_photo ?? null,
                application_languages: Array.isArray(latestApplication?.languages) ? latestApplication.languages : null,
                application_language_levels: Array.isArray(latestApplication?.language_levels) ? latestApplication.language_levels : null,
                application_nationality: latestApplication?.host_nationality ?? null,
                is_latest_application: Boolean(latestApplication),
            },
        };
    });
}

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
        const idParam = searchParams.get('id');
        const limitParam = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string, 10) : 3000;

        const query = supabaseAdmin
            .from('experiences')
            .select(idParam ? ADMIN_EXPERIENCE_DETAIL_SELECT : ADMIN_EXPERIENCE_SUMMARY_SELECT)
            .order('created_at', { ascending: false });

        if (idParam) {
            const { data, error } = await query.eq('id', idParam).maybeSingle();

            if (error) {
                console.error('[Admin experiences] Supabase Error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            const [enrichedRow] = data
                ? await attachHostContext(supabaseAdmin, [data as unknown as AdminExperienceRow])
                : [];

            return NextResponse.json({ data: enrichedRow ?? null });
        }

        const { data, error } = await query
            .limit(limitParam);

        if (error) {
            console.error('[Admin experiences] Supabase Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const responseData = await attachHostContext(supabaseAdmin, (data || []) as unknown as AdminExperienceRow[]);

        return NextResponse.json({ data: responseData });
    } catch (err: unknown) {
        console.error('[Admin experiences API Error]', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
    }
}
