import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

export async function GET() {
    try {
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient(); // bypasses RLS

        const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
            userId: user.id,
            email: user.email,
        });
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all service bookings ordered by creation date
        const { data: serviceBookings, error: sbError } = await supabaseAdmin
            .from('service_bookings')
            .select('*')
            .order('created_at', { ascending: false });

        if (sbError) throw sbError;
        if (!serviceBookings) return NextResponse.json({ data: [] });

        // Collect related IDs
        const requestIds = Array.from(new Set(serviceBookings.map((b) => b.request_id).filter(Boolean)));
        const userIds = Array.from(new Set(serviceBookings.flatMap((b) => [b.customer_id, b.host_id]).filter(Boolean)));
        const appIds = Array.from(new Set(serviceBookings.map((b) => b.application_id).filter(Boolean)));

        // Fetch related data in parallel
        const [reqsRes, usersRes, appsRes] = await Promise.all([
            requestIds.length > 0
                ? supabaseAdmin.from('service_requests').select('*').in('id', requestIds)
                : { data: [] },
            userIds.length > 0
                ? supabaseAdmin.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds)
                : { data: [] },
            appIds.length > 0
                ? supabaseAdmin.from('service_applications').select('id, request_id, host_id, appeal_message').in('id', appIds)
                : { data: [] },
        ]);

        const hostIds = Array.from(
            new Set(
                serviceBookings
                    .flatMap((booking) => {
                        const matchedApplication = (appsRes.data || []).find((application) => application.id === booking.application_id);
                        return [booking.host_id, matchedApplication?.host_id];
                    })
                    .filter(Boolean)
            )
        );

        const { data: hostApplications, error: hostApplicationsError } = hostIds.length > 0
            ? await supabaseAdmin
                .from('host_applications')
                .select('user_id, name, bank_name, account_number, account_holder, created_at')
                .in('user_id', hostIds)
                .order('created_at', { ascending: false })
            : { data: [], error: null };

        if (hostApplicationsError) throw hostApplicationsError;

        // Build lookup maps
        const requestsMap = new Map((reqsRes.data || []).map((r) => [r.id, r]));
        const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u]));
        const appsMap = new Map((appsRes.data || []).map((a) => [a.id, a]));
        const hostApplicationsMap = new Map<string, (typeof hostApplications)[number]>();

        for (const application of hostApplications || []) {
            if (application.user_id && !hostApplicationsMap.has(application.user_id)) {
                hostApplicationsMap.set(application.user_id, application);
            }
        }

        // Enrich data
        const enriched = serviceBookings.map((b) => {
            const application = appsMap.get(b.application_id) || null;
            const hostUserId = b.host_id || application?.host_id || null;

            return {
                ...b,
                request: requestsMap.get(b.request_id) || null,
                customer: usersMap.get(b.customer_id) || null,
                host: usersMap.get(b.host_id) || null,
                application,
                host_application: hostUserId ? hostApplicationsMap.get(hostUserId) || null : null,
            };
        });

        return NextResponse.json({ success: true, data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        console.error('[ADMIN] /api/admin/service-bookings error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
