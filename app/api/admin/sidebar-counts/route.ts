import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET(request: Request) {
    try {
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const [userEntry, whitelist] = await Promise.all([
            supabaseServer.from('users').select('role').eq('id', user.id).maybeSingle(),
            supabaseServer.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
        ]);

        const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const lastViewed = searchParams.get('lastViewed') || new Date(0).toISOString();

        const supabaseAdmin = createAdminClient();

        const [
            appsRes,
            expsRes,
            bookingsRes,
            svcRes,
            tasksRes,
            commentsRes,
            inquiriesRes
        ] = await Promise.all([
            supabaseAdmin.from('host_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('experiences').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('bookings').select('id').eq('status', 'PENDING'),
            supabaseAdmin.from('service_bookings').select('*', { count: 'exact', head: true }).eq('status', 'PENDING').eq('payment_method', 'bank'),
            supabaseAdmin.from('admin_tasks').select('*', { count: 'exact', head: true }).gt('created_at', lastViewed),
            supabaseAdmin.from('admin_task_comments').select('*', { count: 'exact', head: true }).gt('created_at', lastViewed),
            supabaseAdmin.from('inquiries').select('id').or('type.eq.admin_support,type.eq.admin')
        ]);

        let csUnreadCount = 0;
        const csIds = (inquiriesRes.data || []).map((i: any) => i.id);
        if (csIds.length > 0) {
            const { count } = await supabaseAdmin
                .from('inquiry_messages')
                .select('*', { count: 'exact', head: true })
                .in('inquiry_id', csIds)
                .eq('is_read', false);
            csUnreadCount = count || 0;
        }

        return NextResponse.json({
            success: true,
            data: {
                appsCount: appsRes.count || 0,
                expsCount: expsRes.count || 0,
                pendingBookingIds: (bookingsRes.data || []).map(b => b.id),
                svcBankPendingCount: svcRes.count || 0,
                newTasksCount: tasksRes.count || 0,
                newCommentsCount: commentsRes.count || 0,
                csUnreadCount
            }
        });
    } catch (error: any) {
        console.error('[ADMIN] /api/admin/sidebar-counts error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
    }
}
