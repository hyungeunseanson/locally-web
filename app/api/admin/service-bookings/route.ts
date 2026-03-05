import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET() {
    try {
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient(); // bypasses RLS

        // Admin role check using admin client (bypasses RLS on admin_whitelist)
        const [userEntry, whitelist] = await Promise.all([
            supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
            supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
        ]);

        const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
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

        // Build lookup maps
        const requestsMap = new Map((reqsRes.data || []).map((r) => [r.id, r]));
        const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u]));
        const appsMap = new Map((appsRes.data || []).map((a) => [a.id, a]));

        // Enrich data
        const enriched = serviceBookings.map((b) => ({
            ...b,
            request: requestsMap.get(b.request_id) || null,
            customer: usersMap.get(b.customer_id) || null,
            host: usersMap.get(b.host_id) || null,
            application: appsMap.get(b.application_id) || null,
        }));

        return NextResponse.json({ success: true, data: enriched });
    } catch (error: any) {
        console.error('[ADMIN] /api/admin/service-bookings error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
    }
}
